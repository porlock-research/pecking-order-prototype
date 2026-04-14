import { X } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import type { ChatMessage } from '@pecking-order/shared-types';

interface ReplyBarProps {
  message: ChatMessage;
  onCancel: () => void;
}

export function ReplyBar({ message, onCancel }: ReplyBarProps) {
  const roster = useGameStore(s => s.roster);
  const player = roster[message.senderId];
  const playerIndex = Object.keys(roster).indexOf(message.senderId);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        borderLeft: `3px solid ${getPlayerColor(playerIndex)}`,
        background: 'var(--pulse-surface-2)',
        fontSize: 12,
        fontFamily: 'var(--po-font-body)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 600, color: getPlayerColor(playerIndex) }}>
          {player?.personaName}
        </span>
        <span style={{ color: 'var(--pulse-text-3)', marginLeft: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {message.content.slice(0, 60)}
        </span>
      </div>
      <button
        onClick={onCancel}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pulse-text-3)', display: 'flex', flexShrink: 0 }}
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
