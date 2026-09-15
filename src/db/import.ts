import wordsData from '../../public/words.json';
import { db, type Word, type Card, type Settings } from './schema';

const DEFAULT_SETTINGS: Settings = {
  id: 1,
  daily_goal_minutes: 10,
  new_cards_per_day: 10,
  review_cap: 60,
  reduced_motion: 'auto',
  data_version: wordsData.dataVersion,
};

/**
 * Idempotent import: re-importing the same dataVersion is a no-op.
 * Importing a newer version upserts word content without touching SRS state.
 * PLAN.md §6: cards, reviewLogs, sessions, settings are never touched.
 */
export async function importWords(): Promise<{ imported: number; skipped: number }> {
  const current = await db.settings.get(1);
  if (current?.data_version === wordsData.dataVersion) {
    return { imported: 0, skipped: wordsData.words.length };
  }

  const words = wordsData.words as Word[];

  await db.transaction('rw', db.words, db.cards, db.settings, async () => {
    // Upsert word content (never touches SRS state)
    await db.words.bulkPut(words);

    // Create cards only for words that don't have them yet
    const existingCardIds = new Set(
      (await db.cards.toArray()).map((c) => c.id),
    );

    const newCards: Card[] = [];
    for (const w of words) {
      const recId = `${w.id}.rec`;
      const prodId = `${w.id}.prod`;
      if (!existingCardIds.has(recId)) {
        newCards.push({
          id: recId,
          wordId: w.id,
          type: 'recognition',
          due: new Date(),
          stability: 0,
          difficulty: 0,
          elapsed_days: 0,
          scheduled_days: 0,
          reps: 0,
          lapses: 0,
          state: 0, // New
          last_review: null,
        });
      }
      if (!existingCardIds.has(prodId)) {
        newCards.push({
          id: prodId,
          wordId: w.id,
          type: 'production',
          due: new Date(),
          stability: 0,
          difficulty: 0,
          elapsed_days: 0,
          scheduled_days: 0,
          reps: 0,
          lapses: 0,
          state: 0, // New
          last_review: null,
        });
      }
    }

    if (newCards.length > 0) {
      await db.cards.bulkAdd(newCards);
    }

    // Ensure default settings exist
    if (!current) {
      await db.settings.add(DEFAULT_SETTINGS);
    }

    // Record data version
    await db.settings.update(1, { data_version: wordsData.dataVersion });
  });

  return { imported: words.length, skipped: 0 };
}
