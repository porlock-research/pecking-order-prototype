import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { useRevealQueue } from '../../hooks/useRevealQueue';
import { PULSE_SPRING } from '../../springs';
import { getPlayerColor } from '../../colors';
import { PULSE_Z } from '../../zIndex';

export function EliminationReveal() {
  const roster = useGameStore(s => s.roster);
  const { current, dismiss } = useRevealQueue();

  if (!current || current.kind !== 'elimination') return null;

  const eliminatedId = Object.entries(roster)
    .find(([, p]) => p.status === 'ELIMINATED' && (p as any).eliminatedOnDay === current.dayIndex)?.[0];
  if (!eliminatedId) return null;
  const player = roster[eliminatedId];
  const playerIndex = Object.keys(roster).indexOf(eliminatedId);

  return (
    <AnimatePresence>
      <motion.div
        data-testid="elimination-reveal"
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
    </AnimatePresence>
  );
}
