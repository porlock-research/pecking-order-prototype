import { memo, useRef, useState, type MouseEvent } from 'react';
import { Smiley, Reply } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { getPlayerColor } from '../../colors';
import { StatusRing } from '../StatusRing';
import { ReactionBar } from './ReactionBar';
import { ReactionChips } from './ReactionChips';
import { MentionRenderer } from '../input/MentionRenderer';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import type { ChatMessage } from '@pecking-order/shared-types';

interface MessageCardProps {
  message: ChatMessage;
  showHeader: boolean;
  isSelf: boolean;
  openReactionId: string | null;
  onOpenReaction: (id: string | null) => void;
}

const AVATAR_SIZE = 56;

function MessageCardInner({ message, showHeader, isSelf, openReactionId, onOpenReaction }: MessageCardProps) {
  const roster = useGameStore(s => s.roster);
  const { openDM } = usePulse();
  const avatarRef = useRef<HTMLButtonElement>(null);
  const player = roster[message.senderId];
  const playerIndex = Object.keys(roster).indexOf(message.senderId);
  const color = getPlayerColor(playerIndex);
  const isBarOpen = openReactionId === message.id;

  // Reply context
  const chatLog = useGameStore(s => s.chatLog);
  const replyMsg = message.replyTo ? chatLog.find(m => m.id === message.replyTo) : null;
  const replyPlayer = replyMsg ? roster[replyMsg.senderId] : null;

  // Whisper indicator — resolve recipient player for label + avatar
  const isWhisper = !!message.whisperTarget;
  const whisperTarget = message.whisperTarget ? roster[message.whisperTarget] : null;
  const whisperTargetIndex = message.whisperTarget ? Object.keys(roster).indexOf(message.whisperTarget) : 0;
  const whisperTargetAvatar = whisperTarget ? resolveAvatarUrl(whisperTarget.avatarUrl) : null;

  // Tap-to-reveal action buttons on touch devices (no hover available).
  // The pulse-msg-tapped class hooks into the CSS rule at pulse-theme.css:115.
  const [tapped, setTapped] = useState(false);

  const handleAvatarClick = () => {
    if (isSelf) return;
    openDM(message.senderId);
  };

  const handleReply = (e: MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('pulse:reply', { detail: { message } }));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isSelf ? 'row-reverse' : 'row',
        gap: 'var(--pulse-space-sm)',
        // Rhythm: new-sender messages get a breath above; same-sender
        // continuations stay tight. Creates visual grouping without
        // changing message identity.
        padding: showHeader ? 'var(--pulse-space-sm) 0 var(--pulse-space-2xs)' : 'var(--pulse-space-2xs) 0',
        position: 'relative',
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar */}
      {showHeader ? (
        <button
          ref={avatarRef}
          onClick={handleAvatarClick}
          aria-label={isSelf ? undefined : `Open DM with ${player?.personaName ?? 'player'}`}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: isSelf ? 'default' : 'pointer',
            flexShrink: 0,
          }}
        >
          <StatusRing playerId={message.senderId} size={AVATAR_SIZE}>
            <img
              src={player?.avatarUrl}
              alt=""
              loading="lazy"
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: 14,
                objectFit: 'cover',
                objectPosition: 'center top',
              }}
            />
          </StatusRing>
        </button>
      ) : (
        <div style={{ width: AVATAR_SIZE, flexShrink: 0 }} />
      )}

      {/* Content column: bubble + chips outside */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
      <div
        className={tapped ? 'pulse-msg-content pulse-msg-tapped' : 'pulse-msg-content'}
        onClick={() => setTapped(v => !v)}
        style={{
          width: '100%',
          minWidth: 0,
          position: 'relative',
          // Every message gets its own bubble so grouped messages from the
          // same sender are still visually distinct.
          // - Self: coral-tinted bubble
          // - Whisper: purple-tinted bubble with left accent
          // - Other: subtle surface bubble with player-color left accent
          borderRadius: 16,
          padding: '10px 14px',
          ...(isSelf
            ? {
                background: 'linear-gradient(135deg, rgba(255,59,111,0.14) 0%, rgba(255,59,111,0.06) 100%)',
                border: '1px solid rgba(255,59,111,0.18)',
              }
            : isWhisper
              ? {
                  background: 'rgba(155, 89, 182, 0.12)',
                  border: '1px solid rgba(176, 105, 219, 0.22)',
                }
              : {
                  background: 'var(--pulse-surface)',
                  border: '1px solid var(--pulse-border)',
                }),
        }}
      >
        {/* Name plate */}
        {showHeader && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color, letterSpacing: -0.1 }}>{player?.personaName}</span>
            {isWhisper && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--pulse-whisper)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                whisper{whisperTarget ? ' to' : ''}
                {whisperTargetAvatar && (
                  <img
                    src={whisperTargetAvatar}
                    alt=""
                    style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover', marginLeft: 2 }}
                  />
                )}
                {whisperTarget && (
                  <span style={{ color: getPlayerColor(whisperTargetIndex), textTransform: 'none', fontWeight: 700 }}>
                    {whisperTarget.personaName}
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {/* Reply indicator */}
        {replyMsg && (() => {
          const replyColor = getPlayerColor(Object.keys(roster).indexOf(replyMsg.senderId));
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                marginBottom: 6,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--pulse-text-3)',
                minWidth: 0,
              }}
            >
              <Reply size={11} weight="bold" style={{ color: replyColor, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: replyColor, flexShrink: 0 }}>{replyPlayer?.personaName}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {replyMsg.content.slice(0, 60)}
              </span>
            </div>
          );
        })()}

        {/* Message text */}
        <div style={{ fontSize: 15, color: isSelf ? 'var(--pulse-text-1)' : 'var(--pulse-text-1)', lineHeight: 1.45 }}>
          <MentionRenderer text={message.content} />
        </div>

        {/* Inline action buttons (reply + emoji) — visible on hover/tap, hidden when picker open */}
        <div
          className="pulse-msg-actions"
          style={{
            position: 'absolute',
            top: -14,
            [isSelf ? 'left' : 'right']: 8,
            display: isBarOpen ? 'none' : 'flex',
            gap: 2,
            padding: '2px',
            borderRadius: 12,
            background: 'var(--pulse-surface-3)',
            border: '1px solid var(--pulse-border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          <button
            onClick={handleReply}
            aria-label="Reply to message"
            style={{
              width: 32, height: 32, border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--pulse-text-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 10,
            }}
          >
            <Reply size={16} weight="bold" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenReaction(message.id); }}
            aria-label="React to message"
            aria-expanded={isBarOpen}
            style={{
              width: 32, height: 32, border: 'none',
              background: isBarOpen ? 'var(--pulse-accent-glow)' : 'transparent',
              cursor: 'pointer', color: isBarOpen ? 'var(--pulse-accent)' : 'var(--pulse-text-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 10,
            }}
          >
            <Smiley size={16} weight="fill" />
          </button>
        </div>

        {/* Reaction bar (floating) */}
        {isBarOpen && (
          <ReactionBar
            messageId={message.id}
            message={message}
            isSelf={isSelf}
            onClose={() => onOpenReaction(null)}
          />
        )}
      </div>
        {/* Reaction chips — always OUTSIDE the bubble, aligned with content side */}
        <ReactionChips message={message} />
      </div>
    </div>
  );
}

export const MessageCard = memo(MessageCardInner);
