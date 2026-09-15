/**
 * React hook that exposes audio playback and precache status.
 *
 * Usage:
 *   const { playWord, playExample, precacheProgress, isReady } = useAudio();
 */
import { useCallback } from 'react';
import { useAudioStore } from './audioStore';
import { AudioManager } from './AudioManager';

export function useAudio() {
  const precacheProgress = useAudioStore((s) => s.precacheProgress);
  const isReady = useAudioStore((s) => s.isReady);
  const hasTTSVoice = useAudioStore((s) => s.hasTTSVoice);

  const playWord = useCallback(
    (wordId: string) => void AudioManager.playWord(wordId),
    [],
  );

  const playExample = useCallback(
    (wordId: string) => void AudioManager.playExample(wordId),
    [],
  );

  /**
   * Hide the pronunciation button only when there is NO bundled audio
   * AND no TTS voice — i.e. nothing can play at all.
   */
  const canPlay = isReady || hasTTSVoice;

  return { playWord, playExample, precacheProgress, isReady, canPlay };
}
