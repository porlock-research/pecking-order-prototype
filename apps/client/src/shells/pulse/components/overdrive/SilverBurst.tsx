import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Coins } from '../../icons';
import { PULSE_Z } from '../../zIndex';

/**
 * SilverBurst — shell-level overdrive layer for silver events.
 *
 * Two variants gated by `direction`:
 *
 *   'sent'     — sender's dopamine echo: brief (~0.95s), particle shower
 *                + "+N silver → Recipient" text float. Fired from
 *                PulseInput after engine.sendSilver.
 *
 *   'received' — recipient's comprehension moment: ~2.1s hold, sender
 *                portrait anchor, "+N" + "silver from Sender" below.
 *                Fired from useReceivedOverdrive on SYNC replay or
 *                live event arrival. Face-first because the recipient
 *                needs to know WHO before WHAT.
 *
 * Event detail:
 *   { direction: 'sent', amount, recipient }
 *   { direction: 'received', amount, from, senderAvatarUrl }
 *
 * Defaults to 'sent' for backward compat with existing sender-side dispatch.
 */

interface BurstSpec {
  id: number;
  direction: 'sent' | 'received';
  amount: number;
  /** For 'sent': recipient name. For 'received': sender name. */
  who: string;
  /** Only for 'received': sender's portrait URL. null → text-only fallback. */
  senderAvatarUrl: string | null;
}

const PARTICLE_COUNT = 14;

function randomParticles(seed: number) {
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

function SentBurstInstance({ amount, who, reduce }: { amount: number; who: string; reduce: boolean }) {
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
          textShadow: '0 4px 20px color-mix(in oklch, var(--pulse-gold) 60%, transparent)',
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.18, 0] }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, color-mix(in oklch, var(--pulse-gold) 50%, transparent) 100%)',
        }}
      />
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        {particles.map((p, i) => (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
            animate={{ x: p.vx, y: p.vy + 180, opacity: 0, rotate: p.rot, scale: 1 }}
            transition={{ duration: 0.9, delay: p.delay, ease: [0.2, 0.6, 0.4, 1] }}
            style={{ position: 'absolute', top: 0, left: 0, willChange: 'transform' }}
          >
            <Coins size={p.size} weight="fill" style={{ color: 'var(--pulse-gold)', filter: 'drop-shadow(0 2px 8px color-mix(in oklch, var(--pulse-gold) 60%, transparent))' }} />
          </motion.div>
        ))}
      </div>
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
          textShadow: '0 4px 24px color-mix(in oklch, var(--pulse-gold) 70%, transparent), 0 0 40px color-mix(in oklch, var(--pulse-gold) 40%, transparent)',
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
          silver → {who}
        </div>
      </motion.div>
    </div>
  );
}

function ReceivedBurstInstance({
  amount,
  who,
  senderAvatarUrl,
  reduce,
}: {
  amount: number;
  who: string;
  senderAvatarUrl: string | null;
  reduce: boolean;
}) {
  if (reduce) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4.0, times: [0, 0.08, 0.8, 1] }}
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
          textShadow: '0 4px 20px color-mix(in oklch, var(--pulse-gold) 60%, transparent)',
        }}>
          +{amount} silver from {who}
        </div>
      </motion.div>
    );
  }

  // Received variant phases (exit handled by AnimatePresence — decoupled from
  // the parent setTimeout so we can't get clipped mid-fade):
  //   0-340ms   entry — portrait/content fade + scale up from 0.86
  //   340ms-3.2s hold — full opacity; brightness breathes 1.0 → 1.15 → 1.0
  //   3.2s+     exit — parent removes burst from state → AnimatePresence plays
  //             the `exit` transitions (opacity → 0, scale → 0.94) over 900ms
  // 10 particles (vs 14 for sent) — quieter shower so the portrait leads.
  const particles = randomParticles(amount + 3).slice(0, 10);

  const exitTransition = { duration: 0.9, ease: [0.4, 0, 0.3, 1] as [number, number, number, number] };

  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: exitTransition }}
      style={{
        position: 'fixed', inset: 0, zIndex: PULSE_Z.reveal,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      {/* Sustained gold vignette — fades in with entry; inherits parent exit. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.22 }}
        transition={{ duration: 0.34, ease: 'easeOut' }}
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, color-mix(in oklch, var(--pulse-gold) 50%, transparent) 100%)',
        }}
      />
      {/* Particle shower — quieter, starts after anticipation so portrait lands first. */}
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        {particles.map((p, i) => (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.6 }}
            animate={{
              x: [0, p.vx],
              y: [0, p.vy + 180],
              opacity: [0, 1, 0],
              rotate: [0, p.rot],
              scale: [0.6, 1],
            }}
            transition={{ duration: 1.0, delay: 0.22 + p.delay, ease: [0.2, 0.6, 0.4, 1] }}
            style={{ position: 'absolute', top: 0, left: 0, willChange: 'transform' }}
          >
            <Coins size={p.size} weight="fill" style={{ color: 'var(--pulse-gold)', filter: 'drop-shadow(0 2px 8px color-mix(in oklch, var(--pulse-gold) 60%, transparent))' }} />
          </motion.div>
        ))}
      </div>

      {/* The moment: portrait + amount + from. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.94, transition: exitTransition }}
        transition={{ duration: 0.34, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 'var(--pulse-space-sm)',
          pointerEvents: 'none',
        }}
      >
        {senderAvatarUrl && (
          <motion.div
            animate={{ filter: ['brightness(1.0)', 'brightness(1.15)', 'brightness(1.0)'] }}
            transition={{ duration: 3.2, times: [0, 0.5, 1], ease: 'easeInOut' }}
            style={{
              width: 140, height: 168, borderRadius: 20,
              overflow: 'hidden',
              boxShadow:
                '0 0 0 3px color-mix(in oklch, var(--pulse-gold) 35%, transparent), 0 0 48px color-mix(in oklch, var(--pulse-gold) 50%, transparent), 0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <img
              src={senderAvatarUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
            />
          </motion.div>
        )}
        <div style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 'clamp(52px, 11vw, 72px)',
          fontWeight: 700,
          letterSpacing: -2,
          lineHeight: 0.9,
          color: 'var(--pulse-gold)',
          textShadow: '0 4px 24px color-mix(in oklch, var(--pulse-gold) 70%, transparent), 0 0 48px color-mix(in oklch, var(--pulse-gold) 45%, transparent)',
        }}>
          +{amount}
        </div>
        <div style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: 'var(--pulse-gold)',
          opacity: 0.92,
          marginTop: -4,
        }}>
          silver from <span style={{ color: 'var(--pulse-text-1)' }}>{who}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function SilverBurst() {
  const [bursts, setBursts] = useState<BurstSpec[]>([]);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        direction?: 'sent' | 'received';
        amount: number;
        // sent variant
        recipient?: string;
        // received variant
        from?: string;
        senderAvatarUrl?: string | null;
      } | undefined;
      if (!detail) return;
      const direction = detail.direction ?? 'sent';
      const who = direction === 'sent' ? (detail.recipient ?? '') : (detail.from ?? '');
      const id = Date.now() + Math.random();
      const spec: BurstSpec = {
        id,
        direction,
        amount: detail.amount,
        who,
        senderAvatarUrl: detail.senderAvatarUrl ?? null,
      };
      setBursts(prev => [...prev, spec]);
      // Received: 340ms entry + ~2860ms hold = 3200ms, then AnimatePresence's
      // exit animation (~900ms) plays before unmount. Sender is atomic.
      const lifetime = direction === 'received' ? 3200 : 1100;
      window.setTimeout(() => {
        setBursts(prev => prev.filter(b => b.id !== id));
      }, lifetime);
    };
    window.addEventListener('pulse:silver-burst', handler);
    return () => window.removeEventListener('pulse:silver-burst', handler);
  }, []);

  return (
    <AnimatePresence>
      {bursts.map(b =>
        b.direction === 'received'
          ? <ReceivedBurstInstance key={b.id} amount={b.amount} who={b.who} senderAvatarUrl={b.senderAvatarUrl} reduce={reduce} />
          : <SentBurstInstance key={b.id} amount={b.amount} who={b.who} reduce={reduce} />
      )}
    </AnimatePresence>
  );
}
