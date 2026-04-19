import { useEffect, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';

interface GameCountdownProps {
  /** Game name shown above the digit. */
  gameName: string;
  /** Per-game accent for the digit glow. */
  accent: string;
  /** Optional: countdown start (epoch ms). When provided, the digit is
   *  derived from `Date.now()` so multi-player countdowns stay in sync.
   *  When omitted, the component owns a 3-2-1-GO timer. */
  startedAt?: number;
  /** Total countdown ms — defaults to 3000. */
  totalMs?: number;
  /** Called after GO frame finishes (one full beat after digit reaches 0). */
  onComplete?: () => void;
}

/**
 * Pre-game countdown — the moment the player commits to playing.
 *
 * Bigger and bolder than the old wrapper-baked countdown: each digit
 * gets its own kinetic beat (display font, accent inner glow), and GO!
 * is its own peak frame. Honors prefers-reduced-motion (digits cross-fade
 * instead of springing).
 */
export function GameCountdown({
  gameName,
  accent,
  startedAt,
  totalMs = 3000,
  onComplete,
}: GameCountdownProps) {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(() => deriveCount(startedAt, totalMs));

  useEffect(() => {
    const tick = () => {
      const next = deriveCount(startedAt, totalMs);
      setCount(next);
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [startedAt, totalMs]);

  // Fire onComplete one beat after digit reaches 0 (so GO! has stage time)
  useEffect(() => {
    if (count !== 0) return;
    const id = setTimeout(() => onComplete?.(), 600);
    return () => clearTimeout(id);
  }, [count, onComplete]);

  const display = count > 0 ? String(count) : 'GO';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px 36px',
        gap: 14,
        minHeight: 220,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.22em',
          color: 'var(--po-text-dim)',
          textTransform: 'uppercase',
        }}
      >
        {gameName}
      </span>

      <AnimatePresence mode="wait">
        <motion.span
          key={display}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
          animate={
            reduce
              ? { opacity: 1 }
              : { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 380, damping: 18 } }
          }
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.4, transition: { duration: 0.22 } }}
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(72px, 22vw, 128px)',
            fontWeight: 800,
            lineHeight: 0.9,
            letterSpacing: -0.04,
            color: 'var(--po-text)',
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 32px color-mix(in oklch, ${accent} 50%, transparent)`,
          }}
        >
          {display}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function deriveCount(startedAt: number | undefined, totalMs: number): number {
  if (!startedAt) return 3;
  const elapsed = Date.now() - startedAt;
  return Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
}
