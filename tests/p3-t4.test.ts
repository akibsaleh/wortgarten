/**
 * P3-T4: Tests for the lapsed/dormant reboot flow per PLAN.md §5.
 *
 * Covers:
 *  - Absence detection (lapsed, dormant, active)
 *  - Backlog capping at 50
 *  - Diagnostic session card count
 *  - Welcome-back messages contain no guilt phrases
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db, type Word, type Card } from '../src/db/schema';
import { todayString, daysBetween } from '../src/streaks/StreakManager';
import {
  detectAbsence,
  capBacklog,
  createDiagnosticSession,
  getWelcomeBackMessage,
  getDayOneCopy,
  containsGuiltPhrase,
} from '../src/reboot/RebootManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a UTC YYYY-MM-DD string offset by `days` from today. */
function utcDateOffset(days: number): string {
  const d = new Date();
  // Work in UTC to avoid timezone issues
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60_000;
  const utcDate = new Date(utcMs + days * 86_400_000);
  return utcDate.toISOString().slice(0, 10);
}

function makeWord(overrides: Partial<Word>): Word {
  return {
    id: 'test-word',
    lemma: 'test',
    gender: null,
    plural: null,
    pos: 'adj',
    gloss_en: 'test',
    example_de: 'Das ist ein Test.',
    example_en: 'This is a test.',
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
    ...overrides,
  };
}

function makeCard(overrides: Partial<Card>): Card {
  return {
    id: 'test-word.rec',
    wordId: 'test-word',
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
    ...overrides,
  };
}

/** Seed a word with a card into the DB. */
async function seedWordCard(
  wordOverrides: Partial<Word>,
  cardOverrides: Partial<Card> = {},
) {
  const word = makeWord(wordOverrides);
  const card = makeCard({
    wordId: word.id,
    id: `${word.id}.rec`,
    ...cardOverrides,
  });
  await db.words.put(word);
  await db.cards.put(card);
  return { word, card };
}

/** Build a minimal settings object for tests. */
function makeSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    daily_goal_minutes: 10,
    new_cards_per_day: 10,
    review_cap: 60,
    reduced_motion: 'auto' as const,
    data_version: 'test',
    streak_current: 0,
    streak_best: 0,
    streak_freezes: 0,
    streak_last_completed: null as string | null,
    streak_repair_used: false,
    onboarding_completed: true,
    last_session_date: null as string | null,
    ...overrides,
  };
}

// ─── 1. Absence Detection ────────────────────────────────────────────────────

describe('Absence Detection', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('3-day absence → lapsed', async () => {
    const dateStr = utcDateOffset(-3);
    await db.settings.put(makeSettings({
      last_session_date: dateStr,
    }));

    const info = await detectAbsence();
    expect(info.type).toBe('lapsed');
    expect(info.daysSinceLastSession).toBe(3);
  });

  it('14-day absence → dormant', async () => {
    const dateStr = utcDateOffset(-14);
    await db.settings.put(makeSettings({
      last_session_date: dateStr,
    }));

    const info = await detectAbsence();
    expect(info.type).toBe('dormant');
    expect(info.daysSinceLastSession).toBe(14);
  });

  it('2-day absence → active', async () => {
    const dateStr = utcDateOffset(-2);
    await db.settings.put(makeSettings({
      last_session_date: dateStr,
    }));

    const info = await detectAbsence();
    expect(info.type).toBe('active');
    expect(info.daysSinceLastSession).toBe(2);
  });

  it('no previous sessions → active (new user)', async () => {
    await db.settings.put(makeSettings({
      last_session_date: null,
    }));

    const info = await detectAbsence();
    expect(info.type).toBe('active');
    expect(info.daysSinceLastSession).toBe(-1);
  });

  it('exactly 3 days → lapsed boundary', async () => {
    const dateStr = utcDateOffset(-3);
    const today = todayString();

    await db.settings.put(makeSettings({
      last_session_date: dateStr,
    }));

    // Verify our helper produces the expected gap
    const gap = daysBetween(dateStr, today);
    expect(gap).toBe(3);

    const info = await detectAbsence();
    expect(info.type).toBe('lapsed');
  });

  it('13-day absence → lapsed (upper boundary)', async () => {
    const dateStr = utcDateOffset(-13);
    await db.settings.put(makeSettings({
      last_session_date: dateStr,
    }));

    const info = await detectAbsence();
    expect(info.type).toBe('lapsed');
    expect(info.daysSinceLastSession).toBe(13);
  });

  it('0-day absence (today) → active', async () => {
    const dateStr = todayString();
    await db.settings.put(makeSettings({
      last_session_date: dateStr,
    }));

    const info = await detectAbsence();
    expect(info.type).toBe('active');
    expect(info.daysSinceLastSession).toBe(0);
  });

  it('1-day absence → active', async () => {
    const dateStr = utcDateOffset(-1);
    await db.settings.put(makeSettings({
      last_session_date: dateStr,
    }));

    const info = await detectAbsence();
    expect(info.type).toBe('active');
    expect(info.daysSinceLastSession).toBe(1);
  });
});

// ─── 2. Backlog Capping ──────────────────────────────────────────────────────

describe('Backlog Capping', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('active users see all cards (no cap)', async () => {
    const past = new Date(Date.now() - 60_000);
    for (let i = 0; i < 60; i++) {
      await seedWordCard(
        { id: `word-${i}`, lemma: `Wort${i}`, theme: 'test' },
        { id: `word-${i}.rec`, due: past, state: 2, reps: 5 },
      );
    }

    const result = await capBacklog('active');
    expect(result.visible.length).toBe(60);
    expect(result.deferred.length).toBe(0);
  });

  it('lapsed users have backlog capped at 50', async () => {
    const past = new Date(Date.now() - 60_000);
    for (let i = 0; i < 70; i++) {
      await seedWordCard(
        { id: `cap-${i}`, lemma: `Cap${i}`, theme: 'test' },
        { id: `cap-${i}.rec`, due: past, state: 2, reps: 5 },
      );
    }

    const result = await capBacklog('lapsed');
    expect(result.visible.length).toBe(50);
    expect(result.deferred.length).toBe(20);
  });

  it('dormant users have backlog capped at 50', async () => {
    const past = new Date(Date.now() - 60_000);
    for (let i = 0; i < 60; i++) {
      await seedWordCard(
        { id: `dormant-${i}`, lemma: `Dormant${i}`, theme: 'test' },
        { id: `dormant-${i}.rec`, due: past, state: 2, reps: 5 },
      );
    }

    const result = await capBacklog('dormant');
    expect(result.visible.length).toBeLessThanOrEqual(50);
    expect(result.deferred.length).toBeGreaterThanOrEqual(10);
  });

  it('fewer than 50 due cards are not capped', async () => {
    const past = new Date(Date.now() - 60_000);
    for (let i = 0; i < 10; i++) {
      await seedWordCard(
        { id: `few-${i}`, lemma: `Few${i}`, theme: 'test' },
        { id: `few-${i}.rec`, due: past, state: 2, reps: 5 },
      );
    }

    const result = await capBacklog('lapsed');
    expect(result.visible.length).toBe(10);
    expect(result.deferred.length).toBe(0);
  });

  it('deferred cards get their due dates pushed forward', async () => {
    const past = new Date(Date.now() - 60_000);
    for (let i = 0; i < 55; i++) {
      await seedWordCard(
        { id: `push-${i}`, lemma: `Push${i}`, theme: 'test' },
        { id: `push-${i}.rec`, due: past, state: 2, reps: 5 },
      );
    }

    const result = await capBacklog('lapsed');
    expect(result.deferred.length).toBe(5);

    // Deferred cards should now have due dates in the future
    for (const card of result.deferred) {
      const freshCard = await db.cards.get(card.id);
      expect(freshCard).toBeDefined();
      expect(freshCard!.due.getTime()).toBeGreaterThan(Date.now());
    }
  });
});

// ─── 3. Diagnostic Session ──────────────────────────────────────────────────

describe('Diagnostic Session', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('diagnostic session has 10 cards', async () => {
    // Create mature cards (interval >= 21 days)
    for (let i = 0; i < 5; i++) {
      await seedWordCard(
        { id: `mature-${i}`, lemma: `Mature${i}`, theme: 'test' },
        { id: `mature-${i}.rec`, state: 2, reps: 10, scheduled_days: 25 },
      );
    }

    // Create young cards
    for (let i = 0; i < 10; i++) {
      await seedWordCard(
        { id: `young-${i}`, lemma: `Young${i}`, theme: 'test' },
        { id: `young-${i}.rec`, state: 1, reps: 2, scheduled_days: 3 },
      );
    }

    const session = await createDiagnosticSession();
    expect(session.length).toBe(10);
  });

  it('diagnostic session mixes mature and young cards', async () => {
    // Create mature cards
    for (let i = 0; i < 8; i++) {
      await seedWordCard(
        { id: `mix-mature-${i}`, lemma: `MixMature${i}`, theme: 'test' },
        { id: `mix-mature-${i}.rec`, state: 2, reps: 10, scheduled_days: 30 },
      );
    }

    // Create young cards
    for (let i = 0; i < 8; i++) {
      await seedWordCard(
        { id: `mix-young-${i}`, lemma: `MixYoung${i}`, theme: 'test' },
        { id: `mix-young-${i}.rec`, state: 1, reps: 1, scheduled_days: 2 },
      );
    }

    const session = await createDiagnosticSession();
    expect(session.length).toBe(10);

    // Should have at least one mature card (kind 'review') and one young card (kind 'new')
    const matureCards = session.filter((s) => s.kind === 'review');
    const youngCards = session.filter((s) => s.kind === 'new');
    expect(matureCards.length).toBeGreaterThan(0);
    expect(youngCards.length).toBeGreaterThan(0);
  });

  it('diagnostic session works with fewer than 10 total cards', async () => {
    for (let i = 0; i < 3; i++) {
      await seedWordCard(
        { id: `scarce-${i}`, lemma: `Scarce${i}`, theme: 'test' },
        { id: `scarce-${i}.rec`, state: 2, reps: 5, scheduled_days: 5 },
      );
    }

    const session = await createDiagnosticSession();
    expect(session.length).toBe(3);
  });
});

// ─── 4. Welcome Messages ─────────────────────────────────────────────────────

describe('Welcome-Back Messages', () => {
  it('lapsed message exists and is encouraging', () => {
    const msg = getWelcomeBackMessage('lapsed');
    expect(msg).toBeTruthy();
    expect(msg).toContain('Welcome back');
  });

  it('dormant message exists and is encouraging', () => {
    const msg = getWelcomeBackMessage('dormant');
    expect(msg).toBeTruthy();
    expect(msg).toContain('Good to see you');
  });

  it('active users get no special message', () => {
    const msg = getWelcomeBackMessage('active');
    expect(msg).toBeNull();
  });

  it('day one copy is calm and positive', () => {
    const copy = getDayOneCopy();
    expect(copy).toContain('Day 1');
    expect(copy).toContain('nice to see you');
  });

  it('welcome messages contain NO guilt phrases', () => {
    const messages = [
      getWelcomeBackMessage('lapsed'),
      getWelcomeBackMessage('dormant'),
      getDayOneCopy(),
    ].filter(Boolean) as string[];

    for (const msg of messages) {
      expect(containsGuiltPhrase(msg)).toBe(false);
      // Double-check with explicit grep-like patterns
      expect(msg.toLowerCase()).not.toContain('lost');
      expect(msg.toLowerCase()).not.toContain('missed');
      expect(msg.toLowerCase()).not.toContain('start over');
      expect(msg.toLowerCase()).not.toContain('begin again');
      expect(msg.toLowerCase()).not.toContain('reset');
    }
  });

  it('containsGuiltPhrase utility works correctly', () => {
    expect(containsGuiltPhrase('You lost your streak')).toBe(true);
    expect(containsGuiltPhrase('You missed 5 days')).toBe(true);
    expect(containsGuiltPhrase('Start over')).toBe(true);
    expect(containsGuiltPhrase('Begin again')).toBe(true);
    expect(containsGuiltPhrase('Reset your streak')).toBe(true);
    expect(containsGuiltPhrase('Welcome back. We picked what matters.')).toBe(false);
    expect(containsGuiltPhrase('Good to see you again.')).toBe(false);
    expect(containsGuiltPhrase('Day 1 — nice to see you')).toBe(false);
  });
});
