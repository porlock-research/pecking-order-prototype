import { motion } from 'framer-motion';
import { MessageCircle, Coins, Hand } from 'lucide-react';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING, PULSE_TAP } from '../../springs';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface CastCardProps {
  player: SocialPlayer;
  playerId: string;
  playerIndex: number;
  onSilver: () => void;
  onDM: () => void;
  onNudge: () => void;
}

export function CastCard({ player, playerId, playerIndex, onSilver, onDM, onNudge }: CastCardProps) {
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const isEliminated = player.status === 'ELIMINATED';
  const isOnline = onlinePlayers.includes(playerId);
  const color = getPlayerColor(playerIndex);
  // Use bio as pseudo-stereotype (first 3 words)
  const stereotype = player.bio?.split(/[.!?]/)[0]?.slice(0, 40) ?? '';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: isEliminated ? 0.95 : 1 }}
      transition={PULSE_SPRING.snappy}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        background: 'var(--pulse-surface)',
        border: isOnline ? `1px solid ${color}40` : '1px solid var(--pulse-border)',
        opacity: isEliminated ? 0.6 : 1,
        filter: isEliminated ? 'grayscale(1)' : undefined,
        transition: 'filter 0.5s ease, opacity 0.5s ease, border-color 0.3s ease',
        position: 'relative',
      }}
    >
      {/* Full-width portrait */}
      <div style={{ position: 'relative', width: '100%' }}>
        <img
          src={player.avatarUrl}
          alt={player.personaName}
          style={{
            width: '100%',
            height: 150,
            objectFit: 'cover',
            objectPosition: 'center 25%',
            display: 'block',
          }}
        />
        {/* Online indicator */}
        {isOnline && !isEliminated && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 10,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              fontSize: 9,
              fontWeight: 700,
              color: '#2ecc71',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 5px #2ecc71' }} />
            Live
          </div>
        )}
        {/* Silver badge bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 10,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--pulse-gold)',
          }}
        >
          <Coins size={12} />
          <span>{player.silver}</span>
        </div>
      </div>

      {/* Name + stereotype */}
      <div style={{ padding: '10px 12px 8px' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color, fontFamily: 'var(--po-font-body)', letterSpacing: -0.2 }}>
          {player.personaName}
        </div>
        {stereotype && (
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--pulse-text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stereotype}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isEliminated && (
        <div style={{ display: 'flex', borderTop: '1px solid var(--pulse-border)' }}>
          {[
            { Icon: MessageCircle, handler: onDM, label: 'DM' },
            { Icon: Coins, handler: onSilver, label: 'Silver' },
            { Icon: Hand, handler: onNudge, label: 'Nudge' },
          ].map(({ Icon, handler, label }, i) => (
            <motion.button
              key={i}
              whileTap={PULSE_TAP.button}
              onClick={handler}
              aria-label={label}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--pulse-text-2)',
                borderRight: i < 2 ? '1px solid var(--pulse-border)' : undefined,
              }}
            >
              <Icon size={16} strokeWidth={2} />
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
