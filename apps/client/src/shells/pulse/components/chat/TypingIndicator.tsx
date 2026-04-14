import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';

interface TypingIndicatorProps {
  /** Channel id to filter typing events on. Pass 'MAIN' for global chat, a channel id for a DM. */
  channelId: string;
}

/**
 * Minimal typing indicator — just text with animated dots.
 * The PulseBar already shows per-player typing status via avatar badges;
 * this provides a focused name-based indicator near the input.
 */
export function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const typingPlayers = useGameStore(s => s.typingPlayers);
  const roster = useGameStore(s => s.roster);
  const { playerId } = usePulse();

  const typing = Object.entries(typingPlayers)
    .filter(([pid, channel]) => pid !== playerId && channel === channelId)
    .map(([pid]) => pid);

  if (typing.length === 0) return null;

  const names = typing.slice(0, 2).map(pid => ({
    id: pid,
    name: roster[pid]?.personaName?.split(' ')[0] ?? '',
    color: getPlayerColor(Object.keys(roster).indexOf(pid)),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={PULSE_SPRING.gentle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 14px 2px',
        fontSize: 11,
        color: 'var(--pulse-text-3)',
        fontFamily: 'var(--po-font-body)',
      }}
    >
      <span>
        {names.map((n, i) => (
          <span key={n.id}>
            <span style={{ color: n.color, fontWeight: 700 }}>{n.name}</span>
            {i < names.length - 1 && ', '}
          </span>
        ))}
        {typing.length > 2 && ` +${typing.length - 2}`}
        <span style={{ marginLeft: 4, fontStyle: 'italic' }}>typing</span>
      </span>
      <div style={{ display: 'flex', gap: 2 }}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              width: 3, height: 3, borderRadius: '50%',
              background: 'var(--pulse-text-3)',
              animation: `pulse-breathe 1s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
