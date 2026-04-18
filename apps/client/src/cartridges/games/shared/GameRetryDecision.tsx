import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedCounter } from './AnimatedCounter';

interface GameRetryDecisionProps {
  /** Per-game accent — Submit CTA tint + status accent. */
  accent: string;
  /** One-line status verdict ("First run", "Beat your last", etc.). */
  status: string;
  /** Silver this attempt earned. */
  silverReward: number;
  /** Silver from previous attempt — null if first attempt. */
  previousSilverReward: number | null;
  /** Attempt counter for the Retry CTA label. */
  retryCount: number;
  /** Optional game-specific score breakdown (slot). */
  breakdown?: ReactNode;
  onSubmit: () => void;
  onRetry: () => void;
}

/**
 * Replaces RetryDecisionScreen — same lifecycle role, all-new
 * composition. Status line + score is the moment; "SILVER EARNED"
 * caption no longer pretends to be the headline.
 *
 * Submit picks up the per-game accent so different games visibly
 * own the decision (no all-gold uniform). Retry is a ghost button
 * sized to 44px touch target.
 */
export function GameRetryDecision({
  accent,
  status,
  silverReward,
  previousSilverReward,
  retryCount,
  breakdown,
  onSubmit,
  onRetry,
}: GameRetryDecisionProps) {
  const reduce = useReducedMotion();
  const showComparison = previousSilverReward != null && previousSilverReward > 0;
  const delta = previousSilverReward != null ? silverReward - previousSilverReward : 0;

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '20px 16px 22px',
      }}
    >
      {/* Status verdict — the line that names the moment */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.26em',
            color: accent,
            textTransform: 'uppercase',
          }}
        >
          {status}
        </span>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(40px, 11vw, 56px)',
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: -0.02,
            color: 'var(--po-text)',
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 32px color-mix(in oklch, ${accent} 36%, transparent)`,
          }}
        >
          +<AnimatedCounter target={silverReward} duration={900} />
        </p>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.16em',
            color: 'var(--po-text-dim)',
            textTransform: 'uppercase',
          }}
        >
          Silver
        </span>

        {showComparison && (
          <span
            style={{
              marginTop: 4,
              fontFamily: 'var(--po-font-body)',
              fontSize: 13,
              color: 'var(--po-text-dim)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {delta > 0 && '+'}{delta} vs last
          </span>
        )}
      </div>

      {/* Optional breakdown — game-authored slot */}
      {breakdown && <div>{breakdown}</div>}

      {/* Submit (primary, accent) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={onSubmit}
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--po-text)',
            background: `linear-gradient(180deg, color-mix(in oklch, ${accent} 95%, white) 0%, ${accent} 100%)`,
            border: 'none',
            borderRadius: 14,
            padding: '14px 32px',
            minHeight: 48,
            width: '100%',
            maxWidth: 320,
            cursor: 'pointer',
            boxShadow: [
              `inset 0 1px 0 color-mix(in oklch, ${accent} 60%, white)`,
              `0 6px 18px -8px color-mix(in oklch, ${accent} 60%, transparent)`,
            ].join(', '),
            transition: 'transform 120ms ease',
          }}
          onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
          onPointerUp={(e) => { e.currentTarget.style.transform = ''; }}
          onPointerLeave={(e) => { e.currentTarget.style.transform = ''; }}
        >
          Submit Score
        </button>
        <span
          style={{
            fontFamily: 'var(--po-font-body)',
            fontSize: 11,
            color: 'var(--po-text-dim)',
            letterSpacing: 0.08,
          }}
        >
          This is final
        </span>
      </div>

      {/* Retry (secondary, ghost) */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={onRetry}
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--po-text-dim)',
            background: 'transparent',
            border: `1px solid color-mix(in oklch, var(--po-text) 18%, transparent)`,
            borderRadius: 12,
            padding: '12px 24px',
            minHeight: 44,
            cursor: 'pointer',
            transition: 'color 200ms ease, border-color 200ms ease',
          }}
        >
          Play Again · Attempt {retryCount + 2}
        </button>
      </div>
    </motion.div>
  );
}
