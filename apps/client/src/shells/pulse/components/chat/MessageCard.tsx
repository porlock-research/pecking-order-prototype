import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { getPlayerColor } from '../../colors';
import { StatusRing } from '../StatusRing';
import { ReactionTrigger } from './ReactionTrigger';
import { ReactionBar } from './ReactionBar';
import { ReactionChips } from './ReactionChips';
import { MentionRenderer } from '../input/MentionRenderer';
import type { ChatMessage } from '@pecking-order/shared-types';

interface MessageCardProps {
  message: ChatMessage;
  showHeader: boolean;
  isSelf: boolean;
  openReactionId: string | null;
  onOpenReaction: (id: string | null) => void;
}

export function MessageCard({ message, showHeader, isSelf, openReactionId, onOpenReaction }: MessageCardProps) {
  const roster = useGameStore(s => s.roster);
  const player = roster[message.senderId];
  const playerIndex = Object.keys(roster).indexOf(message.senderId);
  const color = getPlayerColor(playerIndex);
  const isBarOpen = openReactionId === message.id;

  // Reply context
  const chatLog = useGameStore(s => s.chatLog);
  const replyMsg = message.replyTo ? chatLog.find(m => m.id === message.replyTo) : null;
  const replyPlayer = replyMsg ? roster[replyMsg.senderId] : null;

  // Whisper indicator
  const isWhisper = !!message.whisperTarget;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isSelf ? 'row-reverse' : 'row',
        gap: 8,
        padding: '2px 0',
        position: 'relative',
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar */}
      {showHeader ? (
        <StatusRing playerId={message.senderId} size={48}>
          <img
            src={player?.avatarUrl}
            alt={player?.personaName || ''}
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              objectFit: 'cover',
            }}
          />
        </StatusRing>
      ) : (
        <div style={{ width: 48, flexShrink: 0 }} />
      )}

      {/* Content */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          ...(isSelf
            ? {
                background: 'var(--pulse-surface-2)',
                borderRadius: 14,
                padding: '8px 12px',
              }
            : {}),
          ...(isWhisper
            ? {
                background: 'rgba(155, 89, 182, 0.08)',
                borderRadius: 14,
                padding: '8px 12px',
                borderLeft: '3px solid var(--pulse-whisper)',
              }
            : {}),
        }}
      >
        {/* Name plate */}
        {showHeader && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color }}>{player?.personaName}</span>
            {isWhisper && (
              <span style={{ fontSize: 10, color: 'var(--pulse-whisper)', fontWeight: 600 }}>whisper</span>
            )}
          </div>
        )}

        {/* Reply indicator */}
        {replyMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              marginBottom: 4,
              borderLeft: `2px solid ${getPlayerColor(Object.keys(roster).indexOf(replyMsg.senderId))}`,
              fontSize: 11,
              color: 'var(--pulse-text-3)',
            }}
          >
            <span style={{ fontWeight: 600 }}>{replyPlayer?.personaName}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyMsg.content.slice(0, 60)}
            </span>
          </div>
        )}

        {/* Message text */}
        <div style={{ fontSize: 14, color: 'var(--pulse-text-2)', lineHeight: 1.4 }}>
          <MentionRenderer text={message.content} />
        </div>

        {/* Reaction trigger */}
        <ReactionTrigger
          messageId={message.id}
          isOpen={isBarOpen}
          onOpen={() => onOpenReaction(message.id)}
        />

        {/* Reaction bar (floating) */}
        {isBarOpen && (
          <ReactionBar
            messageId={message.id}
            message={message}
            onClose={() => onOpenReaction(null)}
          />
        )}

        {/* Reaction chips */}
        <ReactionChips message={message} onOpenReaction={() => onOpenReaction(message.id)} />
      </div>
    </div>
  );
}
