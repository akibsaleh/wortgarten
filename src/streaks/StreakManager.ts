/**
 * PLAN.md §5 — Humane streaks with freeze / repair.
 *
 * All streak logic is optional and dismissible.
 * No guilt copy, no dark patterns.
 */
import { db, type Settings } from '../db/schema';

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Return today as a YYYY-MM-DD string. */
export function todayString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Number of whole days between two ISO date strings (b − a). */
export function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T00:00:00Z').getTime();
  const msB = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((msB - msA) / 8_640_000);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StreakState {
  current: number;
  best: number;
  freezes: number;
  lastCompleted: string | null;
  repairAvailable: boolean;
  todayMet: boolean;
  freezeAppliedToday: boolean;
}

export interface CheckResult {
  state: StreakState;
  /** True when a freeze was auto-applied during this check. */
  freezeUsed: boolean;
  /** True when the streak was lost (and no freeze could save it). */
  streakLost: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FREEZE_EARN_INTERVAL = 7; // earn one freeze every 7 streak days
const FREEZE_CAP = 3;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Called on app load. Detects missed days, applies freeze if available,
 * marks streak as lost otherwise. Returns a result the UI can act on.
 */
export async function checkStreak(now: Date = new Date()): Promise<CheckResult> {
  const settings = await db.settings.get(1);
  if (!settings) {
    return { state: defaultState(), freezeUsed: false, streakLost: false };
  }

  const today = todayString(now);
  const last = settings.streak_last_completed;

  // Fresh user — no streak yet
  if (!last) {
    return { state: settingsToState(settings, today), freezeUsed: false, streakLost: false };
  }

  const gap = daysBetween(last, today);

  // Already counted today or last completed yesterday — streak is alive
  if (gap <= 1) {
    return { state: settingsToState(settings, today), freezeUsed: false, streakLost: false };
  }

  // Missed days detected
  const missedDays = gap - 1; // e.g. gap=2 means 1 missed day between
  let freezes = settings.streak_freezes;
  let freezeUsed = false;

  if (missedDays <= freezes) {
    // Freezes can cover all missed days
    freezes -= missedDays;
    freezeUsed = true;
    await db.settings.update(1, { streak_freezes: freezes });
  } else if (missedDays > freezes && freezes > 0) {
    // Partial coverage — still not enough
    freezes = 0;
    freezeUsed = true;
    // Streak is lost
    await db.settings.update(1, {
      streak_freezes: 0,
      streak_current: 0,
      streak_last_completed: null,
    });
  } else {
    // No freezes — streak lost
    await db.settings.update(1, {
      streak_current: 0,
      streak_last_completed: null,
    });
  }

  const updated = await db.settings.get(1);
  const streakLost =
    updated?.streak_current === 0 && settings.streak_current > 0;

  return {
    state: settingsToState(updated ?? settings, today),
    freezeUsed,
    streakLost,
  };
}

/**
 * Called when the user meets their daily goal.
 * Incrests the streak, awards freezes, updates best.
 */
export async function completeStreakDay(now: Date = new Date()): Promise<StreakState> {
  const settings = await db.settings.get(1);
  if (!settings) return defaultState();

  const today = todayString(now);
  const last = settings.streak_last_completed;

  // Already counted today
  if (last === today) {
    return settingsToState(settings, today);
  }

  let newCurrent: number;
  if (!last) {
    newCurrent = 1;
  } else {
    const gap = daysBetween(last, today);
    if (gap === 1) {
      // Consecutive day
      newCurrent = settings.streak_current + 1;
    } else {
      // Missed gap (shouldn't happen if checkStreak ran, but be safe)
      newCurrent = 1;
    }
  }

  const newBest = Math.max(settings.streak_best, newCurrent);

  // Earn a freeze every FREEZE_EARN_INTERVAL days (cap FREEZE_CAP)
  let freezes = settings.streak_freezes;
  if (newCurrent % FREEZE_EARN_INTERVAL === 0 && freezes < FREEZE_CAP) {
    freezes = Math.min(freezes + 1, FREEZE_CAP);
  }

  await db.settings.update(1, {
    streak_current: newCurrent,
    streak_best: newBest,
    streak_freezes: freezes,
    streak_last_completed: today,
  });

  const updated = await db.settings.get(1);
  return settingsToState(updated ?? settings, today);
}

/**
 * One-time 5-minute rebuild session restores streak after a miss.
 * Can only be used once per lapse cycle (resets on streak loss).
 * Returns the updated state, or the same state if already used.
 */
export async function applyRepair(now: Date = new Date()): Promise<StreakState> {
  const settings = await db.settings.get(1);
  if (!settings) return defaultState();

  const today = todayString(now);

  // Already used repair for this lapse — or streak is fine
  if (settings.streak_repair_used) {
    return settingsToState(settings, today);
  }

  // Streak must be 0 for repair to make sense
  if (settings.streak_current > 0) {
    return settingsToState(settings, today);
  }

  // Restore streak to what it was before the lapse (min 1)
  const restoredStreak = Math.max(settings.streak_best, 1);

  await db.settings.update(1, {
    streak_current: restoredStreak,
    streak_last_completed: today,
    streak_repair_used: true,
  });

  const updated = await db.settings.get(1);
  return settingsToState(updated ?? settings, today);
}

/** Reset repair_used flag (called on streak loss). */
export async function resetRepairUsed(): Promise<void> {
  const settings = await db.settings.get(1);
  if (settings && settings.streak_repair_used) {
    await db.settings.update(1, { streak_repair_used: false });
  }
}

/** Return the current streak state for UI display. */
export async function getStreakState(now: Date = new Date()): Promise<StreakState> {
  const settings = await db.settings.get(1);
  if (!settings) return defaultState();
  return settingsToState(settings, todayString(now));
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function settingsToState(s: Settings, today: string): StreakState {
  return {
    current: s.streak_current,
    best: s.streak_best,
    freezes: s.streak_freezes,
    lastCompleted: s.streak_last_completed,
    repairAvailable: !s.streak_repair_used && s.streak_current === 0,
    todayMet: s.streak_last_completed === today,
    freezeAppliedToday: false,
  };
}

function defaultState(): StreakState {
  return {
    current: 0,
    best: 0,
    freezes: 0,
    lastCompleted: null,
    repairAvailable: false,
    todayMet: false,
    freezeAppliedToday: false,
  };
}
