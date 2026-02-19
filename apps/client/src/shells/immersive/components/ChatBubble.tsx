import React, { useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage, SocialPlayer } from '@pecking-order/shared-types';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';
import { Crown } from 'lucide-react';
import { SPRING, TAP } from '../springs';

// Player avatar color palette — deterministic by index
const AVATAR_COLORS = [
  'bg-pink-600', 'bg-violet-600', 'bg-blue-600', 'bg-teal-600',
  'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-indigo-600',
];

const REACTIONS = ['💀', '👀', '🔥', '🐔', '👑', '😂'] as const;

interface ChatBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  sender: SocialPlayer | undefined;
  showSender: boolean;
  isOptimistic?: boolean;
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
  isOptimistic,
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

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isGameMaster) return;
    setPressed(true);
    const startX = e.clientX;
    const startY = e.clientY;
    timerRef.current = setTimeout(() => {
      setPressed(false);
      if (!isMe && onLongPress) {
        // Show reactions + context menu for other players' messages
        setShowReactions(true);
        onLongPress(message.senderId, { x: startX, y: startY });
      } else {
        // For own messages, just show reactions
        setShowReactions(true);
      }
    }, LONG_PRESS_MS);
  }, [isGameMaster, isMe, onLongPress, message.senderId]);

  const handlePointerUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      // Short tap (not long press) → reply
      if (pressed && !showReactions && onTapReply && !isGameMaster) {
        onTapReply(message);
      }
    }
    setPressed(false);
  }, [pressed, showReactions, onTapReply, message, isGameMaster]);

  const handlePointerCancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPressed(false);
  }, []);

  const handleReaction = useCallback((emoji: string) => {
    setLocalReactions(prev => prev.includes(emoji) ? prev.filter(r => r !== emoji) : [...prev, emoji]);
    setShowReactions(false);
    // Floating emoji animation
    setFloatingEmoji({ emoji, id: Date.now() });
    setTimeout(() => setFloatingEmoji(null), 1000);
  }, []);

  const avatarColor = AVATAR_COLORS[playerIndex % AVATAR_COLORS.length];

  if (isGameMaster) {
    return (
      <motion.div
        className="w-full"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING.gentle}
      >
        <div className="border-l-[3px] border-skin-gold bg-skin-gold/15 px-5 py-3.5 rounded-r-xl">
          <div className="flex items-center gap-2 mb-1">
            <Crown size={12} className="text-skin-gold" />
            <span className="text-[11px] font-bold text-skin-gold uppercase tracking-wider font-display">
              Game Master
            </span>
            <span className="text-[9px] font-mono text-skin-dim/50">
              {formatTime(message.timestamp)}
            </span>
          </div>
          <p className="text-base text-skin-base leading-relaxed">{message.content}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={bubbleRef}
      className={`flex gap-2.5 max-w-[88%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'} ${isOptimistic ? 'opacity-60' : ''} relative`}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: isOptimistic ? 0.6 : 1, y: 0, scale: 1 }}
      transition={SPRING.gentle}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
    >
      {/* Avatar */}
      {!isMe && showSender && (
        <div className={`shrink-0 w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-sm font-bold text-white mt-5`}>
          {sender?.personaName?.charAt(0)?.toUpperCase() || '?'}
        </div>
      )}
      {!isMe && !showSender && <div className="shrink-0 w-8" />}

      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && showSender && (
          <span className="text-sm font-bold text-skin-gold mb-1 ml-1">
            {sender?.personaName || 'Unknown'}
          </span>
        )}
        <motion.div
          className={`px-4 py-2.5 text-base leading-relaxed break-words relative
            ${isMe
              ? 'bg-skin-pink text-white rounded-2xl rounded-br-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
              : 'bg-skin-glass-elevated border border-white/[0.1] text-skin-base rounded-2xl rounded-bl-sm'
            }
          `}
          animate={pressed ? { scale: 0.97 } : { scale: 1 }}
          transition={{ duration: 0.1 }}
        >
          {message.content}
        </motion.div>

        {/* Local reactions display */}
        {localReactions.length > 0 && (
          <div className={`flex gap-0.5 mt-0.5 ${isMe ? 'mr-1' : 'ml-1'}`}>
            {localReactions.map((emoji, i) => (
              <span key={i} className="text-sm bg-white/[0.08] rounded-full px-1.5 py-0.5">{emoji}</span>
            ))}
          </div>
        )}

        <span className={`text-[9px] font-mono text-skin-dim/50 mt-0.5 ${isMe ? 'mr-1' : 'ml-1'}`}>
          {formatTime(message.timestamp)}
        </span>
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
            {/* Backdrop to dismiss */}
            <motion.div
              className="fixed inset-0 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReactions(false)}
            />
            <motion.div
              className={`absolute ${isMe ? 'right-0' : 'left-10'} bottom-full mb-2 flex gap-1 bg-skin-panel/95 backdrop-blur-xl border border-white/[0.1] rounded-full px-2 py-1.5 shadow-card z-50`}
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 8 }}
              transition={SPRING.snappy}
            >
              {REACTIONS.map((emoji, i) => (
                <motion.button
                  key={emoji}
                  className="w-9 h-9 flex items-center justify-center text-lg hover:bg-white/[0.1] rounded-full transition-colors"
                  onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03, ...SPRING.bouncy }}
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
