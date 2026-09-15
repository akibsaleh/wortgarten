import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { useAudio } from '../audio/useAudio';

/* ── Practice card data (hardcoded for onboarding) ──────────────────────── */
const PRACTICE_WORD = {
  lemma: 'Hund',
  gender: 'der' as const,
  plural: 'Hunde',
  pos: 'noun' as const,
  gloss_en: 'dog',
  example_de: 'Der Hund spielt im Garten.',
};

const TEST_WORD_ID = 'hund'; // bundled in words.json

export function Onboarding() {
  const navigate = useNavigate();
  const { playWord, canPlay } = useAudio();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<5 | 10 | 15 | 20>(10);

  /* Step 2 — practice typing state */
  const [practiceFlipped, setPracticeFlipped] = useState(false);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [practiceResult, setPracticeResult] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const practiceInputRef = useRef<HTMLInputElement>(null);
  const [practiceAnnounce, setPracticeAnnounce] = useState('');

  /* Step 3 — audio check */
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [audioConfirmed, setAudioConfirmed] = useState(false);

  /* Focus practice input when flipped */
  useEffect(() => {
    if (step === 1 && practiceFlipped && practiceInputRef.current) {
      practiceInputRef.current.focus();
    }
  }, [step, practiceFlipped]);

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const handleNext = useCallback(() => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  }, [step]);

  const handleSkipAll = useCallback(() => {
    completeOnboarding();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function completeOnboarding() {
    await db.settings.update(1, {
      daily_goal_minutes: goal,
      onboarding_completed: true,
    });
    navigate('/');
  }

  /* Step 2 — flip the practice card */
  function handlePracticeFlip() {
    if (!practiceFlipped) {
      setPracticeFlipped(true);
      setPracticeAnnounce(
        `${PRACTICE_WORD.gender} ${PRACTICE_WORD.lemma}, plural ${PRACTICE_WORD.plural}`,
      );
    }
  }

  /* Step 2 — check practice answer */
  function handlePracticeCheck() {
    const answer = practiceAnswer.trim().toLowerCase();
    const correct = `${PRACTICE_WORD.gender} ${PRACTICE_WORD.lemma}`.toLowerCase();
    if (answer === correct || answer === PRACTICE_WORD.lemma.toLowerCase()) {
      setPracticeResult('correct');
    } else {
      setPracticeResult('wrong');
    }
  }

  /* Step 3 — play test word */
  function handlePlayTest() {
    playWord(TEST_WORD_ID);
    setAudioPlayed(true);
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <main className="onboarding" id="main-content">
      {/* Progress dots */}
      <div className="onboarding-dots" aria-label={`Step ${step + 1} of 3`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`onboarding-dot ${i === step ? 'onboarding-dot--active' : ''} ${i < step ? 'onboarding-dot--done' : ''}`}
          />
        ))}
      </div>

      {/* ── Step 0: Daily Goal ─────────────────────────────────────── */}
      {step === 0 && (
        <div className="onboarding-step">
          <h1 className="onboarding-title">How much time each day?</h1>
          <p className="onboarding-subtitle">
            Pick a comfortable daily goal. You can always change it later.
          </p>
          <div className="onboarding-goals">
            {([5, 10, 15, 20] as const).map((mins) => (
              <button
                key={mins}
                className={`onboarding-goal ${goal === mins ? 'onboarding-goal--active' : ''}`}
                onClick={() => setGoal(mins)}
                aria-pressed={goal === mins}
              >
                {mins} min
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 1: How typing works ───────────────────────────────── */}
      {step === 1 && (
        <div className="onboarding-step">
          {/* Screen reader announcement for practice card */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {practiceAnnounce}
          </div>

          <h1 className="onboarding-title">Try it out</h1>
          <p className="onboarding-subtitle">
            Tap the card to reveal, then type your answer. Here's a practice card:
          </p>

          <div
            className={`card ${practiceFlipped ? 'card--flipped' : ''}`}
            onClick={handlePracticeFlip}
            role="button"
            tabIndex={0}
            aria-label={practiceFlipped ? `${PRACTICE_WORD.lemma}, ${PRACTICE_WORD.pos}` : 'Tap to reveal'}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !practiceFlipped) {
                e.preventDefault();
                handlePracticeFlip();
              }
            }}
          >
            {!practiceFlipped && (
              <div className="card-front">
                <p className="card-gloss">{PRACTICE_WORD.gloss_en}</p>
                <p className="card-hint">Tap or press Space</p>
              </div>
            )}
            {practiceFlipped && (
              <div className="card-back">
                <span
                  className="gender-ribbon"
                  style={{ backgroundColor: `var(--color-${PRACTICE_WORD.gender})` }}
                  aria-hidden="true"
                />
                <h2 className="card-word">
                  <span className="card-article">{PRACTICE_WORD.gender} </span>
                  {PRACTICE_WORD.lemma}
                </h2>
                <p className="card-plural">Pl. {PRACTICE_WORD.plural}</p>
                <p className="card-example">{PRACTICE_WORD.example_de}</p>
              </div>
            )}
          </div>

          {/* Typing area (appears after flip) */}
          {practiceFlipped && practiceResult === 'idle' && (
            <div className="session-input" style={{ marginTop: 'var(--space-4)' }}>
              <label htmlFor="onboarding-answer" className="sr-only">
                Answer for {PRACTICE_WORD.gloss_en}, including article
              </label>
              <input
                id="onboarding-answer"
                ref={practiceInputRef}
                type="text"
                value={practiceAnswer}
                onChange={(e) => setPracticeAnswer(e.target.value)}
                placeholder="article + word"
                className="text-input"
                autoComplete="off"
                spellCheck={false}
                aria-label={`Answer for ${PRACTICE_WORD.gloss_en}, including article`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && practiceAnswer.trim()) {
                    handlePracticeCheck();
                  }
                }}
              />
              <button
                onClick={handlePracticeCheck}
                disabled={!practiceAnswer.trim()}
                className="btn-submit"
              >
                Check
              </button>
            </div>
          )}

          {/* Practice feedback */}
          {practiceResult !== 'idle' && (
            <div className={`feedback feedback--${practiceResult === 'correct' ? 'correct' : 'wrong'}`} role="alert">
              <p className="feedback-result">
                {practiceResult === 'correct' ? '✓ Nice!' : '✗ Not quite'}
              </p>
              <p className="feedback-correct">
                {PRACTICE_WORD.gender} {PRACTICE_WORD.lemma}
              </p>
              <p className="feedback-hint" style={{ marginBottom: 'var(--space-4)' }}>
                {practiceResult === 'wrong' && 'In a real session, you\'ll see this after checking your answer.'}
                {practiceResult === 'correct' && 'That\'s how it works — simple as that.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Audio voice check ──────────────────────────────── */}
      {step === 2 && (
        <div className="onboarding-step">
          <h1 className="onboarding-title">Sound check</h1>
          <p className="onboarding-subtitle">
            Tap play to hear a German word. Make sure your volume is on.
          </p>

          <button
            className="onboarding-play-btn"
            onClick={handlePlayTest}
            aria-label="Play test word"
          >
            <span className="onboarding-play-icon">🔊</span>
            <span>{audioPlayed ? 'Play again' : 'Play'}</span>
          </button>

          {audioPlayed && (
            <div className="onboarding-confirm-group">
              <p className="onboarding-confirm-text">Could you hear it?</p>
              <div className="onboarding-confirm-buttons">
                <button
                  className="btn-primary"
                  onClick={() => setAudioConfirmed(true)}
                  style={{ maxWidth: '140px' }}
                >
                  Yes
                </button>
                <button
                  className="btn-skip"
                  onClick={() => setAudioConfirmed(true)}
                  style={{ maxWidth: '140px' }}
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {!canPlay && (
            <p className="onboarding-hint">
              Audio isn't available in this browser. You can still use the app — audio may work later.
            </p>
          )}
        </div>
      )}

      {/* ── Navigation buttons ──────────────────────────────────────── */}
      <div className="onboarding-nav">
        <button className="btn-skip" onClick={handleSkipAll} aria-label="Skip onboarding">
          Skip all
        </button>
        <button
          className="btn-primary"
          onClick={handleNext}
          disabled={step === 2 && audioPlayed && !audioConfirmed}
          style={{ maxWidth: '160px' }}
        >
          {step < 2 ? 'Next' : 'Start learning'}
        </button>
      </div>
    </main>
  );
}
