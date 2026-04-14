import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { PULSE_SPRING } from '../../springs';
import { getPlayerColor } from '../../colors';
import { PULSE_Z } from '../../zIndex';

const SEEN_KEY = 'pulse_elim_seen';

export function EliminationReveal() {
  const roster = useGameStore(s => s.roster);
  const completedCartridges = useGameStore(s => s.completedCartridges);
  const [visible, setVisible] = useState(false);
  const [eliminatedId, setEliminatedId] = useState<string | null>(null);
  const prevRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Look for newly eliminated players
    const eliminated = Object.entries(roster)
      .filter(([_, p]) => p.status === 'ELIMINATED')
      .map(([id]) => id);

    const seen = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'));
    const newElim = eliminated.find(id => !prevRef.current.has(id) && !seen.has(id));

    if (newElim) {
      setEliminatedId(newElim);
      setVisible(true);
      seen.add(newElim);
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
    }

    prevRef.current = new Set(eliminated);
  }, [roster]);

  const player = eliminatedId ? roster[eliminatedId] : null;
  const playerIndex = eliminatedId ? Object.keys(roster).indexOf(eliminatedId) : 0;

  return (
    <AnimatePresence>
      {visible && player && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setVisible(false)}
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
            boxShadow: 'inset 0 0 120px rgba(255, 40, 40, 0.15)',
          }}
        >
          <motion.img
            initial={{ scale: 1.05, filter: 'grayscale(0)' }}
            animate={{ scale: 1, filter: 'grayscale(1)' }}
            transition={{ duration: 0.5 }}
            src={player.avatarUrl}
            alt={player.personaName}
            style={{
              width: 160,
              height: 200,
              borderRadius: 20,
              objectFit: 'cover',
              marginBottom: 20,
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...PULSE_SPRING.gentle }}
            style={{ textAlign: 'center' }}
          >
            <div style={{ fontWeight: 800, fontSize: 22, color: getPlayerColor(playerIndex), fontFamily: 'var(--po-font-display)', marginBottom: 4 }}>
              {player.personaName}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#ff4444', fontFamily: 'var(--po-font-body)', letterSpacing: 2, textTransform: 'uppercase' }}>
              Eliminated
            </div>
          </motion.div>
          <div style={{ position: 'absolute', bottom: 40, fontSize: 12, color: 'var(--pulse-text-3)' }}>
            Tap to dismiss
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
