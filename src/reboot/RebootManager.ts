/**
 * P3-T4: Lapsed/dormant reboot flow per PLAN.md §5.
 *
 * Detects user absence, caps backlog, creates diagnostic sessions,
 * and provides encouraging welcome-back copy. Guilt copy is banned.
 */
import { db, type Card } from '../db/schema';
import { todayString, daysBetween } from '../streaks/StreakManager';
import type { SessionCard } from '../session/compose';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AbsenceType = 'active' | 'lapsed' | 'dormant';

export interface AbsenceInfo {
  type: AbsenceType;
  /** Number of days since last session, or -1 if never. */
  daysSinceLastSession: number;
}

export interface BacklogCapResult {
  /** Cards included in today's visible queue (max 50). */
  visible: Card[];
  /** Cards deferred to following days, ordered by retrievability. */
  deferred: Card[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum visible backlog per day for lapsed/dormant users. */
const BACKLOG_DAILY_CAP = 50;

/** Minimum interval (in days) for a card to be considered "mature". */
const MATURE_INTERVAL_DAYS = 21;

/** Number of cards in a diagnostic session. */
const DIAGNOSTIC_CARD_COUNT = 10;

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Check when the user last had a session and classify the absence.
 *
 * - active:  last session ≤ 2 days ago (or never, for brand-new users)
 * - lapsed:  3–13 days since last session
 * - dormant: 14+ days since last session
 */
export async function detectAbsence(now: Date = new Date()): Promise<AbsenceInfo> {
  const settings = await db.settings.get(1);
  const lastDate = settings?.last_session_date ?? null;

  if (!lastDate) {
    // No sessions ever — treat as active (new user)
    return { type: 'active', daysSinceLastSession: -1 };
  }

  const today = todayString(now);
  const gap = daysBetween(lastDate, today);

  if (gap <= 2) {
    return { type: 'active', daysSinceLastSession: gap };
  } else if (gap <= 13) {
    return { type: 'lapsed', daysSinceLastSession: gap };
  } else {
    return { type: 'dormant', daysSinceLastSession: gap };
  }
}

// ── Backlog capping ───────────────────────────────────────────────────────────

/**
 * Limit the visible due queue to 50/day for lapsed/dormant users.
 * The remainder is redistributed by FSRS retrievability over the following days
 * (most-forgotten first), so the curve re-stabilizes naturally.
 *
 * For active users, returns all due cards without capping.
 */
export async function capBacklog(
  absenceType: AbsenceType,
): Promise<BacklogCapResult> {
  const now = new Date();
  const allDue = await db.cards
    .where('due')
    .belowOrEqual(now)
    .toArray();

  // Active users see everything — no cap
  if (absenceType === 'active') {
    return { visible: allDue, deferred: [] };
  }

  // Sort by state (Relearning first, then Review, then Learning),
  // then by due date ascending (most overdue first)
  allDue.sort((a, b) => {
    if (a.state !== b.state) return a.state - b.state;
    return a.due.getTime() - b.due.getTime();
  });

  const visible = allDue.slice(0, BACKLOG_DAILY_CAP);
  const deferred = allDue.slice(BACKLOG_DAILY_CAP);

  // Redistribute deferred cards: push their due dates forward
  // by spreading them over the following days based on retrievability
  // (most-forgotten first = highest priority earliest)
  await redistributeDeferred(deferred);

  return { visible, deferred };
}

/**
 * Spread deferred cards across future days.
 * Cards with lower stability (more forgotten) get scheduled sooner.
 * Each day gets up to BACKLOG_DAILY_CAP cards.
 */
async function redistributeDeferred(deferred: Card[]): Promise<void> {
  if (deferred.length === 0) return;

  // Sort by stability ascending — lowest stability = most forgotten = schedule first
  const byRetrievability = [...deferred].sort((a, b) => a.stability - b.stability);

  const today = new Date();
  const updates: { id: string; due: Date }[] = [];

  for (let i = 0; i < byRetrievability.length; i++) {
    const card = byRetrievability[i]!;
    // Spread across days: card 0-49 go to tomorrow, 50-99 to day after, etc.
    const dayOffset = 1 + Math.floor(i / BACKLOG_DAILY_CAP);
    const newDue = new Date(today);
    newDue.setDate(newDue.getDate() + dayOffset);
    // Set to morning time to avoid edge cases
    newDue.setHours(9, 0, 0, 0);
    updates.push({ id: card.id, due: newDue });
  }

  // Batch update
  await db.transaction('rw', db.cards, async () => {
    for (const u of updates) {
      await db.cards.update(u.id, { due: u.due });
    }
  });
}

// ── Diagnostic session ────────────────────────────────────────────────────────

/**
 * Create a 10-card diagnostic session mixing previously mature cards
 * (interval ≥ 21 days) with young cards to re-estimate memory state.
 *
 * This is used on the first session back for lapsed/dormant users.
 */
export async function createDiagnosticSession(): Promise<SessionCard[]> {
  const allCards = await db.cards.toArray();

  // Separate into mature and young
  const mature = allCards.filter(
    (c) => c.scheduled_days >= MATURE_INTERVAL_DAYS && c.state === 2, // state 2 = Review
  );
  const young = allCards.filter(
    (c) => c.scheduled_days < MATURE_INTERVAL_DAYS || c.state !== 2,
  );

  // Pick up to 5 mature and 5 young (10 total)
  const matureCount = Math.min(5, mature.length);
  const youngCount = Math.min(DIAGNOSTIC_CARD_COUNT - matureCount, young.length);
  const selected = [
    ...shuffle(mature).slice(0, matureCount),
    ...shuffle(young).slice(0, youngCount),
  ];

  // Fill remaining if not enough mature/young
  if (selected.length < DIAGNOSTIC_CARD_COUNT) {
    const usedIds = new Set(selected.map((c) => c.id));
    const remaining = allCards.filter((c) => !usedIds.has(c.id));
    const extra = shuffle(remaining).slice(0, DIAGNOSTIC_CARD_COUNT - selected.length);
    selected.push(...extra);
  }

  // Load word data
  const wordIds = [...new Set(selected.map((c) => c.wordId))];
  const words = await db.words.where('id').anyOf(wordIds).toArray();
  const wordMap = new Map(words.map((w) => [w.id, w]));

  // Build SessionCards
  const sessionCards: SessionCard[] = [];
  for (const card of selected) {
    const word = wordMap.get(card.wordId);
    if (!word) continue;

    const isMature = card.scheduled_days >= MATURE_INTERVAL_DAYS && card.state === 2;
    sessionCards.push({
      card,
      word,
      kind: isMature ? 'review' : 'new',
      cardType: 'production', // default; will be reassigned by assignCardTypes if needed
    });
  }

  return sessionCards;
}

// ── Welcome messages ──────────────────────────────────────────────────────────

/**
 * Return an encouraging, guilt-free welcome-back message.
 *
 * Rules (PLAN.md §5):
 * - NEVER say "You lost your streak", "You missed X days", or "Start over"
 * - Lapsed: acknowledge return, emphasise curation
 * - Dormant: acknowledge return, emphasise ease
 */
export function getWelcomeBackMessage(absenceType: AbsenceType): string | null {
  switch (absenceType) {
    case 'active':
      return null; // No special message for active users
    case 'lapsed':
      return "Welcome back. There's nothing to catch up on — we've picked out what matters.";
    case 'dormant':
      return "Good to see you again. We've organized everything so you can ease back in.";
  }
}

/** Greeting for streak restart on comeback — warm, no guilt. */
export function getDayOneCopy(): string {
  return 'Day 1 — nice to see you';
}

/** Check if a string contains any guilt phrases (used in tests). */
const GUILT_PHRASES = [
  'lost your streak',
  'missed',
  'start over',
  'you missed',
  'streak lost',
  'missed x days',
  'missed days',
  'begin again',
  'reset your streak',
];

export function containsGuiltPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return GUILT_PHRASES.some((phrase) => lower.includes(phrase));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i]!, result[j]!] = [result[j]!, result[i]!];
  }
  return result;
}
