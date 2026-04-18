import type { ReactNode } from 'react';

interface HeroStatProps {
  value: ReactNode;
  label: string;
  /** Per-game accent (CSS var). Defaults to text color. */
  accent?: string;
  /** Suffix rendered smaller after value (e.g. "ms", "px"). */
  suffix?: string;
  /** Size of the value text (default 26). */
  size?: number;
}

/**
 * Single stat block — big tabular number with a tracked-caps label.
 * Used inside per-game `bespokeHero` slots. Composes into HeroStatRow
 * for side-by-side numeric comparisons.
 */
export function HeroStat({ value, label, accent, suffix, size = 26 }: HeroStatProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: size,
          fontWeight: 800,
          letterSpacing: -0.4,
          color: accent ?? 'var(--po-text)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {value}
        {suffix && (
          <span style={{ fontSize: Math.max(11, size * 0.45), fontWeight: 600, marginLeft: 2 }}>
            {suffix}
          </span>
        )}
      </span>
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--po-text-dim)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

interface HeroStatRowProps {
  children: ReactNode;
  gap?: number;
}

/** Horizontal row of HeroStat blocks (typically 2-3). */
export function HeroStatRow({ children, gap = 18 }: HeroStatRowProps) {
  return (
    <div style={{ display: 'flex', gap, alignItems: 'baseline', justifyContent: 'center' }}>
      {children}
    </div>
  );
}

interface HeroFrameProps {
  children: ReactNode;
  /** Per-game accent — drives the drop-shadow halo. */
  accent: string;
  /** Halo intensity 0-1 (default 0.4). Set lower for subtle, higher for dramatic. */
  haloIntensity?: number;
}

/** SVG frame with accent-tinted drop-shadow halo. Wrap your bespoke SVG. */
export function HeroFrame({ children, accent, haloIntensity = 0.4 }: HeroFrameProps) {
  return (
    <div
      style={{
        filter: `drop-shadow(0 0 16px color-mix(in oklch, ${accent} ${haloIntensity * 100}%, transparent))`,
      }}
    >
      {children}
    </div>
  );
}
