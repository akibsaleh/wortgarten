/**
 * Zustand store for audio precache progress and readiness state.
 * Shared between the precache worker and the React UI.
 */
import { create } from 'zustand';

export interface AudioState {
  /** Precache progress: null before precaching starts. */
  precacheProgress: { loaded: number; total: number } | null;
  /** True when enough audio is cached for a useful session (all words done). */
  isReady: boolean;
  /** Whether a de-DE speech synthesis voice is available (for TTS fallback). */
  hasTTSVoice: boolean;

  // Actions
  setProgress: (loaded: number, total: number) => void;
  setReady: (ready: boolean) => void;
  setHasTTSVoice: (v: boolean) => void;
}

export const useAudioStore = create<AudioState>((set) => ({
  precacheProgress: null,
  isReady: false,
  hasTTSVoice: false,

  setProgress: (loaded, total) =>
    set({ precacheProgress: { loaded, total } }),

  setReady: (ready) =>
    set({ isReady: ready }),

  setHasTTSVoice: (v) =>
    set({ hasTTSVoice: v }),
}));
