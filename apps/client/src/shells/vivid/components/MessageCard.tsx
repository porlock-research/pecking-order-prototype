import React from 'react';
import { motion } from 'framer-motion';
import type { ChatMessage, SocialPlayer } from '@pecking-order/shared-types';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';
import { Crown } from '@solar-icons/react';
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
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={VIVID_SPRING.gentle}
        style={{
          width: '100%',
          borderLeft: '3px solid var(--vivid-gold)',
          background: 'rgba(255, 217, 61, 0.08)',
          borderRadius: 8,
          padding: '8px 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Crown size={14} weight="BoldDuotone" style={{ color: 'var(--vivid-gold)' }} />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--vivid-gold)',
              fontFamily: 'var(--vivid-font-display)',
            }}
          >
            Game Master
          </span>
          <span
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
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
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--vivid-text)',
          }}
        >
          {message.content}
        </p>
      </motion.div>
    );
  }

  /* -- Player card ------------------------------------------------- */

  const bgColor = isMe ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)';

  return (
    <motion.div
      data-testid="chat-message"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isOptimistic ? 0.5 : 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
      style={{
        width: '100%',
        borderLeft: `3px solid ${playerColor}`,
        background: bgColor,
        borderRadius: 8,
        padding: showSender ? '8px 12px' : '4px 12px 8px 12px',
      }}
    >
      {/* Sender row */}
      {showSender && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
            cursor: onTapAvatar ? 'pointer' : undefined,
          }}
          onClick={() => onTapAvatar?.(message.senderId)}
        >
          <PersonaAvatar
            avatarUrl={sender?.avatarUrl}
            personaName={sender?.personaName}
            size={32}
          />
          <span
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: playerColor,
              fontFamily: 'var(--vivid-font-display)',
            }}
          >
            {sender?.personaName || 'Unknown'}
          </span>
          {showTimestamp && (
            <span
              style={{
                fontSize: 10,
                fontFamily: 'monospace',
                color: 'var(--vivid-text-dim)',
                marginLeft: 'auto',
              }}
            >
              {formatTime(message.timestamp)}
            </span>
          )}
        </div>
      )}

      {/* Message body */}
      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.5,
          color: 'var(--vivid-text)',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
      </p>
    </motion.div>
  );
}
