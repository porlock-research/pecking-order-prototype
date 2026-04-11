import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { PULSE_SPRING } from '../../springs';
import { getPlayerColor } from '../../colors';

export function WinnerReveal() {
  const winner = useGameStore(s => s.winner);
  const roster = useGameStore(s => s.roster);
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (winner && !shownRef.current) {
      shownRef.current = true;
      setVisible(true);
      // Fire confetti
      import('canvas-confetti').then(mod => {
        const confetti = mod.default;
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      }).catch(() => {});
    }
  }, [winner]);

  if (!winner || !visible) return null;

  const player = roster[winner.playerId];
  const playerIndex = Object.keys(roster).indexOf(winner.playerId);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setVisible(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(10, 10, 14, 0.92)',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>{'👑'}</div>
        <motion.img
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={PULSE_SPRING.bouncy}
          src={player?.avatarUrl}
          alt={player?.personaName}
          style={{
            width: 160,
            height: 200,
            borderRadius: 20,
            objectFit: 'cover',
            marginBottom: 20,
            boxShadow: '0 0 40px rgba(255, 215, 0, 0.4)',
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
