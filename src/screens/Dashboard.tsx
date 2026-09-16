import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { ProgressRing } from '../components/ProgressRing';
import { getStreakState, type StreakState } from '../streaks/StreakManager';

const TOTAL_WORDS = 1000;

/** Corpus-linguistics coverage at full 1 000-word mastery. */
const MAX_COVERAGE = { spoken: 83, fiction: 72, nonFiction: 65 };

/**
 * Cubic-root model: coverage scales faster early on, matching
 * real corpus data (≈60% spoken at 340 words → ≈83% at 1 000).
 */
function estimateCoverage(reviewed: number, maxPct: number): number {
  if (reviewed <= 0) return 0;
  return Math.round(maxPct * Math.pow(reviewed / TOTAL_WORDS, 1 / 3));
}

interface DashboardData {
  reviewedCount: number;
  retention30: number;
  streak: StreakState;
  bands: { A1: number; A2: number; B1: number };
}

export function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function load() {
      // Words with at least one reviewed card
      const cards = await db.cards.toArray();
      const reviewedWordIds = new Set(
        cards.filter((c) => c.reps > 0).map((c) => c.wordId),
      );
      const reviewedCount = reviewedWordIds.size;

      // 30-day retention: correct answers / total answers
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const logs = await db.reviewLogs
        .where('review')
        .aboveOrEqual(thirtyDaysAgo)
        .toArray();
      const correctAnswers = logs.filter((l) => l.rating >= 3).length;
      const retention30 =
        logs.length > 0
          ? Math.round((correctAnswers / logs.length) * 100)
          : 0;

      // Streak from settings (managed by StreakManager)
      const streak = await getStreakState();

      // CEFR band breakdown
      const words = await db.words.toArray();
      const bands = { A1: 0, A2: 0, B1: 0 };
      for (const w of words) {
        if (w.cefr === 'A1' || w.cefr === 'A2' || w.cefr === 'B1') {
          bands[w.cefr]++;
        }
      }

      setData({ reviewedCount, retention30, streak, bands });
    }
    load();
  }, []);

  if (!data) {
    return (
      <main className="dashboard" id="main-content">
        <p className="loading-text">Loading…</p>
      </main>
    );
  }

  const spokenCov = estimateCoverage(data.reviewedCount, MAX_COVERAGE.spoken);
  const fictionCov = estimateCoverage(data.reviewedCount, MAX_COVERAGE.fiction);
  const nonFictionCov = estimateCoverage(
    data.reviewedCount,
    MAX_COVERAGE.nonFiction,
  );

  return (
    <main className="dashboard" id="main-content">
      <h2 className="dashboard-title">Progress</h2>

      {/* ---- Three rings ---- */}
      <div className="dashboard-rings">
        <div className="ring-item" role="figure" aria-label={`Core coverage: ${data.reviewedCount} of ${TOTAL_WORDS} words`}>
          <ProgressRing
            value={data.reviewedCount / TOTAL_WORDS}
            color="var(--color-accent)"
            label="Core coverage"
          />
          <span className="ring-label" aria-hidden="true">Core coverage</span>
        </div>
        <div className="ring-item" role="figure" aria-label={`30-day retention: ${data.retention30}%`}>
          <ProgressRing
            value={data.retention30 / 100}
            color="var(--color-der)"
            label="30-day retention"
          />
          <span className="ring-label" aria-hidden="true">30-day retention</span>
        </div>
        <div className="ring-item" role="figure" aria-label={`Streak: ${data.streak.current} days`}>
          <ProgressRing
            value={Math.min(data.streak.current / 30, 1)}
            color="var(--color-das)"
            label="Streak"
          />
          <span className="ring-label" aria-hidden="true">Streak</span>
        </div>
      </div>

      {/* ---- Honest copy ---- */}
      <p className="dashboard-honest-copy">
        These <strong>{data.reviewedCount}</strong> words cover about ~{spokenCov}%
        {' '}of spoken German you&apos;ll hear.
      </p>

      <div className="dashboard-registers">
        <span>~{nonFictionCov}% non-fiction</span>
        <span>~{fictionCov}% fiction</span>
        <span>~{spokenCov}% spoken</span>
      </div>

      {/* ---- CEFR band breakdown ---- */}
      <div className="dashboard-bands">
        <h3 className="dashboard-bands-title">Words by level</h3>
        {(['A1', 'A2', 'B1'] as const).map((level) => (
          <div className="band-row" key={level}>
            <span className="band-label">{level}</span>
            <div className="band-bar-track">
              <div
                className="band-bar"
                style={{
                  transform: `scaleX(${data.bands[level] / TOTAL_WORDS})`,
                }}
              />
            </div>
            <span className="band-count">{data.bands[level]}</span>
          </div>
        ))}
      </div>

      {/* ---- Back button ---- */}
      <button
        onClick={() => navigate('/')}
        className="btn-back"
        aria-label="Back to home"
      >
        ← Back
      </button>
    </main>
  );
}
