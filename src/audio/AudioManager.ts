/**
 * Singleton audio manager for Wortgarten.
 *
 * Responsibilities:
 *  1. Kick off chunked precaching on first access.
 *  2. Provide playWord / playExample that:
 *       a) Try the bundled audio (Cache API) first.
 *       b) Fall back to Web Speech API (speechSynthesis, de-DE).
 *  3. Detect whether a de-DE voice is available (used to show/hide the
 *     pronunciation button).
 */
import wordsData from '../../public/words.json';
import { AUDIO_CACHE_NAME, startPrecache } from './precache';
import { useAudioStore } from './audioStore';

// ---------------------------------------------------------------------------
// Word lookup map  (built once from the bundled words.json)
// ---------------------------------------------------------------------------

interface WordInfo {
  lemma: string;
  exampleDe: string;
}

const wordMap = new Map<string, WordInfo>();
for (const w of wordsData.words as { id: string; lemma: string; example_de: string }[]) {
  wordMap.set(w.id, { lemma: w.lemma, exampleDe: w.example_de });
}

// ---------------------------------------------------------------------------
// Web Speech API helpers
// ---------------------------------------------------------------------------

/** Check if a de-DE voice exists; update the store once. */
function detectTTSVoice(): void {
  if (typeof speechSynthesis === 'undefined') return;

  const checkVoices = () => {
    const voices = speechSynthesis.getVoices();
    const hasDE = voices.some((v) => v.lang.startsWith('de'));
    useAudioStore.getState().setHasTTSVoice(hasDE);
  };

  checkVoices();
  // Voices may load asynchronously on some browsers
  speechSynthesis.onvoiceschanged = checkVoices;
}

function speak(text: string): void {
  if (typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'de-DE';
  utter.rate = 0.85;
  speechSynthesis.speak(utter);
}

// ---------------------------------------------------------------------------
// Audio playback helpers
// ---------------------------------------------------------------------------

/** Try to play a bundled audio file from the Cache API. Returns true on success. */
async function playFromCache(url: string): Promise<boolean> {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const response = await cache.match(url);
    if (!response) return false;

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return new Promise<boolean>((resolve) => {
      const audio = new Audio(objectUrl);
      audio.onended = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(true);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(false);
      };
      audio.play().catch(() => {
        URL.revokeObjectURL(objectUrl);
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// AudioManager singleton
// ---------------------------------------------------------------------------

class AudioManagerImpl {
  private precacheStarted = false;

  /** Start precaching (idempotent). Call once from main.tsx. */
  init(): void {
    detectTTSVoice();
    if (this.precacheStarted) return;
    this.precacheStarted = true;
    // Fire-and-forget — progress updates the Zustand store
    void startPrecache();
  }

  /** Play the word pronunciation for the given word ID. */
  async playWord(wordId: string): Promise<void> {
    const url = `/audio/words/${wordId}.ogg`;
    const played = await playFromCache(url);
    if (!played) {
      const info = wordMap.get(wordId);
      if (info) speak(info.lemma);
    }
  }

  /** Play the example sentence audio for the given word ID. */
  async playExample(wordId: string): Promise<void> {
    const url = `/audio/examples/${wordId}.ogg`;
    const played = await playFromCache(url);
    if (!played) {
      const info = wordMap.get(wordId);
      if (info && info.exampleDe) speak(info.exampleDe);
    }
  }

  /** Whether a de-DE TTS voice is available (for showing/hiding the button). */
  get hasTTSVoice(): boolean {
    return useAudioStore.getState().hasTTSVoice;
  }
}

/** The singleton instance — import and call methods directly. */
export const AudioManager = new AudioManagerImpl();
