import { motion } from 'framer-motion';
import type { CartridgeKind } from '@pecking-order/shared-types';
import { PULSE_TAP } from '../../springs';
import { useCountdownWithUrgency } from '../../../../hooks/useCountdown';

const KIND_COLORS: Record<CartridgeKind, string> = {
  voting: 'var(--pulse-vote)',
  game: 'var(--pulse-game)',
  prompt: 'var(--pulse-prompt)',
  dilemma: 'var(--pulse-dilemma)',
};

interface Props {
  kind: CartridgeKind;
  label: string;
  /** Deadline epoch ms for active cartridges with a timer; null otherwise. */
  deadline: number | null;
  onClose: () => void;
}

export function CartridgeOverlayHeader({ kind, label, deadline, onClose }: Props) {
  const { label: timerLabel, urgent } = useCountdownWithUrgency(deadline);
  const dotColor = KIND_COLORS[kind];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingLeft: 8,
        paddingRight: 16,
        height: 44,
        borderBottom: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)',
        flexShrink: 0,
      }}
    >
      <motion.button
        onClick={onClose}
        whileTap={PULSE_TAP.button}
        aria-label="Close cartridge"
        style={{
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--pulse-border)',
          borderRadius: 999,
          color: 'var(--pulse-text-1)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--pulse-text-1)',
            fontFamily: 'var(--po-font-body)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </span>
      </div>

      {timerLabel && (
        <span
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 14,
            fontWeight: 700,
            color: urgent ? 'var(--pulse-accent)' : dotColor,
            letterSpacing: 0.5,
            flexShrink: 0,
          }}
        >
          {timerLabel}
        </span>
      )}
    </div>
  );
}
