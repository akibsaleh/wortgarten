/**
 * P3-T4: Welcome-back screen for returning users (lapsed/dormant).
 *
 * Shows encouraging copy, a short comeback session button (5 min, diagnostic),
 * and restarts the streak at 1 with calm copy. No backlog dump, no guilt.
 * After the first comeback session, normal Home resumes.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importWords } from '../db';
import {
  detectAbsence,
  createDiagnosticSession,
  getWelcomeBackMessage,
  getDayOneCopy,
} from '../reboot/RebootManager';
import { useSessionStore } from '../store/session';
import { checkStreak, completeStreakDay } from '../streaks/StreakManager';

export function WelcomeBack() {
  const navigate = useNavigate();
  const startSession = useSessionStore((s) => s.startSession);
  const [welcomeMsg, setWelcomeMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      await importWords();
      const info = await detectAbsence();
      setWelcomeMsg(getWelcomeBackMessage(info.type));
      setLoading(false);
    }
    void init();
  }, []);

  async function handleComebackSession() {
    const cards = await createDiagnosticSession();
    if (cards.length === 0) return;

    // Reset streak to 1 with calm copy
    await checkStreak();
    await completeStreakDay();

    startSession(cards);
    navigate('/session');

    // After session, the Summary → Done flow navigates back to /.
    // App.tsx RequireRebootAware checks sessionStorage to skip the
    // welcome-back screen on the next render.
    sessionStorage.setItem('p3t4_comeback_done', 'true');
  }

  if (loading) {
    return (
      <main className="home" id="main-content">
        <p className="loading-text">Loading…</p>
      </main>
    );
  }

  return (
    <main className="home welcome-back" id="main-content">
      <h1 className="home-title">Wortgarten</h1>

      {/* Welcome-back message — encouraging, guilt-free */}
      {welcomeMsg && (
        <p className="welcome-back-message" role="status">
          {welcomeMsg}
        </p>
      )}

      {/* Day 1 streak restart */}
      <p className="streak-day-one" aria-label="Day 1 of your streak">
        {getDayOneCopy()}
      </p>

      {/* Comeback session button — 5 minutes, diagnostic */}
      <button
        onClick={handleComebackSession}
        className="btn-primary"
        aria-label="Start a short comeback session"
      >
        Start comeback session
      </button>
      <p className="welcome-back-hint">
        5 minutes · diagnostic review
      </p>
    </main>
  );
}
