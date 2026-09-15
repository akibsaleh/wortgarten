/**
 * Chunked audio precacher.
 *
 * On first load the app begins fetching all ~2,000 .ogg files into the
 * Cache API in batches of 20.  Words are fetched before examples so the
 * primary session content is available as early as possible.
 *
 * Progress is pushed into the audio Zustand store so any React component
 * can react to it (e.g. show a progress bar or a TTS-fallback indicator).
 */
import wordsData from '../../public/words.json';
import { useAudioStore } from './audioStore';

export const AUDIO_CACHE_NAME = 'wortgarten-audio-v1';

const BATCH_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the ordered list of audio URLs, words first then examples. */
function buildAudioUrls(): string[] {
  const words = wordsData.words as { id: string }[];
  const urls: string[] = [];
  // Words first — these are what the session needs immediately
  for (const w of words) {
    urls.push(`/audio/words/${w.id}.ogg`);
  }
  // Then examples
  for (const w of words) {
    urls.push(`/audio/examples/${w.id}.ogg`);
  }
  return urls;
}

/** Return only the URLs that are NOT already in the cache. */
async function filterUncached(urls: string[]): Promise<string[]> {
  const cache = await caches.open(AUDIO_CACHE_NAME);
  const results: string[] = [];
  // Check in small sub-batches to avoid holding too many promises
  const checkBatch = 50;
  for (let i = 0; i < urls.length; i += checkBatch) {
    const slice = urls.slice(i, i + checkBatch);
    const matches = await Promise.all(
      slice.map(async (url) => {
        const hit = await cache.match(url);
        return hit ? null : url;
      }),
    );
    for (const m of matches) {
      if (m !== null) results.push(m);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start (or resume) chunked precaching of all audio files.
 *
 * Already-cached files are skipped.  Progress is reported via the Zustand
 * audio store on every batch.  This function is idempotent — calling it
 * multiple times is safe (e.g. from main.tsx and from a React component).
 */
export async function startPrecache(): Promise<void> {
  const { setProgress, setReady } = useAudioStore.getState();

  const allUrls = buildAudioUrls();
  const total = allUrls.length;

  // How many are already cached?
  const cachedCount = total - (await filterUncached(allUrls)).length;
  setProgress(cachedCount, total);

  if (cachedCount === total) {
    setReady(true);
    return;
  }

  // Only fetch what's missing
  const uncached = await filterUncached(allUrls);
  const cache = await caches.open(AUDIO_CACHE_NAME);
  let loaded = total - uncached.length;

  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const res = await fetch(url);
        if (res.ok) {
          await cache.put(url, res);
          return true as const;
        }
        return false as const;
      }),
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) loaded++;
    }
    setProgress(loaded, total);

    // Mark ready once all word audio is precached (the critical path)
    if (!useAudioStore.getState().isReady) {
      const wordCount = (wordsData.words as { id: string }[]).length;
      if (loaded >= wordCount) {
        setReady(true);
      }
    }
  }

  // Final state
  setProgress(loaded, total);
  setReady(true);
}
