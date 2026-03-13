import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  // Long press state
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  // Double tap state
  const lastTapTime = useRef(0);
  const [showReaction, setShowReaction] = useState(false);

  const handleTouchStart = useCallback(() => {
    setIsPressed(true);
    longPressTimer.current = setTimeout(() => {
      // Long press triggers avatar tap (opens player quick sheet)
      if (onTapAvatar && message.senderId !== GAME_MASTER_ID) {
        onTapAvatar(message.senderId);
      }
      setIsPressed(false);
    }, 500);
  }, [onTapAvatar, message.senderId]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsPressed(false);
  }, []);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      // Double tap detected
      setShowReaction(true);
      setTimeout(() => setShowReaction(false), 800);
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }
  }, []);

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
            {/* GM text badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(212, 150, 10, 0.18)',
                border: '1px solid rgba(212, 150, 10, 0.3)',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: '#D4960A',
                fontFamily: 'var(--vivid-font-display)',
                lineHeight: 1.3,
                flexShrink: 0,
              }}
            >
              GM
            </span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#D4960A',
                fontFamily: 'var(--vivid-font-display)',
              }}
            >
              Game Master
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 17,
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
        scale: isPressed ? 0.97 : 1,
        y: 0,
        x: 0,
      }}
      whileHover={{ scale: 1.01 }}
      transition={VIVID_SPRING.bouncy}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onClick={handleDoubleTap}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: isMe ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
        position: 'relative',
      }}
    >
      {/* Avatar */}
      {showSender && (
        <div
          style={{
            flexShrink: 0,
            cursor: onTapAvatar ? 'pointer' : undefined,
            alignSelf: 'flex-end',
          }}
          onClick={(e) => { e.stopPropagation(); onTapAvatar?.(message.senderId); }}
        >
          <PersonaAvatar
            avatarUrl={sender?.avatarUrl}
            personaName={sender?.personaName}
            size={44}
          />
        </div>
      )}

      {/* Bubble */}
      <div
        style={{
          maxWidth: '75%',
          marginLeft: !showSender && !isMe ? 52 : 0,
          marginRight: !showSender && isMe ? 52 : 0,
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
                fontSize: 14,
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
              fontSize: 17,
              lineHeight: 1.5,
              color: 'var(--vivid-text)',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            {message.content}
          </p>
        </div>

        {/* Double-tap reaction */}
        <AnimatePresence>
          {showReaction && (
            <motion.div
              initial={{ opacity: 0, scale: 0, y: 0 }}
              animate={{ opacity: 1, scale: 1, y: -8 }}
              exit={{ opacity: 0, scale: 0.5, y: -20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              style={{
                position: 'absolute',
                bottom: '100%',
                left: isMe ? 'auto' : '50%',
                right: isMe ? '50%' : 'auto',
                transform: 'translateX(-50%)',
                padding: '3px 8px',
                borderRadius: 8,
                background: 'var(--vivid-phase-accent)',
                color: '#FFFFFF',
                fontSize: 11,
                fontWeight: 800,
                fontFamily: 'var(--vivid-font-display)',
                letterSpacing: '0.04em',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              +1
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
