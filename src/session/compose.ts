/**
 * P1-T5 / P2-T3: Session composition engine.
 * Due reviews first (capped), then new words in thematic blocks of 3–5,
 * interleaved with remaining reviews. PLAN.md §3.
 *
 * P2-T3 adds weighted interaction-type assignment:
 *   production ~50%, recognition ~25%, cloze ~15%, audio ~10%.
 * P2-T6 adds the first-exposure gate: unseen words get an 'intro' card
 *   (never a quiz), then recognition-only until 2 graded recalls. Cloze
 *   requires pipeline-computed cloze data on the word.
 */
import { db, type Card, type Word } from '../db/schema';

const ESTIMATED_SEC_PER_CARD = 9;

export type CardType =
  'production' | 'recognition' | 'cloze' | 'audio' | 'intro';

export interface SessionCard {
  card: Card;
  word: Word;
  /** 'review' for due cards, 'new' for new word cards. */
  kind: 'review' | 'new';
  /** Interaction type assigned per weighted mix. */
  cardType: CardType;
  /** For cloze cards: the example sentence with the target word blanked. */
  clozeText?: string;
}

export interface SessionConfig {
  reviewCap: number;
  newPerDay: number;
  /** Session target in minutes. */
  targetMinutes: number;
}

const DEFAULT_CONFIG: SessionConfig = {
  reviewCap: 60,
  newPerDay: 10,
  targetMinutes: 10,
};

/** Get today's date string (device-local) for new-word tracking. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Count how many new words have been introduced today (intro card shown). */
async function newCardsIntroducedToday(): Promise<number> {
  const todayStart = new Date(todayKey() + 'T00:00:00');
  const cards = await db.cards.toArray();
  const introduced = new Set<string>();
  for (const c of cards) {
    if (c.introduced_at && c.introduced_at >= todayStart) {
      introduced.add(c.wordId);
    }
  }
  return introduced.size;
}

/**
 * Compose a session's card queue per PLAN.md §3.
 *
 * Order:
 *   1. Due reviews (capped, sorted by lowest predicted retrievability)
 *   2. New words in thematic blocks of 3–5, interleaved with remaining reviews
 *
 * Returns up to `targetMinutes * 60 / 9` cards (estimated).
 */
export async function composeSession(
  config: Partial<SessionConfig> = {},
): Promise<SessionCard[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const maxCards = Math.ceil((cfg.targetMinutes * 60) / ESTIMATED_SEC_PER_CARD);

  // --- Due reviews ---
  const now = new Date();
  // New cards (state 0) are created with due=now — exclude them here so a
  // card can't appear twice (once as "review", once as "new").
  const dueCards = (
    await db.cards.where('due').belowOrEqual(now).toArray()
  ).filter((c) => c.state !== 0);

  // Sort by state first (Relearning before Review before Learning),
  // then by due date (most overdue first).
  dueCards.sort((a, b) => {
    if (a.state !== b.state) return a.state - b.state;
    return a.due.getTime() - b.due.getTime();
  });

  const cappedDue = dueCards.slice(0, cfg.reviewCap);

  // --- New words ---
  const introduced = await newCardsIntroducedToday();
  const newNeeded = Math.max(0, cfg.newPerDay - introduced);
  const allNew = await db.cards.where('state').equals(0).toArray();
  const newCards = allNew.slice(0, newNeeded);

  // Load word data for all cards
  const wordIds = [
    ...new Set([...cappedDue, ...newCards].map((c) => c.wordId)),
  ];
  const words = await db.words.where('id').anyOf(wordIds).toArray();
  const wordMap = new Map(words.map((w) => [w.id, w]));

  // Mark kind — cardType here is a placeholder; the real interaction type
  // is assigned by assignCardTypes() once the final queue order is known.
  const sessionCards: SessionCard[] = [];
  for (const card of cappedDue) {
    const word = wordMap.get(card.wordId);
    if (word)
      sessionCards.push({
        card,
        word,
        kind: 'review',
        cardType: 'recognition',
      });
  }
  for (const card of newCards) {
    const word = wordMap.get(card.wordId);
    if (word)
      sessionCards.push({ card, word, kind: 'new', cardType: 'recognition' });
  }

  // --- Interleave new words in thematic blocks of 3–5 ---
  // Group new cards by theme
  const newByTheme = new Map<string, SessionCard[]>();
  const newOnly = sessionCards.filter((s) => s.kind === 'new');
  for (const sc of newOnly) {
    const theme = sc.word.theme;
    if (!newByTheme.has(theme)) newByTheme.set(theme, []);
    newByTheme.get(theme)!.push(sc);
  }

  // Take blocks of 3–5 from each theme
  const newBlocks: SessionCard[][] = [];
  for (const cards of newByTheme.values()) {
    for (let i = 0; i < cards.length; i += 4) {
      newBlocks.push(cards.slice(i, i + 4));
    }
  }

  // Interleave: reviews first, then [block, reviews, block, reviews, ...]
  const reviewOnly = sessionCards.filter((s) => s.kind === 'review');
  const result: SessionCard[] = [];
  let reviewIdx = 0;
  let blockIdx = 0;

  // Start with some reviews
  const initialReviews = Math.min(reviewOnly.length, Math.ceil(maxCards * 0.3));
  result.push(...reviewOnly.slice(reviewIdx, reviewIdx + initialReviews));
  reviewIdx += initialReviews;

  // Interleave blocks with reviews
  while (blockIdx < newBlocks.length || reviewIdx < reviewOnly.length) {
    if (blockIdx < newBlocks.length) {
      result.push(...newBlocks[blockIdx]!);
      blockIdx++;
    }
    // Add some reviews between blocks
    const reviewsBetween = Math.min(
      reviewOnly.length - reviewIdx,
      Math.ceil(maxCards * 0.15),
    );
    if (reviewsBetween > 0) {
      result.push(...reviewOnly.slice(reviewIdx, reviewIdx + reviewsBetween));
      reviewIdx += reviewsBetween;
    }
  }

  // Add remaining reviews
  result.push(...reviewOnly.slice(reviewIdx));

  // Trim to max cards
  const trimmed = result.slice(0, maxCards);

  // --- P2-T3: Assign interaction types per weighted mix ---
  return assignCardTypes(trimmed);
}

// ─── P2-T3: Interaction-type assignment ────────────────────────────────────────

/**
 * Simple deterministic hash from a string (djb2 variant).
 * Used to generate a reproducible float in [0, 1) for each card.
 */
function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 + charCode
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  // Murmur3-style avalanche finalizer: plain djb2 clusters for strings
  // sharing a prefix ("word::3" vs "word::4" differ by ~1e-9), which made
  // per-position type weights nearly constant for a given word.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x45d9f3b) >>> 0;
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000; // normalize to [0, 1) — >>> keeps it unsigned
}

/**
 * Assign card types. Two gates run before the weighted mix:
 *
 * 1. First-exposure gate (PLAN.md §3): a word never seen is introduced, never
 *    quizzed — 'intro' for its first card in the session, 'recognition' for
 *    any further card of the same word. Cards stay recognition-only until
 *    2 graded recalls; production/cloze/audio unlock after that.
 * 2. Cloze eligibility: only words with pipeline-computed cloze data
 *    (cloze_sentence/cloze_answer) can receive cloze cards; their share
 *    falls back to production/recognition otherwise.
 *
 * Weights (PLAN.md §3):
 *   production  ~50%
 *   recognition ~25%
 *   cloze       ~15%
 *   audio       ~10% (only when audio_word is non-empty)
 *
 * When audio is unavailable the 10% slice is redistributed to production.
 */
export function assignCardTypes(cards: SessionCard[]): SessionCard[] {
  const introGivenTo = new Set<string>();

  return cards.map((sc, idx) => {
    const neverIntroduced = !sc.card.introduced_at && sc.card.reps === 0;
    if (neverIntroduced && !introGivenTo.has(sc.word.id)) {
      introGivenTo.add(sc.word.id);
      return { ...sc, cardType: 'intro' as const };
    }
    if (neverIntroduced || sc.card.reps < 2) {
      return { ...sc, cardType: 'recognition' as const };
    }

    const hasAudio = Boolean(sc.word.audio_word?.trim());
    const hasCloze = Boolean(sc.word.cloze_sentence && sc.word.cloze_answer);

    // Deterministic seed: card index + word id
    const r = djb2Hash(`${sc.word.id}::${idx}`); // value in [0, 1)

    let cardType: CardType;
    if (hasAudio) {
      // Full 4-way split
      if (r < 0.5) {
        cardType = 'production';
      } else if (r < 0.75) {
        cardType = 'recognition';
      } else if (r < 0.9) {
        cardType = hasCloze ? 'cloze' : 'production';
      } else {
        cardType = 'audio';
      }
    } else {
      // No audio: redistribute audio's 10% to production
      if (r < 0.6) {
        cardType = 'production';
      } else if (r < 0.85) {
        cardType = 'recognition';
      } else {
        cardType = hasCloze ? 'cloze' : 'recognition';
      }
    }

    return {
      ...sc,
      cardType,
      clozeText: cardType === 'cloze' ? sc.word.cloze_sentence! : undefined,
    };
  });
}
