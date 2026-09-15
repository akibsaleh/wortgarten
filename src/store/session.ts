/**
 * Zustand store for session UI state. SRS state lives in Dexie (IndexedDB),
 * not in memory — this store holds ephemeral session state only.
 *
 * P2-T3: The queue carries SessionCard.cardType ('production' | 'recognition' |
 * 'cloze' | 'audio') and optional clozeText. The current card's interaction
 * type is accessed via queue[currentIndex].cardType — no separate state field
 * needed since it changes only when currentIndex advances (handled by nextCard).
 */
import { create } from 'zustand';
import type { SessionCard } from '../session/compose';
import type { GradeResult } from '../scheduler/grading';

export interface SessionState {
  /** Cards in the current session queue. */
  queue: SessionCard[];
  /** Index of the current card in the queue. */
  currentIndex: number;
  /** Whether the card has been flipped (revealed). */
  flipped: boolean;
  /** User's typed answer. */
  answer: string;
  /** Grading result after submission (null = not yet graded). */
  grading: GradeResult | null;
  /** Correct form shown in feedback. */
  correctForm: string | null;
  /** Session start time. */
  startedAt: number | null;
  /** Cards reviewed in this session. */
  reviewed: number;
  /** Correct answers. */
  correct: number;
  /** Session is complete. */
  complete: boolean;

  // Actions
  startSession: (cards: SessionCard[]) => void;
  flip: () => void;
  setAnswer: (answer: string) => void;
  submitAnswer: (grade: GradeResult, correctForm: string) => void;
  nextCard: () => void;
  endSession: () => void;
  reset: () => void;
}

const initialState = {
  queue: [],
  currentIndex: 0,
  flipped: false,
  answer: '',
  grading: null,
  correctForm: null,
  startedAt: null,
  reviewed: 0,
  correct: 0,
  complete: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  startSession: (cards) =>
    set({
      ...initialState,
      queue: cards,
      startedAt: Date.now(),
    }),

  flip: () => set({ flipped: true }),

  setAnswer: (answer) => set({ answer }),

  submitAnswer: (grade, correctForm) =>
    set((s) => ({
      grading: grade,
      correctForm,
      reviewed: s.reviewed + 1,
      correct: s.correct + (grade === 'correct' ? 1 : 0),
    })),

  nextCard: () =>
    set((s) => {
      const next = s.currentIndex + 1;
      if (next >= s.queue.length) {
        return { complete: true };
      }
      return {
        currentIndex: next,
        flipped: false,
        answer: '',
        grading: null,
        correctForm: null,
      };
    }),

  endSession: () => set({ complete: true }),

  reset: () => set(initialState),
}));
