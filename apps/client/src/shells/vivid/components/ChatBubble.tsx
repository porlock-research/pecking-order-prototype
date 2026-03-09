import React, { useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage, SocialPlayer } from '@pecking-order/shared-types';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';
import { Crown } from '@solar-icons/react';
import { VIVID_SPRING } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

const REACTIONS = ['\u{1F480}', '\u{1F440}', '\u{1F525}', '\u{1F414}', '\u{1F451}', '\u{1F602}'] as const;

interface ChatBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  sender: SocialPlayer | undefined;
  showSender: boolean;
  showTimestamp?: boolean;
  isOptimistic?: boolean;
  isOnline?: boolean;
  onLongPress?: (playerId: string, position: { x: number; y: number }) => void;
  onTapReply?: (message: ChatMessage) => void;
  playerIndex?: number;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const LONG_PRESS_MS = 500;

export function ChatBubble({
  message,
  isMe,
  sender,
  showSender,
  showTimestamp = true,
  isOptimistic,
  isOnline,
  onLongPress,
  onTapReply,
  playerIndex = 0,
}: ChatBubbleProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressed, setPressed] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [localReactions, setLocalReactions] = useState<string[]>([]);
  const [floatingEmoji, setFloatingEmoji] = useState<{ emoji: string; id: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const isGameMaster = message.senderId === GAME_MASTER_ID;

  const isInteractive = !isMe && !isGameMaster;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isInteractive) return;
    setPressed(true);
    const startX = e.clientX;
    const startY = e.clientY;
    timerRef.current = setTimeout(() => {
      setPressed(false);
      setShowReactions(true);
      if (onLongPress) {
        onLongPress(message.senderId, { x: startX, y: startY });
      }
    }, LONG_PRESS_MS);
  }, [isInteractive, onLongPress, message.senderId]);

  const handlePointerUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      if (pressed && !showReactions && onTapReply) {
        onTapReply(message);
      }
    }
    setPressed(false);
  }, [pressed, showReactions, onTapReply, message]);

  const handlePointerCancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPressed(false);
  }, []);

  const handleReaction = useCallback((emoji: string) => {
    setLocalReactions(prev => prev.includes(emoji) ? prev.filter(r => r !== emoji) : [...prev, emoji]);
    setShowReactions(false);
    setFloatingEmoji({ emoji, id: Date.now() });
    setTimeout(() => setFloatingEmoji(null), 1000);
  }, []);

  // --- Game Master message ---
  if (isGameMaster) {
    return (
      <motion.div
        className="w-full"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={VIVID_SPRING.gentle}
      >
        <div
          className="px-5 py-3.5 rounded-r-xl"
          style={{
            borderLeft: '3px solid var(--vivid-gold)',
            background: 'rgba(255, 217, 61, 0.1)',
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Crown size={14} weight="BoldDuotone" style={{ color: 'var(--vivid-gold)' }} />
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--vivid-gold)', fontFamily: 'var(--vivid-font-display)' }}
            >
              Game Master
            </span>
            <span
              className="text-[9px] font-mono"
              style={{ color: 'var(--vivid-text-dim)' }}
            >
              {formatTime(message.timestamp)}
            </span>
          </div>
          <p className="text-base leading-relaxed" style={{ color: 'var(--vivid-text)' }}>
            {message.content}
          </p>
        </div>
      </motion.div>
    );
  }

  // --- Player message ---
  return (
    <motion.div
      ref={bubbleRef}
      className={`flex gap-2.5 max-w-[88%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'} relative`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isOptimistic ? 0.6 : 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
    >
      {/* Avatar */}
      {showSender && (
        <div className="mt-6 shrink-0">
          <PersonaAvatar avatarUrl={sender?.avatarUrl} personaName={sender?.personaName} size={28} isOnline={isOnline} />
        </div>
      )}
      {!showSender && <div className="shrink-0 w-7" />}

      <div className={`flex flex-col min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Sender name */}
        {!isMe && showSender && (
          <span
            className="text-sm font-bold mb-1 ml-1"
            style={{ fontFamily: 'var(--vivid-font-display)', color: 'var(--vivid-text)' }}
          >
            {sender?.personaName || 'Unknown'}
          </span>
        )}

        {/* Bubble */}
        <motion.div
          data-testid="chat-message"
          className={`px-4 py-2.5 text-base leading-relaxed break-words [overflow-wrap:anywhere] max-w-full relative ${isInteractive ? 'select-none [-webkit-touch-callout:none]' : ''}`}
          style={isMe
            ? {
                background: 'var(--vivid-coral)',
                color: '#FFFFFF',
                borderRadius: '18px 4px 18px 18px',
              }
            : {
                background: 'var(--vivid-bg-surface)',
                color: 'var(--vivid-text)',
                borderRadius: '4px 18px 18px 18px',
              }
          }
          animate={pressed ? { scale: 0.97 } : { scale: 1 }}
          transition={{ duration: 0.1 }}
          {...(isInteractive ? {
            onPointerDown: handlePointerDown,
            onPointerUp: handlePointerUp,
            onPointerCancel: handlePointerCancel,
            onPointerLeave: handlePointerCancel,
            onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
          } : {})}
        >
          {message.content}
        </motion.div>

        {/* Local reactions */}
        {localReactions.length > 0 && (
          <div className={`flex gap-0.5 mt-0.5 ${isMe ? 'mr-1' : 'ml-1'}`}>
            {localReactions.map((emoji, i) => (
              <span
                key={i}
                className="text-sm rounded-full px-1.5 py-0.5"
                style={{ background: 'rgba(255, 255, 255, 0.08)' }}
              >
                {emoji}
              </span>
            ))}
          </div>
        )}

        {/* Timestamp */}
        {showTimestamp && (
          <span
            className={`text-[9px] font-mono mt-0.5 ${isMe ? 'mr-1' : 'ml-1'}`}
            style={{ color: 'color-mix(in srgb, var(--vivid-text-dim) 50%, transparent)' }}
          >
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>

      {/* Floating emoji animation */}
      <AnimatePresence>
        {floatingEmoji && (
          <motion.span
            key={floatingEmoji.id}
            className="absolute text-2xl pointer-events-none"
            style={{ left: '50%', bottom: '100%' }}
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{ opacity: 0, y: -60, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {floatingEmoji.emoji}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Reaction bar */}
      <AnimatePresence>
        {showReactions && (
          <>
            <motion.div
              className="fixed inset-0 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReactions(false)}
            />
            <motion.div
              className={`absolute ${isMe ? 'right-0' : 'left-7'} bottom-full mb-2 flex gap-1 rounded-full px-2 py-1.5 z-50`}
              style={{
                background: 'color-mix(in srgb, var(--vivid-bg-elevated) 95%, transparent)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              }}
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 8 }}
              transition={VIVID_SPRING.snappy}
            >
              {REACTIONS.map((emoji, i) => (
                <motion.button
                  key={emoji}
                  className="w-9 h-9 flex items-center justify-center text-lg rounded-full transition-colors"
                  style={{ background: 'transparent' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03, ...VIVID_SPRING.bouncy }}
                  whileTap={{ scale: 1.3 }}
                >
                  {emoji}
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
