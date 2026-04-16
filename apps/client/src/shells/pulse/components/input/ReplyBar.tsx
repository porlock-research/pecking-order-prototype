import { Reply, X } from '../../icons';
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
  const color = getPlayerColor(playerIndex);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: 'var(--pulse-surface-2)',
        fontSize: 12,
        fontFamily: 'var(--po-font-body)',
      }}
    >
      <Reply size={12} weight="bold" style={{ color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontWeight: 600, color, flexShrink: 0 }}>
          {player?.personaName}
        </span>
        <span style={{ color: 'var(--pulse-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {message.content.slice(0, 60)}
        </span>
      </div>
      <button
        onClick={onCancel}
        aria-label="Cancel reply"
        style={{
          width: 32,
          height: 32,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--pulse-text-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderRadius: 8,
        }}
      >
        <X size={14} weight="bold" />
      </button>
    </div>
  );
}
