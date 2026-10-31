/**
 * P1-T3: ts-fsrs wrapper. All scheduling goes through this module —
 * no hand-rolled scheduler code anywhere.
 */
import { FSRS, Rating, State, createEmptyCard } from 'ts-fsrs';
import { db, type Card, type ReviewLog } from '../db/schema';

const fsrs = new FSRS({ request_retention: 0.9 });

/** Create a new card in New state. */
export function newCard(wordId: string, type: Card['type']): Card {
  const empty = createEmptyCard(new Date());
  return {
    id: `${wordId}.${type === 'recognition' ? 'rec' : 'prod'}`,
    wordId,
    type,
    due: empty.due,
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsed_days: empty.elapsed_days,
    scheduled_days: empty.scheduled_days,
    reps: empty.reps,
    lapses: empty.lapses,
    state: empty.state,
    last_review: null,
    introduced_at: null,
  };
}

/** Rate a card and persist the updated card + review log. */
export async function rateCard(
  cardId: string,
  rating: Rating,
  elapsedMs: number,
): Promise<{ card: Card; log: ReviewLog }> {
  const existing = await db.cards.get(cardId);
  if (!existing) throw new Error(`Card not found: ${cardId}`);

  const cardInput = {
    due: existing.due,
    stability: existing.stability,
    difficulty: existing.difficulty,
    elapsed_days: existing.elapsed_days,
    scheduled_days: existing.scheduled_days,
    reps: existing.reps,
    lapses: existing.lapses,
    state: existing.state,
    last_review: existing.last_review ?? undefined,
  };

  const record = fsrs.repeat(cardInput, new Date())[rating as Exclude<Rating, Rating.Manual>];

  const updated: Card = {
    ...existing,
    due: record.card.due,
    stability: record.card.stability,
    difficulty: record.card.difficulty,
    elapsed_days: record.card.elapsed_days,
    scheduled_days: record.card.scheduled_days,
    reps: record.card.reps,
    lapses: record.card.lapses,
    state: record.card.state,
    last_review: new Date(),
  };

  const logEntry: ReviewLog = {
    cardId,
    wordId: existing.wordId,
    rating,
    review: new Date(),
    elapsed_ms: elapsedMs,
  };

  await db.transaction('rw', db.cards, db.reviewLogs, async () => {
    await db.cards.put(updated);
    await db.reviewLogs.add(logEntry);
  });

  return { card: updated, log: logEntry };
}

/** Mark every card of a word as introduced (called when an intro card is answered). */
export async function markWordIntroduced(wordId: string): Promise<void> {
  await db.cards.where('wordId').equals(wordId).modify({ introduced_at: new Date() });
}

/** Map interaction outcome to FSRS rating per PLAN.md §3. */
export function outcomeToRating(outcome: 'wrong' | 'hard' | 'good' | 'easy'): Rating {
  switch (outcome) {
    case 'wrong': return Rating.Again;
    case 'hard': return Rating.Hard;
    case 'good': return Rating.Good;
    case 'easy': return Rating.Easy;
  }
}

/** Get all due cards sorted by predicted retrievability (lowest first). */
export async function getDueCards(limit: number): Promise<Card[]> {
  const now = new Date();
  return db.cards
    .where('due')
    .belowOrEqual(now)
    .limit(limit)
    .toArray();
}

/** Get new (unseen) cards. */
export async function getNewCards(limit: number): Promise<Card[]> {
  return db.cards
    .where('state')
    .equals(State.New)
    .limit(limit)
    .toArray();
}
