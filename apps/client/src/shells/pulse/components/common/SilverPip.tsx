import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Coins } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { PULSE_SPRING } from '../../springs';

interface Props {
  /** 'global' sits on the PulseHeader; 'compose' sits on the DmInput row. */
  variant?: 'global' | 'compose';
}

/**
 * The player's own silver balance with a counter-roll animation on change.
 * One component, two slots: global (PulseHeader) and contextual (DmInput).
 *
 * Grammar:
 * - Gold at rest = "this is your silver, calm ambient state."
 * - Orange when ≤2 = "low, start caring."
 * - Counter-roll (digit slides) on decrement = honest ledger without
 *   stealing attention. Distinguishable from SilverBurst (the gift moment)
 *   which is loud by design.
 */
export function SilverPip({ variant = 'global' }: Props) {
  const { playerId } = usePulse();
  const silver = useGameStore(s => s.roster[playerId]?.silver ?? 0);
  const reduce = useReducedMotion();

  const [displayed, setDisplayed] = useState(silver);
  const [delta, setDelta] = useState<number | null>(null);
  const prevRef = useRef(silver);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev === silver) return;
    const diff = silver - prev;
    prevRef.current = silver;
    setDelta(diff);
    setDisplayed(silver);
    const timer = setTimeout(() => setDelta(null), 700);
    return () => clearTimeout(timer);
  }, [silver]);

  const isLow = displayed <= 2;
  const isZero = displayed === 0;
  const countColor = isLow ? 'var(--pulse-pending)' : 'var(--pulse-gold)';

  const size = variant === 'global' ? { glyph: 14, count: 13, gap: 5 } : { glyph: 14, count: 13, gap: 5 };

  return (
    <div
      aria-label={`Your silver: ${displayed}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size.gap,
        padding: variant === 'global' ? '2px 8px' : '2px 6px',
        borderRadius: 'var(--pulse-radius-sm)',
        background: variant === 'global' ? 'var(--pulse-surface-2)' : 'transparent',
        border: variant === 'global' ? '1px solid var(--pulse-border)' : 'none',
        position: 'relative',
      }}
    >
      <Coins
        size={size.glyph}
        weight="fill"
        style={{ color: isZero ? 'var(--pulse-pending)' : 'var(--pulse-gold)', flexShrink: 0 }}
      />
      {/* Rolling counter: key-based exit/enter on value change */}
      <div
        style={{
          position: 'relative',
          minWidth: `${String(displayed).length}ch`,
          height: size.count + 4,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={displayed}
            initial={reduce ? { y: 0, opacity: 1 } : { y: (delta ?? 0) > 0 ? 14 : -14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: (delta ?? 0) > 0 ? -14 : 14, opacity: 0 }}
            transition={reduce ? { duration: 0.15 } : PULSE_SPRING.snappy}
            style={{
              fontSize: size.count,
              fontWeight: 700,
              fontFamily: 'var(--po-font-body)',
              color: countColor,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 0.1,
              lineHeight: 1,
              display: 'inline-block',
            }}
          >
            {displayed}
          </motion.span>
        </AnimatePresence>
      </div>
      {/* Ephemeral delta float — only on decrement, stays calm (no glow) */}
      <AnimatePresence>
        {delta !== null && delta < 0 && !reduce && (
          <motion.span
            key={`delta-${delta}-${displayed}`}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], y: -18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              right: 6,
              top: -2,
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--pulse-text-3)',
              fontVariantNumeric: 'tabular-nums',
              pointerEvents: 'none',
            }}
          >
            {delta}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
