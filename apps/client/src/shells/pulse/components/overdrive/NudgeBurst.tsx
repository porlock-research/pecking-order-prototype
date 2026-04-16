import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { HandWaving } from '../../icons';
import { PULSE_Z } from '../../zIndex';

/**
 * NudgeBurst — shell-level overdrive layer for nudge sends.
 *
 * Fired by dispatching a window CustomEvent:
 *   window.dispatchEvent(new CustomEvent('pulse:nudge-burst', {
 *     detail: { recipient: 'Alice' }
 *   }))
 *
 * Renders concentric orange shockwave rings + a big "NUDGED" text float with
 * a waving hand. Multiple rapid fires supported — each instance auto-removes
 * after ~900ms.
 *
 * Respects prefers-reduced-motion (falls back to a simple text fade).
 */

interface BurstSpec {
  id: number;
  recipient: string;
}

function NudgeBurstInstance({ recipient, reduce }: { recipient: string; reduce: boolean }) {
  if (reduce) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.9, times: [0, 0.2, 0.7, 1] }}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: PULSE_Z.reveal,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 28, fontWeight: 700,
          color: 'var(--pulse-nudge)',
          textShadow: '0 4px 20px rgba(255,160,77,0.6)',
        }}>
          Nudged {recipient}
        </div>
      </motion.div>
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: PULSE_Z.reveal,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Edge flicker — subtle orange wash */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.14, 0] }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(255,160,77,0.55) 100%)',
        }}
      />

      {/* Shockwave rings — 3 concentric, staggered */}
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0.7 }}
            animate={{ scale: 4 + i * 1.1, opacity: 0 }}
            transition={{ duration: 0.75 + i * 0.1, delay: i * 0.12, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: -60, left: -60,
              width: 120, height: 120,
              borderRadius: '50%',
              border: '2.5px solid var(--pulse-nudge)',
              boxShadow: '0 0 20px rgba(255,160,77,0.4)',
              willChange: 'transform',
            }}
          />
        ))}
      </div>

      {/* Big "NUDGED" text with waving hand */}
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.8 }}
        animate={{
          y: [0, -30, -50],
          opacity: [0, 1, 1, 0],
          scale: [0.8, 1.12, 1, 1],
        }}
        transition={{ duration: 0.85, times: [0, 0.3, 0.55, 1], ease: 'easeOut' }}
        style={{
          position: 'absolute',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 'var(--pulse-space-xs)',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-md)',
        }}>
          <motion.span
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, -22, 20, -14, 12, 0] }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeInOut' }}
            style={{ display: 'inline-flex', transformOrigin: '70% 80%' }}
          >
            <HandWaving size={44} weight="fill" style={{ color: 'var(--pulse-nudge)', filter: 'drop-shadow(0 4px 16px rgba(255,160,77,0.6))' }} />
          </motion.span>
          <div style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(32px, 8vw, 52px)',
            fontWeight: 700,
            letterSpacing: 2,
            lineHeight: 1,
            textTransform: 'uppercase',
            color: 'var(--pulse-nudge)',
            textShadow: '0 4px 20px rgba(255,160,77,0.7), 0 0 36px rgba(255,160,77,0.4)',
          }}>
            Nudged
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: 'var(--pulse-nudge)',
          opacity: 0.9,
        }}>
          → {recipient}
        </div>
      </motion.div>
    </div>
  );
}

export function NudgeBurst() {
  const [bursts, setBursts] = useState<BurstSpec[]>([]);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { recipient: string } | undefined;
      if (!detail) return;
      const id = Date.now() + Math.random();
      setBursts(prev => [...prev, { id, recipient: detail.recipient }]);
      window.setTimeout(() => {
        setBursts(prev => prev.filter(b => b.id !== id));
      }, 1000);
    };
    window.addEventListener('pulse:nudge-burst', handler);
    return () => window.removeEventListener('pulse:nudge-burst', handler);
  }, []);

  return (
    <AnimatePresence>
      {bursts.map(b => (
        <NudgeBurstInstance key={b.id} recipient={b.recipient} reduce={reduce} />
      ))}
    </AnimatePresence>
  );
}
