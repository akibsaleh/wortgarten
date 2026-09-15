/**
 * P1-T5 / P2-T3: Session composition engine.
 * Due reviews first (capped), then new words in thematic blocks of 3–5,
 * interleaved with remaining reviews. PLAN.md §3.
 *
 * P2-T3 adds weighted interaction-type assignment:
 *   production ~50%, recognition ~25%, cloze ~15%, audio ~10%.
 */
import { db, type Card, type Word } from '../db/schema';

const ESTIMATED_SEC_PER_CARD = 9;

export type CardType = 'production' | 'recognition' | 'cloze' | 'audio';

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

/** Count how many new cards have been introduced today. */
async function newCardsIntroducedToday(): Promise<number> {
  const today = todayKey();
  const todayStart = new Date(today + 'T00:00:00');
  const logs = await db.reviewLogs
    .where('review')
    .aboveOrEqual(todayStart)
    .toArray();
  // A card goes from New → Learning on its first review.
  // Count distinct wordIds that had their first review today.
  const firstReviews = new Set<string>();
  for (const log of logs) {
    if (log.rating !== 0) {
      // Check if this was the card's first review
      const card = await db.cards.get(log.cardId);
      if (card && card.reps <= 1) {
        firstReviews.add(log.wordId);
      }
    }
  }
  return firstReviews.size;
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
  const dueCards = await db.cards
    .where('due')
    .belowOrEqual(now)
    .toArray();

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
  const wordIds = [...new Set([...cappedDue, ...newCards].map((c) => c.wordId))];
  const words = await db.words.where('id').anyOf(wordIds).toArray();
  const wordMap = new Map(words.map((w) => [w.id, w]));

  // Assign interaction types per weighted mix
  let typeCounter = 0;
  function nextType(): CardType {
    const types: CardType[] = ['production', 'production', 'recognition', 'recognition', 'cloze', 'audio'];
    const t = types[typeCounter % types.length]!;
    typeCounter++;
    return t;
  }

  // Mark kind
  const sessionCards: SessionCard[] = [];
  for (const card of cappedDue) {
    const word = wordMap.get(card.wordId);
    if (word) sessionCards.push({ card, word, kind: 'review', cardType: nextType() });
  }
  for (const card of newCards) {
    const word = wordMap.get(card.wordId);
    if (word) sessionCards.push({ card, word, kind: 'new', cardType: nextType() });
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
  return hash / 0x100000000; // normalize to [0, 1)
}

/**
 * Generate cloze text by blanking the lemma (case-insensitive) from example_de.
 * Returns the sentence with the first match replaced by "_____".
 * If the lemma is not found, returns the original sentence.
 */
export function generateCloze(exampleDe: string, lemma: string): string {
  // Build a regex that matches the lemma word-boundary, case-insensitive
  const escaped = lemma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'i');
  if (re.test(exampleDe)) {
    return exampleDe.replace(re, '_____');
  }
  // Fallback: just blank the first occurrence of the lemma substring
  const idx = exampleDe.toLowerCase().indexOf(lemma.toLowerCase());
  if (idx >= 0) {
    return (
      exampleDe.slice(0, idx) +
      '_____' +
      exampleDe.slice(idx + lemma.length)
    );
  }
  // If still not found, return original with a trailing blank
  return `${exampleDe} (_____)`;
}

/**
 * Assign card types to session cards using a deterministic weighted random.
 *
 * Weights (PLAN.md §3):
 *   production  ~50%
 *   recognition ~25%
 *   cloze       ~15%
 *   audio       ~10% (only when audio_word is non-empty)
 *
 * When audio is unavailable the 10% slice is redistributed:
 *   production gets 60%, recognition 25%, cloze 15%.
 */
export function assignCardTypes(cards: SessionCard[]): SessionCard[] {
  return cards.map((sc, idx) => {
    const hasAudio = sc.word.audio_word && sc.word.audio_word.trim().length > 0;
    const hasExample = sc.word.example_de && sc.word.example_de.trim().length > 0;

    // Deterministic seed: card index + word id
    const seed = djb2Hash(`${sc.word.id}::${idx}`);
    const r = seed; // value in [0, 1)

    let cardType: CardType;

    if (hasAudio) {
      // Full 4-way split
      if (r < 0.50) {
        cardType = 'production';
      } else if (r < 0.75) {
        cardType = 'recognition';
      } else if (r < 0.90) {
        cardType = hasExample ? 'cloze' : 'production';
      } else {
        cardType = 'audio';
      }
    } else {
      // No audio: redistribute audio's 10% to production
      if (r < 0.60) {
        cardType = 'production';
      } else if (r < 0.85) {
        cardType = 'recognition';
      } else {
        cardType = hasExample ? 'cloze' : 'recognition';
      }
    }

    const clozeText =
      cardType === 'cloze'
        ? generateCloze(sc.word.example_de, sc.word.lemma)
        : undefined;

    return { ...sc, cardType, clozeText };
  });
}
