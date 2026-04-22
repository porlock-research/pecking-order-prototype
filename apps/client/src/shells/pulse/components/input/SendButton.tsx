import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { PULSE_TAP } from '../../springs';

type Variant = 'accent' | 'silver' | 'whisper' | 'confession' | 'nudge';
type Shape = 'icon' | 'pill' | 'fullWidth';

interface SendButtonProps {
  variant: Variant;
  shape: Shape;
  onClick: () => void;
  /** Intent-level gating (e.g. no text yet). Dims and blocks taps. */
  disabled?: boolean;
  /** Post-tap in-flight cooldown. Dims, blocks taps, shows `wait` cursor + aria-busy. */
  pending?: boolean;
  children?: ReactNode;
  ariaLabel?: string;
  /** Per-call overrides merged after defaults — use for one-off nudges (mount sheen, etc.). */
  style?: React.CSSProperties;
  className?: string;
  /** When present, scale+opacity entrance animation. Used by PulseInput's appearing send button. */
  animateIn?: boolean;
}

const VARIANT_BG: Record<Variant, string> = {
  accent: 'var(--pulse-accent)',
  silver: 'var(--pulse-gold)',
  whisper: 'var(--pulse-whisper)',
  confession: 'linear-gradient(180deg, #ff2a3d, #d01f2f)',
  nudge: 'var(--pulse-nudge)',
};

const VARIANT_FG: Record<Variant, string> = {
  accent: 'var(--pulse-on-accent)',
  silver: 'var(--pulse-on-gold)',
  whisper: 'var(--pulse-on-accent)',
  confession: '#fff',
  nudge: 'var(--pulse-on-gold)',
};

const VARIANT_BORDER: Partial<Record<Variant, string>> = {
  confession: '1px solid #ff2a3d',
};

const VARIANT_SHADOW: Partial<Record<Variant, string>> = {
  confession: '0 10px 24px rgba(255,42,61,0.32), inset 0 1px 0 rgba(255,255,255,0.18)',
};

const SHAPE_STYLE: Record<Shape, React.CSSProperties> = {
  icon: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    // 44px minimum tap target — teens on phones. Horizontal padding
    // drives the button's visible width; the minHeight absorbs any
    // shortfall from the typographic line-box.
    minHeight: 44,
    padding: '8px 16px',
    borderRadius: 'var(--pulse-radius-sm)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
    fontFamily: 'var(--po-font-body)',
  },
  fullWidth: {
    width: '100%',
    padding: 14,
    borderRadius: 'var(--pulse-radius-lg)',
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: 0.1,
    fontFamily: 'var(--po-font-body)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

/**
 * Unified Pulse send affordance. Consolidates 5+ bespoke send buttons across
 * PulseInput, CommandPreview, DmInput, SendSilverSheet, WhisperMode,
 * ConfessionInput into one component.
 *
 * `variant` tints the button via existing hue tokens (accent / gold /
 * whisper / confession-red / nudge-orange). `shape` picks the geometry —
 * icon (44px circle), pill (inline rect), or fullWidth (CTA row).
 *
 * `disabled` is intent-level (no text yet); `pending` is post-tap cooldown
 * driven by the `useInFlight` hook. Both block taps; `pending` additionally
 * sets `cursor: wait` and `aria-busy` so assistive tech hears the send as
 * in-flight rather than permanently unavailable.
 */
export function SendButton({
  variant,
  shape,
  onClick,
  disabled = false,
  pending = false,
  children,
  ariaLabel,
  style,
  className,
  animateIn = false,
}: SendButtonProps) {
  const isDisabled = disabled || pending;

  const dimOpacity = pending ? 0.55 : disabled ? 0.5 : 1;
  const resolvedCursor = pending ? 'wait' : disabled ? 'not-allowed' : 'pointer';

  const merged: React.CSSProperties = {
    border: VARIANT_BORDER[variant] ?? 'none',
    background: VARIANT_BG[variant],
    color: VARIANT_FG[variant],
    cursor: resolvedCursor,
    opacity: dimOpacity,
    pointerEvents: pending ? 'none' : 'auto',
    ...(VARIANT_SHADOW[variant] ? { boxShadow: VARIANT_SHADOW[variant] } : {}),
    ...SHAPE_STYLE[shape],
    ...style,
  };

  return (
    <motion.button
      type="button"
      whileTap={isDisabled ? undefined : PULSE_TAP.button}
      initial={animateIn ? { scale: 0, opacity: 0 } : undefined}
      animate={animateIn ? { scale: 1, opacity: dimOpacity } : undefined}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={pending}
      className={className}
      style={merged}
    >
      {children}
    </motion.button>
  );
}
