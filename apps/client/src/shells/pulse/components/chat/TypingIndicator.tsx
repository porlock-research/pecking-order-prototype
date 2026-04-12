import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';

/**
 * Renders typing indicators for players currently typing in MAIN channel.
 * Reads from `typingPlayers` store field (populated by PRESENCE.TYPING events).
 */
export function TypingIndicator() {
  const typingPlayers = useGameStore(s => s.typingPlayers);
  const roster = useGameStore(s => s.roster);
  const { playerId } = usePulse();

  // typingPlayers: Record<playerId, channel>
  const typing = Object.entries(typingPlayers)
    .filter(([pid, channel]) => pid !== playerId && channel === 'MAIN')
    .map(([pid]) => pid);

  if (typing.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={PULSE_SPRING.gentle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        fontSize: 12,
        color: 'var(--pulse-text-3)',
        fontFamily: 'var(--po-font-body)',
      }}
    >
      {/* Stacked avatars */}
      <div style={{ display: 'flex', position: 'relative', width: 24 + (typing.length - 1) * 14 }}>
        {typing.slice(0, 3).map((pid, i) => (
          <img
            key={pid}
            src={roster[pid]?.avatarUrl}
            alt=""
            style={{
              position: 'absolute',
              left: i * 14,
              width: 22,
              height: 22,
              borderRadius: 6,
              objectFit: 'cover',
              objectPosition: 'center top',
              border: '2px solid var(--pulse-bg)',
              zIndex: 10 - i,
            }}
          />
        ))}
      </div>

      {/* Names */}
      <span>
        {typing.slice(0, 2).map((pid, i) => {
          const p = roster[pid];
          const color = getPlayerColor(Object.keys(roster).indexOf(pid));
          return (
            <span key={pid}>
              <span style={{ color, fontWeight: 700 }}>{p?.personaName?.split(' ')[0]}</span>
              {i < Math.min(typing.length, 2) - 1 && ' & '}
            </span>
          );
        })}
        {typing.length > 2 && ` +${typing.length - 2}`}
        <span style={{ marginLeft: 4, fontStyle: 'italic' }}>typing</span>
      </span>

      {/* Animated dots */}
      <div style={{ display: 'flex', gap: 3 }}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'var(--pulse-text-3)',
              animation: `pulse-breathe 1s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
