import React from 'react';
import { motion } from 'framer-motion';
import type { ChatMessage, SocialPlayer } from '@pecking-order/shared-types';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { VIVID_SPRING } from '../springs';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MessageCardProps {
  message: ChatMessage;
  isMe: boolean;
  sender?: SocialPlayer;
  showSender: boolean;
  showTimestamp?: boolean;
  isOptimistic?: boolean;
  playerColor: string;
  onTapAvatar?: (playerId: string) => void;
  onTapReply?: (message: ChatMessage) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MessageCard({
  message,
  isMe,
  sender,
  showSender,
  showTimestamp = true,
  isOptimistic,
  playerColor,
  onTapAvatar,
  onTapReply,
}: MessageCardProps) {
  const isGameMaster = message.senderId === GAME_MASTER_ID;

  /* -- Game Master card -------------------------------------------- */
  if (isGameMaster) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={VIVID_SPRING.bouncy}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '88%',
            background: 'var(--vivid-bubble-gm)',
            borderRadius: 20,
            padding: '10px 16px',
            boxShadow: '0 2px 8px rgba(180, 140, 60, 0.1)',
            border: '2px solid rgba(212, 150, 10, 0.2)',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(212, 150, 10, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>👑</span>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#D4960A',
                fontFamily: 'var(--vivid-font-display)',
              }}
            >
              Game Master
            </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--vivid-font-mono)',
                color: 'var(--vivid-text-dim)',
                marginLeft: 'auto',
              }}
            >
              {formatTime(message.timestamp)}
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.55,
              color: 'var(--vivid-text)',
              fontFamily: 'var(--vivid-font-body)',
            }}
          >
            {message.content}
          </p>
        </div>
      </motion.div>
    );
  }

  /* -- Player bubble ------------------------------------------------ */

  return (
    <motion.div
      data-testid="chat-message"
      initial={
        showSender
          ? { opacity: 0, scale: 0.85, y: 12 }
          : { opacity: 0, x: isMe ? 8 : -8 }
      }
      animate={{
        opacity: isOptimistic ? 0.5 : 1,
        scale: 1,
        y: 0,
        x: 0,
      }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={VIVID_SPRING.bouncy}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: isMe ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
      {/* Avatar (outside the bubble) */}
      {showSender && (
        <div
          style={{
            flexShrink: 0,
            cursor: onTapAvatar ? 'pointer' : undefined,
            alignSelf: 'flex-end',
          }}
          onClick={() => onTapAvatar?.(message.senderId)}
        >
          <PersonaAvatar
            avatarUrl={sender?.avatarUrl}
            personaName={sender?.personaName}
            size={34}
          />
        </div>
      )}

      {/* Bubble */}
      <div
        style={{
          maxWidth: '75%',
          marginLeft: !showSender && !isMe ? 42 : 0,
          marginRight: !showSender && isMe ? 42 : 0,
          position: 'relative',
        }}
      >
        {/* Sender name */}
        {showSender && !isMe && (
          <div
            style={{
              marginBottom: 3,
              marginLeft: 12,
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 12,
                color: playerColor,
                fontFamily: 'var(--vivid-font-display)',
              }}
            >
              {sender?.personaName || 'Unknown'}
            </span>
          </div>
        )}

        {/* Message bubble */}
        <div
          style={{
            background: isMe ? 'var(--vivid-bubble-self)' : 'var(--vivid-bubble-other)',
            borderRadius: isMe
              ? showSender ? '20px 20px 6px 20px' : '20px 6px 6px 20px'
              : showSender ? '20px 20px 20px 6px' : '6px 20px 20px 6px',
            padding: '10px 14px',
            boxShadow: isMe
              ? '0 1px 4px rgba(107, 158, 110, 0.12)'
              : '0 1px 4px rgba(139, 115, 85, 0.08)',
            border: isMe
              ? '1px solid rgba(107, 158, 110, 0.15)'
              : '1px solid rgba(139, 115, 85, 0.08)',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.5,
              color: 'var(--vivid-text)',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {message.content}
          </p>

          {/* Timestamp */}
          {showTimestamp && (
            <div
              style={{
                display: 'flex',
                justifyContent: isMe ? 'flex-end' : 'flex-start',
                marginTop: 4,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontFamily: 'var(--vivid-font-mono)',
                  color: 'var(--vivid-text-dim)',
                  opacity: 0.7,
                }}
              >
                {formatTime(message.timestamp)}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
