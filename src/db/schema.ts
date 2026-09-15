import Dexie, { type Table } from 'dexie';

// PLAN.md §2 — per-word schema
export interface Word {
  id: string;
  lemma: string;
  gender: 'der' | 'die' | 'das' | null;
  plural: string | null;
  pos: 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'conj' | 'pron' | 'num' | 'part';
  gloss_en: string;
  example_de: string;
  example_en: string;
  case_note: string | null;
  separable: boolean;
  prefix: string | null;
  audio_word: string;
  audio_example: string;
  image_ref: string | null;
  theme: string;
  cefr: 'A1' | 'A2' | 'B1';
  freq_rank: number;
  source: string[];
}

// PLAN.md §3 — FSRS card fields per card
export interface Card {
  id: string; // e.g. "hund.rec" or "hund.prod"
  wordId: string;
  type: 'recognition' | 'production';
  // ts-fsrs fields
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
  last_review: Date | null;
}

// PLAN.md §3 — append-only review log
export interface ReviewLog {
  id?: number; // auto-increment
  cardId: string;
  wordId: string;
  rating: number; // 1=Again, 2=Hard, 3=Good, 4=Easy
  review: Date;
  elapsed_ms: number;
}

export interface Session {
  id?: number;
  started: Date;
  ended: Date | null;
  cards_reviewed: number;
  new_cards: number;
  minutes: number;
}

export interface Settings {
  id: number; // always 1
  daily_goal_minutes: number;
  new_cards_per_day: number;
  review_cap: number;
  reduced_motion: 'auto' | 'on' | 'off';
  data_version: string;
}

const db = new Dexie('Wortgarten') as Dexie & {
  words: Table<Word>;
  cards: Table<Card>;
  reviewLogs: Table<ReviewLog>;
  sessions: Table<Session>;
  settings: Table<Settings>;
};

db.version(1).stores({
  words: 'id, freq_rank, cefr, theme',
  cards: 'id, wordId, type, due, state',
  reviewLogs: '++id, cardId, wordId, review',
  sessions: '++id, started',
  settings: 'id',
});

export { db };
