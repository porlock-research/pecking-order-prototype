import { memo, useRef, useState, type MouseEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Smiley, Reply, Lock } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';
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
  /** 0 for first in a sender-stack, 1+ for continuations. Drives bubble fade. */
  continuationDepth?: number;
  openReactionId: string | null;
  onOpenReaction: (id: string | null) => void;
}

const AVATAR_SIZE = 44;

function MessageCardInner({ message, showHeader, isSelf, continuationDepth = 0, openReactionId, onOpenReaction }: MessageCardProps) {
  const roster = useGameStore(s => s.roster);
  const { openDM } = usePulse();
  const reduce = useReducedMotion();
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

  // Only self + whisper render as bordered bubbles. Other players' plain
  // messages read as inline text anchored to the persona photo — this is
  // the rhythm choice that keeps the feed from looking like a wall of cards.
  const hasBubble = isSelf || isWhisper;

  // Tap-to-reveal action buttons on touch devices (no hover available).
  const [tapped, setTapped] = useState(false);

  const handleAvatarClick = () => {
    if (isSelf) return;
    openDM(message.senderId);
  };

  const handleReply = (e: MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('pulse:reply', { detail: { message } }));
  };

  // Tactile scale-pop only for a just-sent self message. Without the
  // timestamp gate, every prior self message re-animates on page reload
  // (a visible pop-in staircase).
  const isFreshSelfSend = isSelf && !reduce && Date.now() - message.timestamp < 3000;
  const ownSendMotion = isFreshSelfSend
    ? {
        initial: { opacity: 0, scale: 0.94, x: 6 },
        animate: { opacity: 1, scale: 1, x: 0 },
        transition: PULSE_SPRING.snappy,
      }
    : {};

  // Self-stack fade: first message full tint, continuations step down to
  // avoid "wall of pink." Floor at depth 2 so very long stacks don't
  // disappear into the background entirely.
  const depthFade = isSelf && continuationDepth > 0
    ? continuationDepth === 1
      ? { bg: 0.07, border: 0.14 }
      : { bg: 0.04, border: 0.10 }
    : { bg: 0.10, border: 0.20 };

  // Whisper-ness wins over self-ness for the bubble: both sender and
  // recipient see the purple whisper tint so the privacy signal reads
  // at a glance. A self-whisper in the normal coral self-bubble is the
  // regression that made senders unable to tell they were whispering.
  const bubbleStyle = isWhisper
    ? {
        background: 'color-mix(in oklch, var(--pulse-whisper) 10%, transparent)',
        border: '1px solid color-mix(in oklch, var(--pulse-whisper) 22%, transparent)',
      }
    : isSelf
      ? {
          background: `color-mix(in oklch, var(--pulse-accent) ${depthFade.bg * 100}%, transparent)`,
          border: `1px solid color-mix(in oklch, var(--pulse-accent) ${depthFade.border * 100}%, transparent)`,
        }
      : { background: 'transparent', border: 'none' };

  return (
    <motion.div
      {...ownSendMotion}
      style={{
        display: 'flex',
        flexDirection: isSelf ? 'row-reverse' : 'row',
        gap: 'var(--pulse-space-sm)',
        // New-sender headers breathe; continuations stay tight. Hierarchy through rhythm.
        padding: showHeader ? 'var(--pulse-space-md) 0 var(--pulse-space-2xs)' : 'var(--pulse-space-2xs) 0',
        position: 'relative',
        alignItems: 'flex-start',
      }}
    >
      {/* Avatar — only on header (new-sender) rows */}
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
                borderRadius: 12,
                objectFit: 'cover',
                objectPosition: 'center top',
              }}
            />
          </StatusRing>
        </button>
      ) : (
        <div style={{ width: AVATAR_SIZE, flexShrink: 0 }} />
      )}

      {/* Content column — bubble for self/whisper, inline text otherwise */}
      <div className="pulse-msg-group" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
        <div
          className={[
            'pulse-msg-content',
            tapped ? 'pulse-msg-tapped' : '',
            // One-shot glow only for just-sent messages (see isFreshSelfSend).
            isFreshSelfSend ? 'pulse-msg-selfsend' : '',
          ].filter(Boolean).join(' ')}
          onClick={() => setTapped(v => !v)}
          style={{
            maxWidth: '100%',
            minWidth: 0,
            position: 'relative',
            borderRadius: hasBubble ? 14 : 0,
            padding: hasBubble ? '8px 12px' : 0,
            ...bubbleStyle,
          }}
        >
          {/* Name plate + whisper eyebrow.
              - Non-self header rows: show sender name.
              - Sender (self) on a whisper: "🔒 WHISPER TO @Target" — sender
                needs the target spelled out.
              - Recipient on a whisper: "🔒 WHISPER" — no "to @Me"; the
                recipient knows who they are, and the purple bubble already
                signals privacy. Dropping @Me removes the redundancy.
              - Non-recipient observers never land here: they see the
                redacted WhisperCard via ChatView's earlier branch. */}
          {((showHeader && !isSelf) || isWhisper) && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
              {showHeader && !isSelf && (
                <span style={{ fontWeight: 700, fontSize: 14, color, letterSpacing: -0.1 }}>{player?.personaName}</span>
              )}
              {isWhisper && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--pulse-whisper)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <Lock size={11} weight="fill" style={{ marginBottom: -1 }} />
                  whisper
                  {isSelf && whisperTarget && (
                    <>
                      <span style={{ opacity: 0.85 }}>to</span>
                      {whisperTargetAvatar && (
                        <img
                          src={whisperTargetAvatar}
                          alt=""
                          style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      )}
                      <span style={{ color: getPlayerColor(whisperTargetIndex), textTransform: 'none', fontWeight: 700 }}>
                        {whisperTarget.personaName}
                      </span>
                    </>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Reply quote — flat vertical bar + quoted text, no nested card */}
          {replyMsg && (() => {
            const replyColor = getPlayerColor(Object.keys(roster).indexOf(replyMsg.senderId));
            return (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 8,
                  marginBottom: 4,
                  minWidth: 0,
                }}
              >
                <div style={{ width: 2, borderRadius: 1, background: replyColor, flexShrink: 0 }} />
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, paddingTop: 1 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: replyColor, letterSpacing: 0.2 }}>
                    {replyPlayer?.personaName}
                  </span>
                  <span style={{
                    fontSize: 12,
                    color: 'var(--pulse-text-3)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {replyMsg.content.slice(0, 60)}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Message text */}
          <div style={{ fontSize: 15, color: 'var(--pulse-text-1)', lineHeight: 1.45 }}>
            <MentionRenderer text={message.content} />
          </div>
        </div>

        {/* Inline trailing action row — appears below message on hover/tap.
            Positioned inline (not floating absolute) so it can never overlap
            the previous row. Aligned to the content-side edge. */}
        <div
          className="pulse-msg-actions"
          style={{
            display: isBarOpen ? 'none' : 'flex',
            gap: 2,
            marginTop: 4,
            padding: '2px',
            borderRadius: 10,
            background: 'var(--pulse-surface-2)',
            border: '1px solid var(--pulse-border)',
            // Tinted inner-glow instead of generic drop-shadow.
            boxShadow: '0 0 0 1px color-mix(in oklch, var(--pulse-accent) 6%, transparent), 0 6px 20px -8px color-mix(in oklch, var(--pulse-accent) 25%, transparent)',
          }}
        >
          <button
            onClick={handleReply}
            aria-label="Reply to message"
            style={{
              width: 32, height: 32, border: 'none', background: 'transparent',
              cursor: 'pointer', color: 'var(--pulse-text-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8,
            }}
          >
            <Reply size={14} weight="bold" />
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
              borderRadius: 8,
            }}
          >
            <Smiley size={14} weight="fill" />
          </button>
        </div>

        {/* Reaction bar (inline, below message, replaces action row when open) */}
        <AnimatePresence>
          {isBarOpen && (
            <ReactionBar
              messageId={message.id}
              message={message}
              isSelf={isSelf}
              onClose={() => onOpenReaction(null)}
            />
          )}
        </AnimatePresence>

        {/* Reaction chips — below bubble, aligned with content side */}
        <ReactionChips message={message} />
      </div>
    </motion.div>
  );
}

export const MessageCard = memo(MessageCardInner);
