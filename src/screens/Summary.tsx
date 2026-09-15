import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session';
import { completeStreakDay, type StreakState } from '../streaks/StreakManager';
import { db } from '../db/schema';

export function Summary() {
  const navigate = useNavigate();
  const { reviewed, correct, startedAt, reset } = useSessionStore();
  const [streak, setStreak] = useState<StreakState | null>(null);

  const elapsed = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  const retention = reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0;

  useEffect(() => {
    async function checkGoal() {
      const settings = await db.settings.get(1);
      if (!settings) return;
      // Check if the session met the daily goal (in minutes)
      const sessionMinutes = elapsed / 60;
      if (sessionMinutes >= settings.daily_goal_minutes || min >= settings.daily_goal_minutes) {
        const state = await completeStreakDay();
        setStreak(state);
      }
    }
    if (startedAt) {
      checkGoal();
    }
  }, [startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDone() {
    reset();
    navigate('/');
  }

  return (
    <main className="summary" id="main-content">
      <div className="summary-ripple" aria-hidden="true" />
      <h2 className="summary-title">
        Session complete
      </h2>

      <div className="summary-stats">
        <div className="stat">
          <span className="stat-value">{reviewed}</span>
          <span className="stat-label">cards reviewed</span>
        </div>
        <div className="stat">
          <span className="stat-value">{retention}%</span>
          <span className="stat-label">retention</span>
        </div>
        <div className="stat">
          <span className="stat-value">{min}:{sec.toString().padStart(2, '0')}</span>
          <span className="stat-label">time</span>
        </div>
      </div>

      {/* Calm streak update — no guilt */}
      {streak && streak.current > 0 && (
        <p className="streak-summary" aria-label={`Streak: ${streak.current} days`}>
          🔥 {streak.current} day streak
          {streak.freezes > 0 && ` · ${streak.freezes} freeze${streak.freezes > 1 ? 's' : ''}`}
        </p>
      )}

      <button onClick={handleDone} className="btn-primary">
        Done
      </button>
    </main>
  );
}
