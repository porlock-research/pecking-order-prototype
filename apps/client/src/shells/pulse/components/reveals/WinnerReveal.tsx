import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { useRevealQueue } from '../../hooks/useRevealQueue';
import { PULSE_SPRING } from '../../springs';
import { getPlayerColor } from '../../colors';
import { PULSE_Z } from '../../zIndex';

export function WinnerReveal() {
  const winner = useGameStore(s => s.winner);
  const roster = useGameStore(s => s.roster);
  const { current, dismiss } = useRevealQueue();
  const confettiFired = useRef(false);

  const showing = current?.kind === 'winner' && winner;

  useEffect(() => {
    if (showing && !confettiFired.current) {
      confettiFired.current = true;
      import('canvas-confetti').then(mod => {
        const confetti = mod.default;
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      }).catch(() => {});
    }
  }, [showing]);

  useEffect(() => {
    if (!showing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showing, dismiss]);

  if (!showing || !winner) return null;

  const player = roster[winner.playerId];
  const playerIndex = Object.keys(roster).indexOf(winner.playerId);

  return (
    <AnimatePresence>
      <motion.div
        data-testid="winner-reveal"
        role="dialog"
        aria-modal="true"
        aria-label={`${player?.personaName ?? 'Winner'} wins`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={dismiss}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: PULSE_Z.reveal,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(10, 10, 14, 0.92)',
          cursor: 'pointer',
        }}
      >
        <div aria-hidden="true" style={{ fontSize: 48, marginBottom: 12 }}>{'👑'}</div>
        <motion.img
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={PULSE_SPRING.bouncy}
          src={player?.avatarUrl}
          alt=""
          loading="lazy"
          width={160}
          height={200}
          style={{
            width: 160,
            height: 200,
            borderRadius: 20,
            objectFit: 'cover',
            marginBottom: 20,
            boxShadow: '0 0 40px var(--pulse-gold-glow)',
          }}
        />
        <div style={{ fontWeight: 800, fontSize: 24, color: getPlayerColor(playerIndex), fontFamily: 'var(--po-font-display)', marginBottom: 4 }}>
          {player?.personaName}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--pulse-gold)', fontFamily: 'var(--po-font-body)', letterSpacing: 2, textTransform: 'uppercase' }}>
          Winner!
        </div>
        <div style={{ position: 'absolute', bottom: 40, fontSize: 12, color: 'var(--pulse-text-3)' }}>
          Tap to dismiss
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
