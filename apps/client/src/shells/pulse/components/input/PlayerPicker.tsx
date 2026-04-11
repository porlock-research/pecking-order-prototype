import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface PlayerPickerProps {
  breadcrumb: string;
  onSelect: (player: SocialPlayer, playerId: string) => void;
  onBack: () => void;
}

export function PlayerPicker({ breadcrumb, onSelect, onBack }: PlayerPickerProps) {
  const roster = useGameStore(s => s.roster);
  const { playerId } = usePulse();

  const players = Object.entries(roster).filter(
    ([id, p]) => id !== playerId && p.status === 'ALIVE',
  );

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pulse-text-2)', display: 'flex' }}
        >
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--pulse-text-2)', fontFamily: 'var(--po-font-body)' }}>
          {breadcrumb}
        </span>
      </div>

      {/* 3-column portrait grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {players.map(([id, player], i) => (
          <motion.button
            key={id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...PULSE_SPRING.snappy, delay: i * 0.03 }}
            onClick={() => onSelect(player, id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: 6,
              borderRadius: 12,
              background: 'var(--pulse-surface-2)',
              border: '1px solid var(--pulse-border)',
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            <img
              src={player.avatarUrl}
              alt={player.personaName}
              style={{ width: '100%', height: 72, borderRadius: 8, objectFit: 'cover' }}
            />
            <span style={{
              fontSize: 10, fontWeight: 600, color: getPlayerColor(Object.keys(roster).indexOf(id)),
              fontFamily: 'var(--po-font-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
            }}>
              {player.personaName}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
