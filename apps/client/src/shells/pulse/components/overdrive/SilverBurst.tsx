import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Coins } from '../../icons';
import { PULSE_Z } from '../../zIndex';

/**
 * SilverBurst — shell-level overdrive layer for silver sends.
 *
 * Fired by dispatching a window CustomEvent:
 *   window.dispatchEvent(new CustomEvent('pulse:silver-burst', {
 *     detail: { amount: 10, recipient: 'Alice' }
 *   }))
 *
 * Renders a self-contained particle shower + big "+N silver" text float
 * at the center of the viewport. Multiple rapid fires are supported — each
 * instance auto-removes after ~1000ms.
 *
 * Respects prefers-reduced-motion (falls back to a simple text fade).
 */

interface BurstSpec {
  id: number;
  amount: number;
  recipient: string;
}

const PARTICLE_COUNT = 14;

function randomParticles(seed: number) {
  // Evenly spaced angles with random jitter so the shower reads radial,
  // not clumpy. Velocities vary slightly for depth.
  const step = (Math.PI * 2) / PARTICLE_COUNT;
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = i * step + (((seed * 9301 + i * 49297) % 233280) / 233280 - 0.5) * 0.4;
    const speed = 140 + ((seed * 17 + i * 23) % 80);
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      rot: (((seed + i * 7) % 720) - 360),
      delay: (i % 5) * 0.02,
      size: 18 + ((seed + i) % 12),
    };
  });
}

function SilverBurstInstance({ amount, recipient, reduce }: { amount: number; recipient: string; reduce: boolean }) {
  if (reduce) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.0, times: [0, 0.2, 0.7, 1] }}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, zIndex: PULSE_Z.reveal,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 32, fontWeight: 700,
          color: 'var(--pulse-gold)',
          textShadow: '0 4px 20px rgba(255,200,61,0.6)',
        }}>
          +{amount} silver
        </div>
      </motion.div>
    );
  }

  const particles = randomParticles(amount);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: PULSE_Z.reveal,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Gold vignette pulse on viewport edges */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.18, 0] }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(255,200,61,0.5) 100%)',
        }}
      />

      {/* Coin particle shower */}
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        {particles.map((p, i) => (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
            animate={{
              x: p.vx,
              y: p.vy + 180, // gravity pulls below spread
              opacity: 0,
              rotate: p.rot,
              scale: 1,
            }}
            transition={{ duration: 0.9, delay: p.delay, ease: [0.2, 0.6, 0.4, 1] }}
            style={{ position: 'absolute', top: 0, left: 0, willChange: 'transform' }}
          >
            <Coins size={p.size} weight="fill" style={{ color: 'var(--pulse-gold)', filter: 'drop-shadow(0 2px 8px rgba(255,200,61,0.6))' }} />
          </motion.div>
        ))}
      </div>

      {/* Big "+N silver" text float-up */}
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.8 }}
        animate={{
          y: [-20, -60, -80],
          opacity: [0, 1, 1, 0],
          scale: [0.8, 1.15, 1, 1],
        }}
        transition={{ duration: 0.95, times: [0, 0.25, 0.5, 1], ease: 'easeOut' }}
        style={{
          position: 'absolute',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 'var(--pulse-space-xs)',
          pointerEvents: 'none',
        }}
      >
        <div style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 'clamp(40px, 9vw, 64px)',
          fontWeight: 700,
          letterSpacing: -1,
          lineHeight: 1,
          color: 'var(--pulse-gold)',
          textShadow: '0 4px 24px rgba(255,200,61,0.7), 0 0 40px rgba(255,200,61,0.4)',
        }}>
          +{amount}
        </div>
        <div style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: 'var(--pulse-gold)',
          opacity: 0.9,
        }}>
          silver → {recipient}
        </div>
      </motion.div>
    </div>
  );
}

export function SilverBurst() {
  const [bursts, setBursts] = useState<BurstSpec[]>([]);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { amount: number; recipient: string } | undefined;
      if (!detail) return;
      const id = Date.now() + Math.random();
      setBursts(prev => [...prev, { id, amount: detail.amount, recipient: detail.recipient }]);
      window.setTimeout(() => {
        setBursts(prev => prev.filter(b => b.id !== id));
      }, 1100);
    };
    window.addEventListener('pulse:silver-burst', handler);
    return () => window.removeEventListener('pulse:silver-burst', handler);
  }, []);

  return (
    <AnimatePresence>
      {bursts.map(b => (
        <SilverBurstInstance key={b.id} amount={b.amount} recipient={b.recipient} reduce={reduce} />
      ))}
    </AnimatePresence>
  );
}
