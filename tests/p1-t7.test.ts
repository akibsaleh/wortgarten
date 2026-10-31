/**
 * P1-T7: Comprehensive unit tests for grading, session composition,
 * idempotent import, and scheduler modules.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Word, Card, Settings } from '../src/db/schema';

// ─── 1. Grading Logic ──────────────────────────────────────────────────────────
import {
  grade,
  gradeCloze,
  paceFromMs,
  gradeToRating,
} from '../src/scheduler/grading';

// Helper to build a minimal Word object
function makeWord(overrides: Partial<Word>): Word {
  return {
    id: 'test-word',
    lemma: 'test',
    gender: null,
    plural: null,
    pos: 'adj',
    gloss_en: 'test',
    example_de: '',
    example_en: '',
    case_note: null,
    separable: false,
    prefix: null,
    audio_word: '',
    audio_example: '',
    image_ref: null,
    theme: 'test',
    cefr: 'A1',
    freq_rank: 999,
    source: [],
    cloze_sentence: null,
    cloze_answer: null,
    ...overrides,
  };
}

describe('Grading Logic', () => {
  describe('grade() — exact match → correct', () => {
    it('grades exact match for a noun (article + lemma)', () => {
      const word = makeWord({
        id: 'buch',
        lemma: 'Buch',
        gender: 'das',
        pos: 'noun',
      });
      const result = grade({ answer: 'das Buch', word });
      expect(result.grade).toBe('correct');
      expect(result.correctForm).toBe('das Buch');
      expect(result.article).toBe('das');
    });

    it('grades exact match for a verb', () => {
      const word = makeWord({ id: 'lernen', lemma: 'lernen', pos: 'verb' });
      const result = grade({ answer: 'lernen', word });
      expect(result.grade).toBe('correct');
      expect(result.correctForm).toBe('lernen');
      expect(result.article).toBeNull();
    });

    it('grades exact match for an adjective', () => {
      const word = makeWord({ id: 'leicht', lemma: 'leicht', pos: 'adj' });
      const result = grade({ answer: 'leicht', word });
      expect(result.grade).toBe('correct');
    });
  });

  describe('grade() — Levenshtein distance 1 → typo', () => {
    it('grades typo in noun lemma as typo (correct article)', () => {
      const word = makeWord({
        id: 'buch',
        lemma: 'Buch',
        gender: 'das',
        pos: 'noun',
      });
      // "das Buc" — one deletion away from "Buch" (Levenshtein distance 1)
      const result = grade({ answer: 'das Buc', word });
      expect(result.grade).toBe('typo');
      expect(result.correctForm).toBe('das Buch');
    });

    it('grades typo in verb as typo', () => {
      const word = makeWord({ id: 'lernen', lemma: 'lernen', pos: 'verb' });
      // "lernen" → "lernem" (one char difference)
      const result = grade({ answer: 'lernem', word });
      expect(result.grade).toBe('typo');
      expect(result.correctForm).toBe('lernen');
    });

    it('grades single-character substitution in adjective as typo', () => {
      const word = makeWord({ id: 'leicht', lemma: 'leicht', pos: 'adj' });
      // "leicht" → "leicht" - replace one char
      const result = grade({ answer: 'leicgt', word });
      expect(result.grade).toBe('typo');
      expect(result.correctForm).toBe('leicht');
    });
  });

  describe('grade() — wrong article → wrong', () => {
    it('grades wrong article on noun as wrong', () => {
      const word = makeWord({
        id: 'buch',
        lemma: 'Buch',
        gender: 'das',
        pos: 'noun',
      });
      const result = grade({ answer: 'der Buch', word });
      expect(result.grade).toBe('wrong');
      expect(result.correctForm).toBe('das Buch');
      expect(result.article).toBe('das');
    });

    it('grades der instead of die as wrong', () => {
      const word = makeWord({
        id: 'frau',
        lemma: 'Frau',
        gender: 'die',
        pos: 'noun',
      });
      const result = grade({ answer: 'der Frau', word });
      expect(result.grade).toBe('wrong');
      expect(result.article).toBe('die');
    });
  });

  describe('grade() — missing article on noun → wrong', () => {
    it('grades noun answer missing article as wrong', () => {
      const word = makeWord({
        id: 'buch',
        lemma: 'Buch',
        gender: 'das',
        pos: 'noun',
      });
      const result = grade({ answer: 'Buch', word });
      expect(result.grade).toBe('wrong');
      expect(result.correctForm).toBe('das Buch');
      expect(result.article).toBe('das');
    });
  });

  describe('grade() — umlaut fallback (ae→ä, oe→ö, ue→ü, ss→ß)', () => {
    it('accepts "ae" as "ä" for non-noun', () => {
      const word = makeWord({
        id: 'tae',
        lemma: 'Tänzer',
        pos: 'noun',
        gender: 'der',
      });
      const result = grade({ answer: 'der Taenzer', word });
      expect(result.grade).toBe('correct');
    });

    it('accepts "oe" as "ö" for non-noun', () => {
      const word = makeWord({
        id: 'o',
        lemma: 'ö',
        pos: 'noun',
        gender: 'das',
      });
      const result = grade({ answer: 'das oe', word });
      expect(result.grade).toBe('correct');
    });

    it('accepts "ue" as "ü" for noun with article', () => {
      const word = makeWord({
        id: 'uebersetzer',
        lemma: 'Übersetzer',
        pos: 'noun',
        gender: 'der',
      });
      const result = grade({ answer: 'der Uebersetzer', word });
      expect(result.grade).toBe('correct');
    });

    it('accepts "ss" as "ß" for noun with article', () => {
      const word = makeWord({
        id: 'strasse',
        lemma: 'Straße',
        pos: 'noun',
        gender: 'die',
      });
      const result = grade({ answer: 'die Strasse', word });
      expect(result.grade).toBe('correct');
    });

    it('accepts "ae" as "ä" for adjective (non-noun path)', () => {
      const word = makeWord({ id: 'ae', lemma: 'älter', pos: 'adj' });
      const result = grade({ answer: 'aelter', word });
      expect(result.grade).toBe('correct');
    });

    it('accepts "ss" as "ß" for non-noun (non-noun path)', () => {
      // "heißen" has ß; typing "heissen" should normalize to match via ss→ß fallback
      const word = makeWord({ id: 'heissen', lemma: 'heißen', pos: 'verb' });
      const result = grade({ answer: 'heissen', word });
      expect(result.grade).toBe('correct');
    });
  });

  describe('grade() — case insensitivity', () => {
    it('grades case-insensitive match for noun as correct', () => {
      const word = makeWord({
        id: 'buch',
        lemma: 'Buch',
        gender: 'das',
        pos: 'noun',
      });
      const result = grade({ answer: 'DAS buch', word });
      expect(result.grade).toBe('correct');
    });

    it('grades case-insensitive match for verb as correct', () => {
      const word = makeWord({ id: 'lernen', lemma: 'lernen', pos: 'verb' });
      const result = grade({ answer: 'LERNEN', word });
      expect(result.grade).toBe('correct');
    });

    it('grades mixed case as correct for adjective', () => {
      const word = makeWord({ id: 'leicht', lemma: 'leicht', pos: 'adj' });
      const result = grade({ answer: 'Leicht', word });
      expect(result.grade).toBe('correct');
    });
  });

  describe('paceFromMs()', () => {
    it('returns "instant" for < 2500ms', () => {
      expect(paceFromMs(0)).toBe('instant');
      expect(paceFromMs(2499)).toBe('instant');
      expect(paceFromMs(1500)).toBe('instant');
    });

    it('returns "normal" for 2500ms–20000ms', () => {
      expect(paceFromMs(2500)).toBe('normal');
      expect(paceFromMs(10000)).toBe('normal');
      expect(paceFromMs(20000)).toBe('normal');
    });

    it('returns "slow" for > 20000ms', () => {
      expect(paceFromMs(20001)).toBe('slow');
      expect(paceFromMs(30000)).toBe('slow');
      expect(paceFromMs(60000)).toBe('slow');
    });
  });

  describe('gradeToRating()', () => {
    it('maps wrong → wrong', () => {
      expect(gradeToRating('wrong', 'normal')).toBe('wrong');
      expect(gradeToRating('wrong', 'instant')).toBe('wrong');
      expect(gradeToRating('wrong', 'slow')).toBe('wrong');
    });

    it('maps typo → hard (regardless of pace)', () => {
      expect(gradeToRating('typo', 'normal')).toBe('hard');
      expect(gradeToRating('typo', 'instant')).toBe('hard');
      expect(gradeToRating('typo', 'slow')).toBe('hard');
    });

    it('maps correct + slow → hard', () => {
      expect(gradeToRating('correct', 'slow')).toBe('hard');
    });

    it('maps correct + instant → easy', () => {
      expect(gradeToRating('correct', 'instant')).toBe('easy');
    });

    it('maps correct + normal → good', () => {
      expect(gradeToRating('correct', 'normal')).toBe('good');
    });
  });

  describe('gradeCloze()', () => {
    // Per the pipeline, cloze_answer is the lemma's exact surface form as it
    // appeared in the sentence (may differ only by case, e.g. sentence start).
    it('accepts the blanked noun without an article (unlike production grading)', () => {
      const word = makeWord({
        id: 'buch',
        lemma: 'Buch',
        gender: 'das',
        pos: 'noun',
        cloze_sentence: 'Das _____ liegt auf dem Tisch.',
        cloze_answer: 'Buch',
      });
      const result = gradeCloze({ answer: 'Buch', word });
      expect(result.grade).toBe('correct');
      expect(result.correctForm).toBe('Buch');
      expect(result.article).toBeNull();
    });

    it('grades case-insensitively', () => {
      const word = makeWord({
        id: 'buch',
        lemma: 'Buch',
        pos: 'noun',
        gender: 'das',
        cloze_sentence: 'Das _____ liegt hier.',
        cloze_answer: 'Buch',
      });
      expect(gradeCloze({ answer: 'buch', word }).grade).toBe('correct');
    });

    it('grades Levenshtein ≤ 1 as typo', () => {
      const word = makeWord({
        id: 'buch',
        lemma: 'Buch',
        pos: 'noun',
        gender: 'das',
        cloze_sentence: 'Das _____ liegt hier.',
        cloze_answer: 'Buch',
      });
      expect(gradeCloze({ answer: 'Buc', word }).grade).toBe('typo');
    });

    it('accepts umlaut fallbacks', () => {
      const word = makeWord({
        id: 'strasse',
        lemma: 'Straße',
        pos: 'noun',
        gender: 'die',
        cloze_sentence: 'Die _____ ist breit.',
        cloze_answer: 'Straße',
      });
      expect(gradeCloze({ answer: 'Strasse', word }).grade).toBe('correct');
    });

    it('grades unrelated answers as wrong', () => {
      const word = makeWord({
        id: 'gehen',
        lemma: 'gehen',
        pos: 'verb',
        cloze_sentence: 'Er will nach Hause _____.',
        cloze_answer: 'gehen',
      });
      const result = gradeCloze({ answer: 'laufen', word });
      expect(result.grade).toBe('wrong');
      expect(result.correctForm).toBe('gehen');
    });

    it('falls back to the lemma when cloze_answer is null', () => {
      const word = makeWord({ id: 'gehen', lemma: 'gehen', pos: 'verb' });
      expect(gradeCloze({ answer: 'gehen', word }).grade).toBe('correct');
    });
  });
});

// ─── 2. Session Composition ─────────────────────────────────────────────────────
// These tests need the real Dexie db, so we set up the database in each test.

import { db } from '../src/db/schema';
import {
  composeSession,
  assignCardTypes,
  type SessionCard,
} from '../src/session/compose';

/** Seed helper: insert a word + optionally make it due for review. */
async function seedWord(
  word: Word,
  opts: {
    due?: Date;
    state?: number;
    reps?: number;
    introducedAt?: Date | null;
  } = {},
) {
  await db.words.put(word);

  const recId = `${word.id}.rec`;
  const prodId = `${word.id}.prod`;

  const now = new Date();
  const due = opts.due ?? now;
  const introducedAt = opts.introducedAt ?? null;

  await db.cards.put({
    id: recId,
    wordId: word.id,
    type: 'recognition',
    due,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: opts.reps ?? 0,
    lapses: 0,
    state: opts.state ?? 0,
    last_review: null,
    introduced_at: introducedAt,
  });
  await db.cards.put({
    id: prodId,
    wordId: word.id,
    type: 'production',
    due,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: opts.reps ?? 0,
    lapses: 0,
    state: opts.state ?? 0,
    last_review: null,
    introduced_at: introducedAt,
  });
}

describe('Session Composition', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('due reviews come before new words', async () => {
    // Create review word (due in the past — will appear in dueCards query)
    const past = new Date(Date.now() - 60_000);
    const reviewWord = makeWord({
      id: 'review1',
      lemma: 'lernen',
      pos: 'verb',
      theme: 'essentials',
    });
    await seedWord(reviewWord, { due: past, state: 2, reps: 5 }); // state 2 = Review

    // Create new word with due far in the future so it's NOT picked up by dueCards query
    // (only state=0 query should pick it up)
    const future = new Date(Date.now() + 86400_000);
    const newWord = makeWord({
      id: 'new1',
      lemma: 'sprechen',
      pos: 'verb',
      theme: 'essentials',
    });
    await seedWord(newWord, { due: future, state: 0, reps: 0 });

    const session = await composeSession({
      reviewCap: 60,
      newPerDay: 10,
      targetMinutes: 10,
    });

    // The first card in the session should be the review card
    // (composeSession puts initial reviews first)
    expect(session.length).toBeGreaterThan(0);
    expect(session[0]!.kind).toBe('review');
    expect(session[0]!.card.wordId).toBe('review1');
  });

  it('review cap is respected', async () => {
    const past = new Date(Date.now() - 100_000);

    // Create 5 due review words
    for (let i = 0; i < 5; i++) {
      const w = makeWord({
        id: `rev-cap-${i}`,
        lemma: `Wort${i}`,
        pos: 'noun',
        gender: 'das',
        theme: 'test',
      });
      await seedWord(w, { due: past, state: 2, reps: 5 });
    }

    const session = await composeSession({
      reviewCap: 3,
      newPerDay: 0,
      targetMinutes: 10,
    });

    const reviewCount = session.filter((s) => s.kind === 'review').length;
    expect(reviewCount).toBeLessThanOrEqual(3);
  });

  it('new cards are grouped in thematic blocks', async () => {
    // Create new words in the same theme
    for (let i = 0; i < 4; i++) {
      const w = makeWord({
        id: `theme-a-${i}`,
        lemma: `ThemeA${i}`,
        pos: 'noun',
        gender: 'das',
        theme: 'food',
      });
      await seedWord(w, { due: new Date(), state: 0, reps: 0 });
    }

    // Create new words in a different theme
    for (let i = 0; i < 4; i++) {
      const w = makeWord({
        id: `theme-b-${i}`,
        lemma: `ThemeB${i}`,
        pos: 'noun',
        gender: 'der',
        theme: 'travel',
      });
      await seedWord(w, { due: new Date(), state: 0, reps: 0 });
    }

    const session = await composeSession({
      reviewCap: 60,
      newPerDay: 20,
      targetMinutes: 10,
    });

    const newCards = session.filter((s) => s.kind === 'new');

    // New cards should exist
    expect(newCards.length).toBeGreaterThan(0);

    // All new cards from the same theme should be contiguous (within their block)
    const themeOrder = newCards.map((s) => s.word.theme);
    // Group indices of same-theme cards
    const themeIndices = new Map<string, number[]>();
    themeOrder.forEach((t, i) => {
      if (!themeIndices.has(t)) themeIndices.set(t, []);
      themeIndices.get(t)!.push(i);
    });

    // Each theme's cards should form a contiguous block
    for (const [, indices] of themeIndices) {
      const sorted = [...indices].sort((a, b) => a - b);
      // Cards in same block are contiguous if sorted and consecutive
      for (let i = 1; i < sorted.length; i++) {
        // Between consecutive same-theme cards, there shouldn't be a card from a different theme
        // (unless interleaved with reviews — blocks are consecutive)
        if (sorted[i]! - sorted[i - 1]! === 1) {
          // Adjacent — fine
        }
        // If there's a gap, the items in between must be reviews (interleaving)
        for (let j = sorted[i - 1]! + 1; j < sorted[i]!; j++) {
          expect(session[j]!.kind).toBe('review');
        }
      }
    }
  });

  it('new cards are interleaved with reviews', async () => {
    const past = new Date(Date.now() - 60_000);

    // Create 20 due review words — more than initialReviews (ceil(67*0.3)=21)
    // so that some reviews remain for interleaving between new word blocks
    for (let i = 0; i < 20; i++) {
      const w = makeWord({
        id: `interleave-rev-${i}`,
        lemma: `InterRev${i}`,
        pos: 'verb',
        theme: 'essentials',
      });
      await seedWord(w, { due: past, state: 2, reps: 5 });
    }

    // Create 4 new words in same theme (forms 1 block of 4)
    for (let i = 0; i < 4; i++) {
      const w = makeWord({
        id: `interleave-new-${i}`,
        lemma: `InterNew${i}`,
        pos: 'noun',
        gender: 'das',
        theme: 'food',
      });
      await seedWord(w, { due: new Date(), state: 0, reps: 0 });
    }

    const session = await composeSession({
      reviewCap: 60,
      newPerDay: 10,
      targetMinutes: 10,
    });

    // Session should contain both kinds
    const hasReview = session.some((s) => s.kind === 'review');
    const hasNew = session.some((s) => s.kind === 'new');
    expect(hasReview).toBe(true);
    expect(hasNew).toBe(true);

    // With enough reviews, there should be review cards after new cards
    // (interleaving places remaining reviews between/after new blocks)
    const kinds = session.map((s) => s.kind);
    let foundReviewAfterNew = false;
    for (let i = 1; i < kinds.length; i++) {
      if (kinds[i - 1] === 'new' && kinds[i] === 'review') {
        foundReviewAfterNew = true;
        break;
      }
    }
    expect(foundReviewAfterNew).toBe(true);
  });

  it('max cards respects target minutes', async () => {
    const past = new Date(Date.now() - 60_000);

    // Create many review words
    for (let i = 0; i < 50; i++) {
      const w = makeWord({
        id: `cap-${i}`,
        lemma: `Cap${i}`,
        pos: 'verb',
        theme: 'essentials',
      });
      await seedWord(w, { due: past, state: 2, reps: 5 });
    }

    // targetMinutes=1 → maxCards = ceil(1*60/9) = ceil(6.67) = 7
    const session = await composeSession({
      reviewCap: 60,
      newPerDay: 0,
      targetMinutes: 1,
    });

    expect(session.length).toBeLessThanOrEqual(7);
  });

  it("new words enter via intro; the word's second card is recognition", async () => {
    const w = makeWord({
      id: 'intro1',
      lemma: 'schauen',
      pos: 'verb',
      theme: 'essentials',
    });
    await seedWord(w, { state: 0 });

    const session = await composeSession({
      reviewCap: 60,
      newPerDay: 10,
      targetMinutes: 10,
    });
    const mine = session.filter((s) => s.word.id === 'intro1');
    expect(mine.length).toBe(2); // rec + prod cards
    expect(mine[0]!.cardType).toBe('intro');
    expect(mine[1]!.cardType).toBe('recognition');
  });

  it('new cards with due=now are not duplicated as reviews', async () => {
    const w = makeWord({
      id: 'dup1',
      lemma: 'laufen',
      pos: 'verb',
      theme: 'essentials',
    });
    await seedWord(w, { state: 0, due: new Date() });

    const session = await composeSession({
      reviewCap: 60,
      newPerDay: 10,
      targetMinutes: 10,
    });
    const ids = session.map((s) => s.card.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      session.filter((s) => s.word.id === 'dup1' && s.kind === 'review').length,
    ).toBe(0);
  });
});

// ─── 2b. assignCardTypes() — first-exposure gate & cloze eligibility ────────────

function makeCardForWord(wordId: string, overrides: Partial<Card> = {}): Card {
  return {
    id: `${wordId}.rec`,
    wordId,
    type: 'recognition',
    due: new Date(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    last_review: null,
    introduced_at: null,
    ...overrides,
  };
}

function makeSessionCard(word: Word, card: Card): SessionCard {
  return {
    card,
    word,
    kind: card.reps === 0 && !card.introduced_at ? 'new' : 'review',
    cardType: 'recognition',
  };
}

/** Place the target card at queue position idx (position feeds the type seed). */
function atIndex(sc: SessionCard, idx: number): SessionCard[] {
  const pads = Array.from({ length: idx }, (_, i) => {
    const w = makeWord({ id: `pad-${idx}-${i}` });
    return makeSessionCard(
      w,
      makeCardForWord(w.id, { reps: 5, state: 2, introduced_at: new Date() }),
    );
  });
  return [...pads, sc];
}

describe('assignCardTypes() — first-exposure gate', () => {
  it('first card of an unseen word is intro, second is recognition', () => {
    const word = makeWord({ id: 'neu1', lemma: 'schauen', pos: 'verb' });
    const rec = makeCardForWord('neu1');
    const prod = makeCardForWord('neu1', {
      id: 'neu1.prod',
      type: 'production',
    });
    const result = assignCardTypes([
      makeSessionCard(word, rec),
      makeSessionCard(word, prod),
    ]);
    expect(result[0]!.cardType).toBe('intro');
    expect(result[1]!.cardType).toBe('recognition');
  });

  it('an introduced word with reps ≥ 2 never gets intro', () => {
    const word = makeWord({ id: 'alt1', lemma: 'laufen', pos: 'verb' });
    const card = makeCardForWord('alt1', {
      reps: 5,
      state: 2,
      introduced_at: new Date(),
    });
    for (let idx = 0; idx < 15; idx++) {
      const result = assignCardTypes(atIndex(makeSessionCard(word, card), idx));
      expect(result[idx]!.cardType).not.toBe('intro');
    }
  });

  it('an introduced word with reps < 2 stays on recognition', () => {
    const word = makeWord({ id: 'jung1', lemma: 'gehen', pos: 'verb' });
    const card = makeCardForWord('jung1', {
      reps: 1,
      state: 1,
      introduced_at: new Date(),
    });
    for (let idx = 0; idx < 15; idx++) {
      const result = assignCardTypes(atIndex(makeSessionCard(word, card), idx));
      expect(result[idx]!.cardType).toBe('recognition');
    }
  });
});

describe('assignCardTypes() — cloze eligibility', () => {
  it('a word without pipeline cloze data never receives cloze', () => {
    // Separable verb: lemma never appears verbatim → cloze_sentence null
    const word = makeWord({
      id: 'nocloze',
      lemma: 'abbiegen',
      pos: 'verb',
      audio_word: '',
    });
    const card = makeCardForWord('nocloze', {
      reps: 5,
      state: 2,
      introduced_at: new Date(),
    });
    for (let idx = 0; idx < 25; idx++) {
      const result = assignCardTypes(atIndex(makeSessionCard(word, card), idx));
      expect(result[idx]!.cardType).not.toBe('cloze');
    }
  });

  it('a word with cloze data receives cloze at some positions, carrying the pipeline sentence', () => {
    const word = makeWord({
      id: 'buch',
      lemma: 'Buch',
      pos: 'noun',
      gender: 'das',
      audio_word: '', // no-audio branch: seed ≥ 0.85 → cloze
      example_de: 'Das Buch liegt auf dem Tisch.',
      cloze_sentence: 'Das _____ liegt auf dem Tisch.',
      cloze_answer: 'Buch',
    });
    const card = makeCardForWord('buch', {
      reps: 5,
      state: 2,
      introduced_at: new Date(),
    });
    let sawCloze = false;
    for (let idx = 0; idx < 100; idx++) {
      const got = assignCardTypes(atIndex(makeSessionCard(word, card), idx))[
        idx
      ]!;
      if (got.cardType === 'cloze') {
        sawCloze = true;
        expect(got.clozeText).toBe('Das _____ liegt auf dem Tisch.');
      }
    }
    expect(sawCloze).toBe(true);
  });
});

// ─── 3. Idempotent Import ───────────────────────────────────────────────────────
import { importWords } from '../src/db/import';
import wordsData from '../src/assets/words.json';

describe('Idempotent Import', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('first import creates words and cards', async () => {
    const result = await importWords();

    expect(result.imported).toBe(wordsData.words.length);
    expect(result.skipped).toBe(0);

    const wordCount = await db.words.count();
    expect(wordCount).toBe(wordsData.words.length);

    const cardCount = await db.cards.count();
    // Each word gets 2 cards (recognition + production)
    expect(cardCount).toBe(wordsData.words.length * 2);
  });

  it('re-import with same dataVersion is a no-op', async () => {
    // First import
    const first = await importWords();
    expect(first.imported).toBe(wordsData.words.length);

    // Re-import — should be skipped
    const second = await importWords();
    expect(second.imported).toBe(0);
    expect(second.skipped).toBe(wordsData.words.length);

    // Word and card counts should be the same
    const wordCount = await db.words.count();
    const cardCount = await db.cards.count();
    expect(wordCount).toBe(wordsData.words.length);
    expect(cardCount).toBe(wordsData.words.length * 2);
  });

  it('cards survive dataVersion bump (word content updates, SRS state preserved)', async () => {
    // First import
    await importWords();

    // Simulate user progress: update a card's SRS state
    const firstCard = (await db.cards.toArray())[0]!;
    await db.cards.update(firstCard.id, {
      state: 2, // Review
      reps: 5,
      stability: 10,
      difficulty: 3,
    });

    // Get current data_version to manipulate it
    const settings = await db.settings.get(1);
    expect(settings).toBeDefined();

    // Force a version bump by clearing settings data_version
    await db.settings.update(1, { data_version: 'old-version' });

    // Re-import — should update words and create cards for new words only
    const result = await importWords();
    expect(result.imported).toBe(wordsData.words.length);

    // Check the card that had SRS state is preserved
    const updatedCard = await db.cards.get(firstCard.id);
    expect(updatedCard).toBeDefined();
    expect(updatedCard!.state).toBe(2);
    expect(updatedCard!.reps).toBe(5);
    expect(updatedCard!.stability).toBe(10);
    expect(updatedCard!.difficulty).toBe(3);

    // Word content should be updated (bulkPut upserts)
    const word = await db.words.get('am');
    expect(word).toBeDefined();
    expect(word!.lemma).toBe('am');
  });
});

// ─── 4. Scheduler ───────────────────────────────────────────────────────────────
import { newCard, rateCard, outcomeToRating } from '../src/scheduler/index';
import { Rating, State } from 'ts-fsrs';

describe('Scheduler', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  describe('newCard()', () => {
    it('returns correct initial state for a recognition card', () => {
      const card = newCard('hund', 'recognition');

      expect(card.id).toBe('hund.rec');
      expect(card.wordId).toBe('hund');
      expect(card.type).toBe('recognition');
      expect(card.stability).toBe(0);
      expect(card.difficulty).toBe(0);
      expect(card.elapsed_days).toBe(0);
      expect(card.scheduled_days).toBe(0);
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.state).toBe(State.New);
      expect(card.last_review).toBeNull();
      expect(card.due).toBeInstanceOf(Date);
    });

    it('returns correct initial state for a production card', () => {
      const card = newCard('hund', 'production');

      expect(card.id).toBe('hund.prod');
      expect(card.type).toBe('production');
      expect(card.state).toBe(State.New);
      expect(card.reps).toBe(0);
    });

    it('creates unique card ids for different word ids', () => {
      const card1 = newCard('hund', 'recognition');
      const card2 = newCard('katze', 'recognition');

      expect(card1.id).not.toBe(card2.id);
      expect(card1.id).toBe('hund.rec');
      expect(card2.id).toBe('katze.rec');
    });
  });

  describe('rateCard()', () => {
    it('throws if card not found', async () => {
      await expect(rateCard('nonexistent', Rating.Good, 5000)).rejects.toThrow(
        'Card not found: nonexistent',
      );
    });

    it('persists card update and review log', async () => {
      // First, insert a card into the database
      const card: Card = {
        id: 'test.rec',
        wordId: 'test',
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
        introduced_at: null,
      };
      await db.cards.put(card);

      // Rate the card
      const elapsedMs = 3000;
      const { card: updated, log } = await rateCard(
        'test.rec',
        Rating.Good,
        elapsedMs,
      );

      // Card should be updated
      expect(updated.id).toBe('test.rec');
      expect(updated.reps).toBeGreaterThan(0);
      expect(updated.last_review).toBeInstanceOf(Date);
      expect(updated.state).not.toBe(0); // Should have moved from New

      // Review log should be persisted
      const logs = await db.reviewLogs
        .where('cardId')
        .equals('test.rec')
        .toArray();
      expect(logs.length).toBe(1);
      expect(logs[0]!.rating).toBe(Rating.Good);
      expect(logs[0]!.elapsed_ms).toBe(elapsedMs);
      expect(logs[0]!.wordId).toBe('test');
      expect(logs[0]!.review).toBeInstanceOf(Date);

      // Returned log should match
      expect(log.cardId).toBe('test.rec');
      expect(log.rating).toBe(Rating.Good);
    });

    it('persists multiple reviews over time', async () => {
      const card: Card = {
        id: 'multi.rec',
        wordId: 'multi',
        type: 'recognition',
        due: new Date(),
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        last_review: null,
        introduced_at: null,
      };
      await db.cards.put(card);

      // First review
      await rateCard('multi.rec', Rating.Good, 2000);

      // Second review
      await rateCard('multi.rec', Rating.Easy, 1500);

      const logs = await db.reviewLogs
        .where('cardId')
        .equals('multi.rec')
        .toArray();
      expect(logs.length).toBe(2);

      const cardAfter = await db.cards.get('multi.rec');
      expect(cardAfter!.reps).toBe(2);
    });
  });

  describe('outcomeToRating()', () => {
    it('maps wrong to Again', () => {
      expect(outcomeToRating('wrong')).toBe(Rating.Again);
    });

    it('maps hard to Hard', () => {
      expect(outcomeToRating('hard')).toBe(Rating.Hard);
    });

    it('maps good to Good', () => {
      expect(outcomeToRating('good')).toBe(Rating.Good);
    });

    it('maps easy to Easy', () => {
      expect(outcomeToRating('easy')).toBe(Rating.Easy);
    });
  });
});
