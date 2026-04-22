import { X, Coins } from '../../icons';
import { getPlayerColor } from '../../colors';
import { useGameStore } from '../../../../store/useGameStore';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { SendButton } from './SendButton';

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
        <img src={player.avatarUrl} alt="" loading="lazy" width={22} height={22} style={{ width: 22, height: 22, borderRadius: 'var(--pulse-radius-xs)', objectFit: 'cover', objectPosition: 'center top' }} />
        <span style={{ fontWeight: 700, color: getPlayerColor(playerIndex) }}>{player.personaName}</span>
        <span style={{ color: 'var(--pulse-gold)', fontWeight: 800 }}>{amount} silver</span>
      </span>

      <SendButton
        variant="silver"
        shape="pill"
        onClick={onSend}
        pending={sending}
        ariaLabel="Send silver"
      >
        Send
      </SendButton>

      <button
        onClick={onCancel}
        aria-label="Cancel send"
        style={{
          width: 44, height: 44,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--pulse-text-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--pulse-radius-sm)',
        }}
      >
        <X size={18} weight="bold" />
      </button>
    </div>
  );
}
