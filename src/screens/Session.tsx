import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session';
import { grade, gradeRecognition, gradeToRating, paceFromMs } from '../scheduler/grading';
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
  const audioRef = useRef<HTMLAudioElement>(null);

  const current = queue[currentIndex];
  const cardType = current?.cardType ?? 'production';

  // Auto-focus input when flipped
  useEffect(() => {
    if (flipped && inputRef.current && !grading) {
      inputRef.current.focus();
    }
  }, [flipped, grading]);

  // Auto-play audio when card flips in audio mode
  useEffect(() => {
    if (cardType === 'audio' && flipped && audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play().catch(() => {});
    }
  }, [cardType, flipped]);

  const handleSubmit = useCallback(() => {
    if (!current) return;
    const elapsed = Date.now() - flipTimeRef.current;

    const isRecognition = cardType === 'recognition';
    const result = isRecognition
      ? gradeRecognition({ answer, word: current.word })
      : grade({ answer, word: current.word });

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
  }, [current, answer, submitAnswer, cardType]);

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
  }, [flipped, grading, answer, handleSubmit]);

  const handleNext = useCallback(() => {
    nextCard();
    flipTimeRef.current = 0;
  }, [nextCard]);

  // Redirect to summary when session is complete
  useEffect(() => {
    if (useSessionStore.getState().complete && queue.length > 0) {
      navigate('/summary');
    }
  }, [queue.length, navigate]);

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

  // ── Placeholder text for each interaction type ─────────────────────────────
  const placeholder = useMemo(() => {
    switch (cardType) {
      case 'production':
        return word.pos === 'noun' ? 'article + word' : 'type your answer';
      case 'recognition':
        return 'English meaning';
      case 'cloze':
        return 'missing word';
      case 'audio':
        return word.pos === 'noun' ? 'article + word' : 'type what you hear';
      default:
        return 'type your answer';
    }
  }, [cardType, word.pos]);

  // ── Prompt text shown on the card front ────────────────────────────────────
  const promptLabel = useMemo(() => {
    switch (cardType) {
      case 'production':
        return word.gloss_en;
      case 'recognition':
        return word.gender
          ? `${word.gender} ${word.lemma}`
          : word.lemma;
      case 'cloze':
        return current.clozeText ?? word.example_de;
      case 'audio':
        return '🔊 Listen & type';
      default:
        return word.gloss_en;
    }
  }, [cardType, word, current.clozeText]);

  // ── Secondary hint under the prompt ────────────────────────────────────────
  const promptHint = useMemo(() => {
    switch (cardType) {
      case 'production':
        return 'Tap or press Space';
      case 'recognition':
        return 'What does this mean?';
      case 'cloze':
        return 'Fill in the blank';
      case 'audio':
        return 'Tap to hear, then type';
      default:
        return 'Tap or press Space';
    }
  }, [cardType]);

  return (
    <main className="session">
      {/* Progress */}
      <div className="session-progress" aria-label={progress}>
        <span className="session-progress-text">{progress}</span>
        {current.kind === 'new' && (
          <span className="badge-new">new</span>
        )}
        <span
          className="badge-type"
          style={{ fontSize: '12px', color: 'var(--neutral-400)', marginLeft: '6px' }}
        >
          {cardType}
        </span>
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
        {/* ── Front: prompt (varies by cardType) ── */}
        {!flipped && (
          <div className="card-front">
            {cardType === 'audio' && (
              <audio ref={audioRef} src={word.audio_word} preload="auto" />
            )}
            <p className="card-gloss">{promptLabel}</p>
            <p className="card-hint">{promptHint}</p>
          </div>
        )}

        {/* ── Back: word + feedback ── */}
        {flipped && (
          <div className="card-back">
            {word.gender && (
              <span
                className="gender-ribbon"
                style={{ backgroundColor: `var(--color-${word.gender})` }}
                aria-hidden="true"
              />
            )}

            {/* Recognition: show the German word as the answer */}
            {cardType === 'recognition' && (
              <>
                <h2 className="card-word">
                  {word.gender && <span className="card-article">{word.gender} </span>}
                  {word.lemma}
                </h2>
                {word.plural && (
                  <p className="card-plural">
                    Pl. {word.plural}
                  </p>
                )}
              </>
            )}

            {/* Production / Audio: show word + example after grading */}
            {(cardType === 'production' || cardType === 'audio') && (
              <>
                <h2 className="card-word">
                  {word.gender && <span className="card-article">{word.gender} </span>}
                  {word.lemma}
                </h2>
                {word.plural && (
                  <p className="card-plural">
                    Pl. {word.plural}
                  </p>
                )}
                {word.example_de && (
                  <p className="card-example">
                    {word.example_de}
                  </p>
                )}
              </>
            )}

            {/* Cloze: show the full sentence (with answer revealed after grading) */}
            {cardType === 'cloze' && (
              <p className="card-example">
                {current.clozeText?.replace('_____', word.lemma) ?? word.example_de}
              </p>
            )}

            {/* Audio: replay button */}
            {cardType === 'audio' && (
              <button
                className="btn-replay"
                onClick={(e) => {
                  e.stopPropagation();
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    void audioRef.current.play().catch(() => {});
                  }
                }}
                style={{ marginTop: '8px', fontSize: '14px' }}
              >
                🔊 Replay
              </button>
            )}
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
            placeholder={placeholder}
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
          <p className="feedback-correct">
            {correctForm}
          </p>
          {grading !== 'correct' && (
            <p className="feedback-hint">
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
