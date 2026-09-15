import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importWords, db } from '../db';
import { composeSession } from '../session/compose';
import { useSessionStore } from '../store/session';

export function Home() {
  const navigate = useNavigate();
  const startSession = useSessionStore((s) => s.startSession);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      await importWords();
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

  if (loading) {
    return (
      <main className="home">
        <p style={{ color: 'var(--neutral-300)' }}>Loading…</p>
      </main>
    );
  }

  return (
    <main className="home">
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '39px', color: 'var(--color-ink)' }}>
        Wortgarten
      </h1>
      <p style={{ fontSize: '16px', color: 'var(--neutral-400)', marginBottom: '48px' }}>
        {dueCount > 0 ? `${dueCount} cards due` : 'All caught up'}
      </p>
      <button
        onClick={handleStart}
        disabled={dueCount === 0}
        className="btn-primary"
        aria-label="Begin learning session"
      >
        Begin session
      </button>
    </main>
  );
}
