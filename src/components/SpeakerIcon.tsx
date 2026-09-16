/**
 * Vector speaker glyph for the pronounce / replay / play controls.
 *
 * Replaces the speaker emoji: emoji are font-dependent, render differently
 * per OS, and cannot be tinted from a design token. Mirrors the inline
 * SVG already used by the Home settings icon (spec §3 calls for SVG).
 *
 * Always aria-hidden — the parent <button> carries the accessible name.
 */
export function SpeakerIcon({ size }: { size?: string }) {
  return (
    <svg
      className="icon-speaker"
      style={size ? { width: size, height: size } : undefined}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" />
      <path d="M18.5 5.5a8.5 8.5 0 0 1 0 13" />
    </svg>
  );
}
