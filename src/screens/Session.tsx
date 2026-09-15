import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session';
import { grade, gradeRecognition, gradeToRating, paceFromMs } from '../scheduler/grading';
import { rateCard } from '../scheduler/index';
import { Rating } from 'ts-fsrs';
import { useAudio } from '../audio/useAudio';

/** Umlaut characters for non-German keyboards */
const UMLAUTS = ['ä', 'ö', 'ü', 'ß'] as const;

export function Session() {
  const navigate = useNavigate();
  const {
    queue, currentIndex, flipped, answer, grading, correctForm,
    flip, setAnswer, submitAnswer, nextCard,
  } = useSessionStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const flipTimeRef = useRef<number>(0);
  const answerTimeRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [showWordDetail, setShowWordDetail] = useState(false);
  const [announceText, setAnnounceText] = useState('');

  const { playWord, canPlay } = useAudio();

  const current = queue[currentIndex];
  const cardType = current?.cardType ?? 'production';

  // Auto-focus input when flipped
  useEffect(() => {
    if (flipped && inputRef.current && !grading) {
      inputRef.current.focus();
    }
  }, [flipped, grading]);

  // Focus Next button after grading
  useEffect(() => {
    if (grading && nextBtnRef.current) {
      nextBtnRef.current.focus();
    }
  }, [grading]);

  // Auto-play audio when card flips in audio mode
  useEffect(() => {
    if (cardType === 'audio' && flipped && audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play().catch(() => {});
    }
  }, [cardType, flipped]);

  // Reset word detail view when card changes
  useEffect(() => {
    setShowWordDetail(false);
  }, [currentIndex]);

  // Build screen reader announcement on card flip
  useEffect(() => {
    if (flipped && current) {
      const { word } = current;
      let text = '';
      if (word.gender) {
        text = `${word.gender} ${word.lemma}`;
        if (word.plural) {
          text += `, plural ${word.plural}`;
        } else {
          text += `, no plural form`;
        }
      } else {
        text = word.lemma;
      }
      setAnnounceText(text);
    } else {
      setAnnounceText('');
    }
  }, [flipped, current]);

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
      // P key = pronounce
      if (e.key.toLowerCase() === 'p' && current && !e.ctrlKey && !e.metaKey) {
        const active = document.activeElement;
        if (active && active.tagName === 'INPUT') return; // don't intercept typing
        playWord(current.word.id);
        return;
      }
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
  }, [flipped, grading, answer, handleSubmit, current, playWord]);

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

  /** Insert an umlaut character at the cursor position in the text input */
  function insertUmlaut(char: string) {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const newValue = answer.slice(0, start) + char + answer.slice(end);
    setAnswer(newValue);
    // Restore cursor position after the inserted character
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + 1, start + 1);
    });
  }

  if (!current) {
    return (
      <main className="session" id="main-content">
        <p>No cards in session.</p>
        <button onClick={() => navigate('/')} aria-label="Go home">Go home</button>
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

  // ── Accessible label for the answer input ──────────────────────────────────
  const inputLabel = useMemo(() => {
    switch (cardType) {
      case 'production':
        return word.pos === 'noun' ? `Answer for ${word.gloss_en}, including article` : `Answer for ${word.gloss_en}`;
      case 'recognition':
        return `English meaning of ${word.lemma}`;
      case 'cloze':
        return 'Fill in the blank';
      case 'audio':
        return word.pos === 'noun' ? `Type what you hear, including article` : 'Type what you hear';
      default:
        return 'Your answer';
    }
  }, [cardType, word]);

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
        return 'Listen and type';
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
    <main className="session" id="main-content">
      {/* Screen reader live region — announces word details on flip */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announceText}
      </div>

      {/* Progress */}
      <div className="session-progress" aria-label={`Card ${progress}`}>
        <span className="session-progress-text">{progress}</span>
        {current.kind === 'new' && (
          <span className="badge-new">new</span>
        )}
        <span
          className="badge-type"
          style={{ fontSize: '12px', color: 'var(--color-neutral-4)', marginLeft: '6px' }}
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
        {/* ── Pronunciation button (top-right) ──────────────────────── */}
        {flipped && canPlay && (
          <button
            className="btn-pronounce"
            onClick={(e) => {
              e.stopPropagation();
              playWord(word.id);
            }}
            aria-label={`Pronounce ${word.lemma}`}
            title="Pronounce (P)"
          >
            🔊
          </button>
        )}

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
                aria-label="Replay audio"
                style={{ marginTop: '8px', fontSize: '14px' }}
              >
                🔊 Replay
              </button>
            )}

            {/* ── Word detail info icon ──────────────────────────────── */}
            <button
              className="btn-word-detail"
              onClick={(e) => {
                e.stopPropagation();
                setShowWordDetail(!showWordDetail);
              }}
              aria-label={showWordDetail ? 'Hide word details' : 'Show word details'}
              aria-expanded={showWordDetail}
            >
              ℹ
            </button>
          </div>
        )}
      </div>

      {/* ── Word detail mini-view ───────────────────────────────────── */}
      {flipped && showWordDetail && (
        <div className="word-detail-mini" role="region" aria-label="Word details">
          <div className="word-detail-row">
            <span className="word-detail-label">Word</span>
            <span className="word-detail-value">
              {word.gender && <span className="card-article">{word.gender} </span>}
              {word.lemma}
            </span>
          </div>
          {word.plural && (
            <div className="word-detail-row">
              <span className="word-detail-label">Plural</span>
              <span className="word-detail-value">{word.plural}</span>
            </div>
          )}
          <div className="word-detail-row">
            <span className="word-detail-label">Type</span>
            <span className="word-detail-value">{word.pos}</span>
          </div>
          <div className="word-detail-row">
            <span className="word-detail-label">English</span>
            <span className="word-detail-value">{word.gloss_en}</span>
          </div>
          <div className="word-detail-row">
            <span className="word-detail-label">Level</span>
            <span className="word-detail-value">{word.cefr}</span>
          </div>
          {word.example_en && (
            <div className="word-detail-row">
              <span className="word-detail-label">Example</span>
              <span className="word-detail-value word-detail-example">
                {word.example_de}
                <br />
                <em>{word.example_en}</em>
              </span>
            </div>
          )}
          <p className="word-detail-coming-soon">
            Full word detail coming in a later phase →
          </p>
        </div>
      )}

      {/* Input */}
      {flipped && !grading && (
        <div className="session-input-wrapper">
          <div className="session-input">
            <label htmlFor="session-answer" className="sr-only">
              {inputLabel}
            </label>
            <input
              id="session-answer"
              ref={inputRef}
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={placeholder}
              className="text-input"
              autoComplete="off"
              spellCheck={false}
              aria-label={inputLabel}
            />
            <button
              onClick={handleSubmit}
              disabled={!answer.trim()}
              className="btn-submit"
              aria-label="Check answer"
            >
              Check
            </button>
          </div>

          {/* Umlaut helper chips */}
          <div className="umlaut-chips" role="group" aria-label="Umlaut helper">
            {UMLAUTS.map((char) => (
              <button
                key={char}
                className="umlaut-chip"
                onClick={() => insertUmlaut(char)}
                aria-label={`Insert ${char}`}
              >
                {char}
              </button>
            ))}
          </div>
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
          <button ref={nextBtnRef} onClick={handleNext} className="btn-primary">
            Next
          </button>
        </div>
      )}
    </main>
  );
}
