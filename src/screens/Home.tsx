import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importWords, db } from '../db';
import { composeSession } from '../session/compose';
import { useSessionStore } from '../store/session';
import {
  getStreakState,
  applyRepair,
  checkStreak,
  type StreakState,
} from '../streaks/StreakManager';

export function Home() {
  const navigate = useNavigate();
  const startSession = useSessionStore((s) => s.startSession);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [freezeMessage, setFreezeMessage] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      await importWords();

      // Check for missed days / freeze on load
      const result = await checkStreak();
      if (result.freezeUsed) {
        setFreezeMessage('Rest day — your streak is safe');
        // Auto-clear the message after a few seconds
        setTimeout(() => setFreezeMessage(null), 5000);
      }

      const s = await getStreakState();
      setStreak(s);

      const now = new Date();
      const due = await db.cards.where('due').belowOrEqual(now).count();
      setDueCount(due);
      setLoading(false);
    }
    init();
  }, []);

  async function handleStart() {
    const cards = await composeSession({ targetMinutes: 10 });
    if (cards.length === 0) return;
    startSession(cards);
    navigate('/session');
  }

  async function handleRepair() {
    const updated = await applyRepair();
    setStreak(updated);
  }

  if (loading) {
    return (
      <main className="home">
        <p style={{ color: 'var(--color-neutral-3)' }}>Loading…</p>
      </main>
    );
  }

  return (
    <main className="home">
      <h1 className="home-title">Wortgarten</h1>
      <p className="home-subtitle">
        {dueCount > 0 ? `${dueCount} cards due` : 'All caught up'}
      </p>

      {/* Streak display — small, off to the side */}
      {streak && streak.current > 0 && (
        <p className="streak-count" aria-label={`${streak.current} day streak`}>
          🔥 {streak.current}
        </p>
      )}

      {/* Calm freeze message */}
      {freezeMessage && (
        <p className="streak-freeze-note" role="status">
          {freezeMessage}
        </p>
      )}

      {/* Calm nudge: repair option (no guilt copy) */}
      {streak?.repairAvailable && (
        <p className="streak-repair-nudge" role="status">
          5 minutes rebuilds your streak
          <button
            onClick={handleRepair}
            className="btn-text"
            aria-label="Rebuild streak"
            style={{ marginLeft: '8px' }}
          >
            Rebuild
          </button>
        </p>
      )}

      <button
        onClick={handleStart}
        disabled={dueCount === 0}
        className="btn-primary"
        aria-label="Begin learning session"
      >
        Begin session
      </button>
      <button
        onClick={() => navigate('/dashboard')}
        className="btn-link"
        aria-label="View progress dashboard"
      >
        View progress
      </button>
    </main>
  );
}
