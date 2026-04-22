import { motion } from 'framer-motion';
import { X, Coins } from '../../icons';
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
  sending?: boolean;
}

export function CommandPreview({ player, playerId, amount, onSend, onCancel, sending = false }: CommandPreviewProps) {
  const roster = useGameStore(s => s.roster);
  const playerIndex = Object.keys(roster).indexOf(playerId);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
      <span style={{ fontSize: 13, fontFamily: 'var(--po-font-body)', color: 'var(--pulse-text-2)', display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <Coins size={16} weight="fill" style={{ color: 'var(--pulse-gold)' }} />
        <img src={player.avatarUrl} alt="" loading="lazy" width={22} height={22} style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover', objectPosition: 'center top' }} />
        <span style={{ fontWeight: 700, color: getPlayerColor(playerIndex) }}>{player.personaName}</span>
        <span style={{ color: 'var(--pulse-gold)', fontWeight: 800 }}>{amount} silver</span>
      </span>

      <motion.button
        whileTap={PULSE_TAP.button}
        onClick={onSend}
        disabled={sending}
        aria-busy={sending}
        style={{
          padding: '8px 16px', borderRadius: 10,
          background: 'linear-gradient(135deg, var(--pulse-gold), #e6c200)',
          color: 'var(--pulse-on-gold)', fontSize: 13, fontWeight: 700, border: 'none',
          cursor: sending ? 'wait' : 'pointer',
          fontFamily: 'var(--po-font-body)',
          opacity: sending ? 0.55 : 1,
          pointerEvents: sending ? 'none' : 'auto',
        }}
      >
        Send
      </motion.button>

      <button
        onClick={onCancel}
        aria-label="Cancel send"
        style={{
          width: 36, height: 36,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--pulse-text-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8,
        }}
      >
        <X size={18} weight="bold" />
      </button>
    </div>
  );
}
