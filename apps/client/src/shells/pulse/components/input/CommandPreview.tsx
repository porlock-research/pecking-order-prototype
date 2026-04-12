import { motion } from 'framer-motion';
import { X } from '../../icons';
import { getPlayerColor } from '../../colors';
import { useGameStore } from '../../../../store/useGameStore';
import { PULSE_TAP } from '../../springs';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface CommandPreviewProps {
  player: SocialPlayer;
  playerId: string;
  amount: number;
  onSend: () => void;
  onCancel: () => void;
}

export function CommandPreview({ player, playerId, amount, onSend, onCancel }: CommandPreviewProps) {
  const roster = useGameStore(s => s.roster);
  const playerIndex = Object.keys(roster).indexOf(playerId);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
      <span style={{ fontSize: 13, fontFamily: 'var(--po-font-body)', color: 'var(--pulse-text-2)', display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <span>{'💰'}</span>
        <img src={player.avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: 6, objectFit: 'cover' }} />
        <span>{'→'}</span>
        <span style={{ fontWeight: 700, color: getPlayerColor(playerIndex) }}>{player.personaName}</span>
        <span>{'·'}</span>
        <span style={{ color: 'var(--pulse-gold)', fontWeight: 700 }}>{amount} silver</span>
      </span>

      <motion.button
        whileTap={PULSE_TAP.button}
        onClick={onSend}
        style={{
          padding: '8px 16px', borderRadius: 10,
          background: 'linear-gradient(135deg, var(--pulse-gold), #e6c200)',
          color: '#000', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
          fontFamily: 'var(--po-font-body)',
        }}
      >
        Send
      </motion.button>

      <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pulse-text-3)', display: 'flex' }}>
        <X size={18} weight="bold" />
      </button>
    </div>
  );
}
