import { useEffect, useRef, useState } from 'react';

interface ProgressRingProps {
  /** 0–1 filled amount */
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  /** Optional label for the aria-label (e.g. "Core coverage") */
  label?: string;
}

export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 8,
  color = 'var(--color-accent)',
  label,
}: ProgressRingProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const rafRef = useRef(0);

  const reducedMotion =
    typeof window !== 'undefined' &&
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.body.classList.contains('reduced-motion'));

  useEffect(() => {
    if (reducedMotion) {
      setAnimatedValue(value);
      return;
    }

    const start = performance.now();
    const duration = 250;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setAnimatedValue(progress * value);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, reducedMotion]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - animatedValue);
  const pct = Math.round(animatedValue * 100);

  const ariaLabelText = label
    ? `${label}: ${pct}%`
    : `${pct}%`;

  return (
    <svg
      width={size}
      height={size}
      aria-label={ariaLabelText}
      role="img"
    >
      {/* track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-neutral-1)"
        strokeWidth={strokeWidth}
      />
      {/* fill */}
      <circle
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
      />
      {/* percentage text */}
      <text
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
