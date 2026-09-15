import { useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session';
import { grade, gradeToRating, paceFromMs } from '../scheduler/grading';
import { rateCard } from '../scheduler/index';
import { Rating } from 'ts-fsrs';

export function Session() {
  const navigate = useNavigate();
  const {
    queue, currentIndex, flipped, answer, grading, correctForm,
    flip, setAnswer, submitAnswer, nextCard,
  } = useSessionStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const flipTimeRef = useRef<number>(0);
  const answerTimeRef = useRef<number>(0);

  const current = queue[currentIndex];

  // Auto-focus input when flipped
  useEffect(() => {
    if (flipped && inputRef.current && !grading) {
      inputRef.current.focus();
    }
  }, [flipped, grading]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === ' ' && !flipped && !grading) {
        e.preventDefault();
        flip();
        flipTimeRef.current = Date.now();
      }
      if (e.key === 'Enter' && flipped && !grading && answer.trim()) {
        handleSubmit();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [flipped, grading, answer]);

  const handleSubmit = useCallback(() => {
    if (!current) return;
    const elapsed = Date.now() - flipTimeRef.current;
    const result = grade({ answer, word: current.word });
    const pace = paceFromMs(elapsed);
    const outcome = gradeToRating(result.grade, pace);
    submitAnswer(result.grade, result.correctForm);
    answerTimeRef.current = Date.now();

    // Persist to DB
    const ratingMap: Record<string, Rating> = {
      wrong: Rating.Again,
      hard: Rating.Hard,
      good: Rating.Good,
      easy: Rating.Easy,
    };
    rateCard(current.card.id, ratingMap[outcome]!, elapsed);
  }, [current, answer, submitAnswer]);

  const handleNext = useCallback(() => {
    nextCard();
    flipTimeRef.current = 0;
  }, [nextCard]);

  // Redirect to summary when session is complete
  useEffect(() => {
    if (useSessionStore.getState().complete && queue.length > 0) {
      navigate('/summary');
    }
  }, [queue.length]);

  if (!current) {
    return (
      <main className="session">
        <p>No cards in session.</p>
        <button onClick={() => navigate('/')}>Go home</button>
      </main>
    );
  }

  const { word } = current;
  const progress = `${currentIndex + 1} / ${queue.length}`;

  return (
    <main className="session">
      {/* Progress */}
      <div className="session-progress" aria-label={progress}>
        <span style={{ fontSize: '14px', color: 'var(--neutral-300)' }}>{progress}</span>
        {current.kind === 'new' && (
          <span className="badge-new">new</span>
        )}
      </div>

      {/* Card */}
      <div
        className={`card ${flipped ? 'card--flipped' : ''}`}
        onClick={() => {
          if (!flipped && !grading) {
            flip();
            flipTimeRef.current = Date.now();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={flipped ? `${word.lemma}, ${word.pos}` : 'Tap to reveal'}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (!flipped) {
              flip();
              flipTimeRef.current = Date.now();
            }
          }
        }}
      >
        {/* Front: gloss prompt */}
        {!flipped && (
          <div className="card-front">
            <p className="card-gloss">{word.gloss_en}</p>
            <p className="card-hint">Tap or press Space</p>
          </div>
        )}

        {/* Back: word + feedback */}
        {flipped && (
          <div className="card-back">
            {word.gender && (
              <span
                className="gender-ribbon"
                style={{ backgroundColor: `var(--color-${word.gender})` }}
                aria-hidden="true"
              />
            )}
            <h2 className="card-word" style={{ fontFamily: 'var(--font-serif)' }}>
              {word.gender && <span className="card-article">{word.gender} </span>}
              {word.lemma}
            </h2>
            {word.plural && (
              <p className="card-plural" style={{ color: 'var(--neutral-400)' }}>
                Pl. {word.plural}
              </p>
            )}
            <p className="card-example" style={{ color: 'var(--neutral-300)', fontStyle: 'italic' }}>
              {word.example_de}
            </p>
          </div>
        )}
      </div>

      {/* Input */}
      {flipped && !grading && (
        <div className="session-input">
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={word.pos === 'noun' ? 'article + word' : 'type your answer'}
            className="text-input"
            autoComplete="off"
            spellCheck={false}
          />
          <button onClick={handleSubmit} disabled={!answer.trim()} className="btn-submit">
            Check
          </button>
        </div>
      )}

      {/* Feedback */}
      {grading && (
        <div className={`feedback feedback--${grading}`} role="alert">
          <p className="feedback-result">
            {grading === 'correct' && '✓ Correct'}
            {grading === 'typo' && 'Almost'}
            {grading === 'wrong' && '✗'}
          </p>
          <p className="feedback-correct" style={{ fontFamily: 'var(--font-serif)' }}>
            {correctForm}
          </p>
          {grading !== 'correct' && (
            <p className="feedback-hint" style={{ color: 'var(--neutral-400)' }}>
              {grading === 'wrong' && word.pos === 'noun' && 'Remember: der/die/das'}
            </p>
          )}
          <button onClick={handleNext} className="btn-primary" autoFocus>
            Next
          </button>
        </div>
      )}
    </main>
  );
}
