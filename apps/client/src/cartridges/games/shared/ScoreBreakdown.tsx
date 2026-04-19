import type { ReactNode } from 'react';

interface ScoreBreakdownProps {
  children: ReactNode;
}

/**
 * Shared score-breakdown card used inside game wrapper invocations
 * (the `renderBreakdown` slot on Arcade/Live games). Replaces the
 * `bg-white/[0.03] border border-white/[0.06] ... ` card
 * that 17 entry files used to copy.
 *
 * Compose with `<ScoreRow>` for individual stat rows and `<ScoreDivider>`
 * to separate base score from derived totals.
 */
export function ScoreBreakdown({ children }: ScoreBreakdownProps) {
  return (
    <div
      style={{
        background: 'var(--po-bg-glass)',
        border: '1px solid var(--po-border)',
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontFamily: 'var(--po-font-body)',
      }}
    >
      {children}
    </div>
  );
}

interface ScoreRowProps {
  label: string;
  value: ReactNode;
  /** Optional accent for the value (e.g. var(--po-gold) for silver). */
  tone?: string;
  emphasize?: boolean;
}

export function ScoreRow({ label, value, tone, emphasize }: ScoreRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 13,
      }}
    >
      <span style={{ color: 'var(--po-text-dim)' }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontWeight: emphasize ? 800 : 600,
          color: tone ?? 'var(--po-text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function ScoreDivider() {
  return (
    <div
      style={{
        height: 1,
        margin: '4px 0',
        background: 'var(--po-border)',
      }}
    />
  );
}
