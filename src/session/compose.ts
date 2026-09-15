/**
 * P1-T5: Session composition engine.
 * Due reviews first (capped), then new words in thematic blocks of 3–5,
 * interleaved with remaining reviews. PLAN.md §3.
 */
import { db, type Card, type Word } from '../db/schema';

const ESTIMATED_SEC_PER_CARD = 9;

export interface SessionCard {
  card: Card;
  word: Word;
  /** 'review' for due cards, 'new' for new word cards. */
  kind: 'review' | 'new';
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

  // Mark kind
  const sessionCards: SessionCard[] = [];
  for (const card of cappedDue) {
    const word = wordMap.get(card.wordId);
    if (word) sessionCards.push({ card, word, kind: 'review' });
  }
  for (const card of newCards) {
    const word = wordMap.get(card.wordId);
    if (word) sessionCards.push({ card, word, kind: 'new' });
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
  return result.slice(0, maxCards);
}
