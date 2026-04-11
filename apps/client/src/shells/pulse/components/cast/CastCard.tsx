import { motion } from 'framer-motion';
import { MessageCircle, Coins, Hand } from 'lucide-react';
import { getPlayerColor } from '../../colors';
import { StatusRing } from '../StatusRing';
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
  const isEliminated = player.status === 'ELIMINATED';
  const color = getPlayerColor(playerIndex);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: isEliminated ? 0.95 : 1 }}
      transition={PULSE_SPRING.snappy}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        background: 'var(--pulse-surface)',
        border: '1px solid var(--pulse-border)',
        opacity: isEliminated ? 0.6 : 1,
        filter: isEliminated ? 'grayscale(1)' : undefined,
        transition: 'filter 0.5s ease, opacity 0.5s ease',
      }}
    >
      {/* Portrait */}
      <StatusRing playerId={playerId} size={130}>
        <img
          src={player.avatarUrl}
          alt={player.personaName}
          style={{
            width: '100%',
            height: 130,
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </StatusRing>

      {/* Info */}
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color, fontFamily: 'var(--po-font-body)' }}>
          {player.personaName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: 'var(--pulse-text-3)' }}>
          <Coins size={12} style={{ color: 'var(--pulse-gold)' }} />
          <span>{player.silver}</span>
        </div>
      </div>

      {/* Actions */}
      {!isEliminated && (
        <div style={{ display: 'flex', borderTop: '1px solid var(--pulse-border)' }}>
          {[
            { Icon: MessageCircle, color: 'var(--pulse-accent)', handler: onDM },
            { Icon: Coins, color: 'var(--pulse-gold)', handler: onSilver },
            { Icon: Hand, color: 'var(--pulse-nudge)', handler: onNudge },
          ].map(({ Icon, color: c, handler }, i) => (
            <motion.button
              key={i}
              whileTap={PULSE_TAP.button}
              onClick={handler}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: c,
                borderRight: i < 2 ? '1px solid var(--pulse-border)' : undefined,
              }}
            >
              <Icon size={16} />
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
