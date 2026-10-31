import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session';
import { SpeakerIcon } from '../components/SpeakerIcon';
import {
  grade,
  gradeCloze,
  gradeRecognition,
  gradeToRating,
  paceFromMs,
} from '../scheduler/grading';
import { markWordIntroduced, rateCard } from '../scheduler/index';
import { Rating } from 'ts-fsrs';
import { useAudio } from '../audio/useAudio';

/** Umlaut characters for non-German keyboards */
const UMLAUTS = ['ä', 'ö', 'ü', 'ß'] as const;

export function Session() {
  const navigate = useNavigate();
  const {
    queue,
    currentIndex,
    flipped,
    answer,
    grading,
    correctForm,
    flip,
    setAnswer,
    submitAnswer,
    nextCard,
  } = useSessionStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const gotItBtnRef = useRef<HTMLButtonElement>(null);
  const flipTimeRef = useRef<number>(0);
  const answerTimeRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const frontFaceRef = useRef<HTMLDivElement>(null);
  const backFaceRef = useRef<HTMLDivElement>(null);
  const [showWordDetail, setShowWordDetail] = useState(false);
  const [announceText, setAnnounceText] = useState('');

  const { playWord, canPlay } = useAudio();

  const current = queue[currentIndex];
  const cardType = current?.cardType ?? 'production';
  const isCloze = cardType === 'cloze';
  const isIntro = cardType === 'intro';
  // Cloze and intro cards never flip: flipping a cloze card would reveal the
  // answer before submission, and an intro card has nothing to recall yet.
  const noFlip = isCloze || isIntro;

  // Both card faces stay mounted for the flip, so the face turned away
  // must be inert: backface-visibility hides pixels but leaves the
  // subtree in the tab order and the accessibility tree. Set via ref —
  // React 18 does not accept `inert` as a JSX prop.
  useEffect(() => {
    if (frontFaceRef.current) frontFaceRef.current.inert = flipped;
    if (backFaceRef.current) backFaceRef.current.inert = !flipped;
  }, [flipped]);

  // Auto-focus input when flipped. Cloze cards never flip — focus on arrival.
  useEffect(() => {
    if ((flipped || isCloze) && inputRef.current && !grading) {
      inputRef.current.focus();
    }
  }, [flipped, grading, isCloze, currentIndex]);

  // No-flip cards have no flip moment to start the pace timer — start it
  // when the card appears instead, or every answer would grade "slow".
  useEffect(() => {
    if (noFlip) flipTimeRef.current = Date.now();
  }, [currentIndex, noFlip]);

  // Focus the primary action on intro cards
  useEffect(() => {
    if (isIntro && !grading) gotItBtnRef.current?.focus();
  }, [isIntro, grading, currentIndex]);

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
      : isCloze
        ? gradeCloze({ answer, word: current.word })
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
  }, [current, answer, submitAnswer, cardType, isCloze]);

  /**
   * Intro cards are exposure, not recall: self-rated, persisted to FSRS
   * (Again resurfaces the word sooner), and advance without a feedback step.
   */
  const handleIntro = useCallback(
    (rating: Rating) => {
      if (!current) return;
      const elapsed = Date.now() - flipTimeRef.current;
      void markWordIntroduced(current.word.id);
      void rateCard(current.card.id, rating, elapsed);
      nextCard();
    },
    [current, nextCard],
  );

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
      if (e.key === ' ' && !flipped && !grading && !noFlip) {
        e.preventDefault();
        flip();
        flipTimeRef.current = Date.now();
      }
      if (e.key === 'Enter' && (flipped || isCloze) && !grading && answer.trim()) {
        handleSubmit();
      }
      // Enter = "Got it" on intro cards — skip when a button has focus, since
      // the button's native Enter handling would also fire (double action).
      if (
        e.key === 'Enter' &&
        isIntro &&
        !grading &&
        !(e.target instanceof HTMLButtonElement)
      ) {
        handleIntro(Rating.Good);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [flipped, grading, answer, handleSubmit, current, playWord, noFlip, isCloze, isIntro, handleIntro]);

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

  // Hooks must run unconditionally on every render (React's Rules of
  // Hooks), so these four run before the `!current` early return below —
  // they previously sat after it and were skipped on the empty-queue
  // render, which React flags as a hook-count mismatch.
  //
  // `wordMaybe` is possibly undefined here (only when `current` is
  // undefined, right before the early return makes that render path
  // moot); each switch below is null-safe so the memo body itself never
  // throws. `word` below the guard is the narrowed, always-defined
  // version the rest of the render relies on.
  const wordMaybe = current?.word;

  // ── Placeholder text for each interaction type ─────────────────────────────
  const placeholder = useMemo(() => {
    switch (cardType) {
      case 'production':
        return wordMaybe?.pos === 'noun'
          ? 'article + word'
          : 'type your answer';
      case 'recognition':
        return 'English meaning';
      case 'cloze':
        return 'missing word';
      case 'audio':
        return wordMaybe?.pos === 'noun'
          ? 'article + word'
          : 'type what you hear';
      default:
        return 'type your answer';
    }
  }, [cardType, wordMaybe?.pos]);

  // ── Accessible label for the answer input ──────────────────────────────────
  const inputLabel = useMemo(() => {
    switch (cardType) {
      case 'production':
        return wordMaybe?.pos === 'noun'
          ? `Answer for ${wordMaybe.gloss_en}, including article`
          : `Answer for ${wordMaybe?.gloss_en}`;
      case 'recognition':
        return `English meaning of ${wordMaybe?.lemma}`;
      case 'cloze':
        return 'Fill in the blank';
      case 'audio':
        return wordMaybe?.pos === 'noun'
          ? `Type what you hear, including article`
          : 'Type what you hear';
      default:
        return 'Your answer';
    }
  }, [cardType, wordMaybe]);

  // ── Prompt text shown on the card front ────────────────────────────────────
  const promptLabel = useMemo(() => {
    switch (cardType) {
      case 'production':
        return wordMaybe?.gloss_en;
      case 'recognition':
        return wordMaybe?.gender
          ? `${wordMaybe.gender} ${wordMaybe.lemma}`
          : wordMaybe?.lemma;
      case 'cloze':
        return current?.clozeText ?? wordMaybe?.example_de;
      case 'audio':
        return 'Listen and type';
      default:
        return wordMaybe?.gloss_en;
    }
  }, [cardType, wordMaybe, current?.clozeText]);

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

  if (!current) {
    return (
      <main className="session" id="main-content">
        <p>No cards in session.</p>
        <button onClick={() => navigate('/')} aria-label="Go home">
          Go home
        </button>
      </main>
    );
  }

  const { word } = current;
  const progress = `${currentIndex + 1} / ${queue.length}`;

  return (
    <main className="session" id="main-content">
      {/* Screen reader live region — announces word details on flip */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announceText}
      </div>

      {/* Progress */}
      <div className="session-progress" aria-label={`Card ${progress}`}>
        <span className="session-progress-text">{progress}</span>
        {current.kind === 'new' && <span className="badge-new">new</span>}
        <span className="badge-type">{cardType}</span>
      </div>

      {/* Card */}
      <div
        className={`card ${flipped ? 'card--flipped' : ''}`}
        onClick={() => {
          if (!flipped && !grading && !noFlip) {
            flip();
            flipTimeRef.current = Date.now();
          }
        }}
        role={noFlip ? undefined : 'button'}
        tabIndex={noFlip ? undefined : 0}
        aria-label={
          noFlip
            ? undefined
            : flipped
              ? `${word.lemma}, ${word.pos}`
              : 'Tap to reveal'
        }
        onKeyDown={(e) => {
          if (noFlip) return;
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (!flipped) {
              flip();
              flipTimeRef.current = Date.now();
            }
          }
        }}
      >
        {/* Both faces stay mounted so the 280ms rotateY has something
            to rotate to. The face turned away is made `inert` below,
            which removes it from tab order AND the a11y tree —
            backface-visibility only hides pixels. */}
        <div className="card-inner">
          {/* ── Front: prompt (varies by cardType) ── */}
          <div className="card-front" ref={frontFaceRef}>
            {cardType === 'audio' && (
              <audio ref={audioRef} src={word.audio_word} preload="auto" />
            )}
            {isIntro ? (
              <>
                <p className="card-hint">New word</p>
                <h2 className="card-word">
                  {word.gender && (
                    <span className="card-article">{word.gender} </span>
                  )}
                  {word.lemma}
                </h2>
                {word.plural && word.plural !== word.lemma && (
                  <p className="card-plural">Pl. {word.plural}</p>
                )}
                <p className="card-gloss">{word.gloss_en}</p>
                {word.example_de && (
                  <p className="card-example">{word.example_de}</p>
                )}
                {canPlay && (
                  <button
                    className="btn-pronounce"
                    onClick={(e) => {
                      e.stopPropagation();
                      playWord(word.id);
                    }}
                    aria-label={`Pronounce ${word.lemma}`}
                    title="Pronounce (P)"
                  >
                    <SpeakerIcon />
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="card-gloss">{promptLabel}</p>
                <p className="card-hint">{promptHint}</p>
              </>
            )}
          </div>

          {/* ── Back: word + feedback ── */}
          <div className="card-back" ref={backFaceRef}>
            {/* ── Pronunciation button (top-right) ──────────────────── */}
            {canPlay && (
              <button
                className="btn-pronounce"
                onClick={(e) => {
                  e.stopPropagation();
                  playWord(word.id);
                }}
                aria-label={`Pronounce ${word.lemma}`}
                title="Pronounce (P)"
              >
                <SpeakerIcon />
              </button>
            )}
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
                  {word.gender && (
                    <span className="card-article">{word.gender} </span>
                  )}
                  {word.lemma}
                </h2>
                {word.plural && (
                  <p className="card-plural">Pl. {word.plural}</p>
                )}
              </>
            )}

            {/* Production / Audio: show word + example after grading */}
            {(cardType === 'production' || cardType === 'audio') && (
              <>
                <h2 className="card-word">
                  {word.gender && (
                    <span className="card-article">{word.gender} </span>
                  )}
                  {word.lemma}
                </h2>
                {word.plural && (
                  <p className="card-plural">Pl. {word.plural}</p>
                )}
                {word.example_de && (
                  <p className="card-example">{word.example_de}</p>
                )}
              </>
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
              >
                <SpeakerIcon /> Replay
              </button>
            )}

            {/* ── Word detail info icon ──────────────────────────────── */}
            <button
              className="btn-word-detail"
              onClick={(e) => {
                e.stopPropagation();
                setShowWordDetail(!showWordDetail);
              }}
              aria-label={
                showWordDetail ? 'Hide word details' : 'Show word details'
              }
              aria-expanded={showWordDetail}
            >
              ℹ
            </button>
          </div>
        </div>
      </div>

      {/* ── Word detail mini-view ───────────────────────────────────── */}
      {flipped && showWordDetail && (
        <div
          className="word-detail-mini"
          role="region"
          aria-label="Word details"
        >
          <div className="word-detail-row">
            <span className="word-detail-label">Word</span>
            <span className="word-detail-value">
              {word.gender && (
                <span className="card-article">{word.gender} </span>
              )}
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

      {/* Input (cloze cards show it immediately — they never flip) */}
      {(flipped || isCloze) && !grading && (
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

      {/* Intro actions — self-rated exposure, no typed recall */}
      {isIntro && !grading && (
        <div className="intro-actions">
          <button
            className="btn-secondary"
            onClick={() => handleIntro(Rating.Again)}
          >
            Show again
          </button>
          <button
            ref={gotItBtnRef}
            className="btn-primary"
            onClick={() => handleIntro(Rating.Good)}
          >
            Got it
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
            {isCloze
              ? (current.clozeText?.replace(
                  '_____',
                  word.cloze_answer ?? word.lemma,
                ) ?? correctForm)
              : correctForm}
          </p>
          {grading !== 'correct' && !isCloze && (
            <p className="feedback-hint">
              {grading === 'wrong' &&
                word.pos === 'noun' &&
                'Remember: der/die/das'}
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
