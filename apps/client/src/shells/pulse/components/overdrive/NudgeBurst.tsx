import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { HandWaving } from '../../icons';
import { PULSE_Z } from '../../zIndex';

/**
 * NudgeBurst — shell-level overdrive layer for nudge events.
 *
 * Two variants gated by `direction` (default 'sent'):
 *
 *   'sent'     — brief (~0.85s) shockwave rings + "NUDGED → Recipient" text
 *                float. Fired from PulseShell.openNudge after engine.sendNudge.
 *
 *   'received' — ~2.1s hold with sender portrait + "Nudged" + "from Sender"
 *                below. Fired from useReceivedOverdrive. Face-first so the
 *                recipient registers WHO before WHAT.
 *
 * Event detail:
 *   { direction: 'sent', recipient }
 *   { direction: 'received', from, senderAvatarUrl }
 */

interface BurstSpec {
  id: number;
  direction: 'sent' | 'received';
  who: string;
  senderAvatarUrl: string | null;
}

function SentBurstInstance({ who, reduce }: { who: string; reduce: boolean }) {
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
          Nudged {who}
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.14, 0] }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(255,160,77,0.55) 100%)',
        }}
      />
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
          → {who}
        </div>
      </motion.div>
    </div>
  );
}

function ReceivedBurstInstance({
  who,
  senderAvatarUrl,
  reduce,
}: {
  who: string;
  senderAvatarUrl: string | null;
  reduce: boolean;
}) {
  if (reduce) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2.1, times: [0, 0.15, 0.85, 1] }}
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
          {who} nudged you
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
      {/* Sustained orange vignette — 2.1s beat matches Silver received. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.18, 0.12, 0] }}
        transition={{ duration: 2.1, times: [0, 0.12, 0.8, 1], ease: 'easeOut' }}
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(255,160,77,0.55) 100%)',
        }}
      />
      {/* Shockwave rings — fire staggered after the portrait lands. */}
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 4 + i * 1.1], opacity: [0, 0.65, 0] }}
            transition={{ duration: 0.85 + i * 0.1, delay: 0.28 + i * 0.12, ease: 'easeOut' }}
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

      <motion.div
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.86, 1.0, 1.0, 0.98] }}
        transition={{ duration: 2.1, times: [0, 0.12, 0.85, 1], ease: 'easeOut' }}
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
            transition={{ duration: 2.1, times: [0, 0.5, 1], ease: 'easeInOut' }}
            style={{
              width: 140, height: 168, borderRadius: 20,
              overflow: 'hidden',
              boxShadow:
                '0 0 0 3px rgba(255,160,77,0.35), 0 0 48px rgba(255,160,77,0.5), 0 20px 60px rgba(0,0,0,0.6)',
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
          display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-md)', marginTop: 2,
        }}>
          <motion.span
            animate={{ rotate: [0, -16, 18, -12, 10, 0] }}
            transition={{ duration: 0.6, delay: 0.35, ease: 'easeInOut' }}
            style={{ display: 'inline-flex', transformOrigin: '70% 80%' }}
          >
            <HandWaving size={40} weight="fill" style={{ color: 'var(--pulse-nudge)', filter: 'drop-shadow(0 4px 12px rgba(255,160,77,0.6))' }} />
          </motion.span>
          <div style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(32px, 9vw, 44px)',
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
          opacity: 0.92,
        }}>
          from <span style={{ color: 'var(--pulse-text-1)' }}>{who}</span>
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
      const detail = (e as CustomEvent).detail as {
        direction?: 'sent' | 'received';
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
        who,
        senderAvatarUrl: detail.senderAvatarUrl ?? null,
      };
      setBursts(prev => [...prev, spec]);
      const lifetime = direction === 'received' ? 2200 : 1000;
      window.setTimeout(() => {
        setBursts(prev => prev.filter(b => b.id !== id));
      }, lifetime);
    };
    window.addEventListener('pulse:nudge-burst', handler);
    return () => window.removeEventListener('pulse:nudge-burst', handler);
  }, []);

  return (
    <AnimatePresence>
      {bursts.map(b =>
        b.direction === 'received'
          ? <ReceivedBurstInstance key={b.id} who={b.who} senderAvatarUrl={b.senderAvatarUrl} reduce={reduce} />
          : <SentBurstInstance key={b.id} who={b.who} reduce={reduce} />
      )}
    </AnimatePresence>
  );
}
