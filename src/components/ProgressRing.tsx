interface ProgressRingProps {
  /** 0–1 filled amount */
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  /** Optional label for the aria-label (e.g. "Core coverage") */
  label?: string;
}

/**
 * Thin progress ring (spec §7.3): 3px stroke, round linecap,
 * neutral track, 250ms fill.
 *
 * The fill is a CSS transition on stroke-dashoffset, not a
 * requestAnimationFrame loop driving React state — the rAF version
 * re-rendered the component on every frame (~15 renders per ring).
 * The CSS transition is also covered automatically by the global
 * reduced-motion guards, so no JS media query is needed.
 */
export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 3,
  color = 'var(--color-accent)',
  label,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value);
  const pct = Math.round(value * 100);

  const ariaLabelText = label ? `${label}: ${pct}%` : `${pct}%`;

  return (
    <svg
      className="progress-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={ariaLabelText}
      role="img"
    >
      {/* track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-neutral-2)"
        strokeWidth={strokeWidth}
      />
      {/* fill — grows from empty on mount via the CSS transition */}
      <circle
        className="ring-fill"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ '--ring-circumference': `${circumference}px` } as React.CSSProperties}
      />
      {/* percentage text */}
      <text
        className="ring-text"
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.22}
        fontFamily="var(--font-serif)"
        fill="var(--color-ink)"
      >
        {pct}%
      </text>
    </svg>
  );
}
