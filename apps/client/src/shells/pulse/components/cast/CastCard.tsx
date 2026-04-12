import { motion } from 'framer-motion';
import { ChatCircle, Coins, HandWaving } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING, PULSE_TAP } from '../../springs';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface CastCardProps {
  player: SocialPlayer;
  playerId: string;
  playerIndex: number;
  rank?: number;
  isSelf?: boolean;
  compact?: boolean;
  onSilver: () => void;
  onDM: () => void;
  onNudge: () => void;
}

export function CastCard({ player, playerId, playerIndex, rank, isSelf, compact, onSilver, onDM, onNudge }: CastCardProps) {
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const isEliminated = player.status === 'ELIMINATED';
  const isOnline = onlinePlayers.includes(playerId);
  const color = getPlayerColor(playerIndex);
  // Use bio as pseudo-stereotype — hide if it's a placeholder value
  const rawBio = player.bio?.split(/[.!?]/)[0]?.trim() ?? '';
  const stereotype = rawBio.length > 4 && rawBio.length <= 50 ? rawBio : '';

  const portraitHeight = compact ? 80 : 150;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: isEliminated ? 0.95 : 1 }}
      transition={PULSE_SPRING.snappy}
      style={{
        borderRadius: compact ? 12 : 16,
        overflow: 'hidden',
        background: 'var(--pulse-surface)',
        border: isSelf
          ? '2px solid var(--pulse-accent)'
          : isOnline
            ? `1px solid ${color}40`
            : '1px solid var(--pulse-border)',
        opacity: isEliminated ? 0.55 : 1,
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
            height: portraitHeight,
            objectFit: 'cover',
            objectPosition: 'center 25%',
            display: 'block',
          }}
        />
        {/* Rank badge top-left */}
        {rank && !compact && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              minWidth: 22,
              height: 22,
              padding: '0 6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              background: rank === 1 ? 'linear-gradient(135deg, var(--pulse-gold), #e6a500)' : 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              fontSize: 11,
              fontWeight: 800,
              color: rank === 1 ? '#1a1422' : 'var(--pulse-text-1)',
            }}
          >
            #{rank}
          </div>
        )}
        {/* "YOU" badge top-right (overrides LIVE for self) */}
        {isSelf && !isEliminated && !compact && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '3px 8px',
              borderRadius: 10,
              background: 'var(--pulse-accent)',
              fontSize: 9,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            You
          </div>
        )}
        {/* Online indicator (only if not self — self gets YOU badge) */}
        {isOnline && !isEliminated && !isSelf && !compact && (
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
        {!compact && (
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
            <Coins size={13} weight="fill" />
            <span>{player.silver}</span>
          </div>
        )}
      </div>

      {/* Name + stereotype */}
      <div style={{ padding: compact ? '6px 8px' : '10px 12px 8px' }}>
        <div style={{ fontWeight: compact ? 700 : 800, fontSize: compact ? 11 : 15, color, fontFamily: 'var(--po-font-body)', letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {player.personaName}
        </div>
        {!compact && stereotype && (
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--pulse-text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stereotype}
          </div>
        )}
      </div>

      {/* Actions — hidden for self (no DM-yourself) and eliminated/compact */}
      {!isEliminated && !isSelf && !compact && (
        <div style={{ display: 'flex', borderTop: '1px solid var(--pulse-border)' }}>
          {[
            { Icon: ChatCircle, handler: onDM, label: 'DM' },
            { Icon: Coins, handler: onSilver, label: 'Silver' },
            { Icon: HandWaving, handler: onNudge, label: 'Nudge' },
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
              <Icon size={18} weight="fill" />
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
