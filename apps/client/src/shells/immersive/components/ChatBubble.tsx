import React, { useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import type { ChatMessage, SocialPlayer } from '@pecking-order/shared-types';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';

interface ChatBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  sender: SocialPlayer | undefined;
  showSender: boolean;
  isOptimistic?: boolean;
  onLongPress?: (playerId: string, position: { x: number; y: number }) => void;
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
}: ChatBubbleProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressed, setPressed] = useState(false);
  const isGameMaster = message.senderId === GAME_MASTER_ID;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isGameMaster || isMe || !onLongPress) return;
    setPressed(true);
    timerRef.current = setTimeout(() => {
      onLongPress(message.senderId, { x: e.clientX, y: e.clientY });
      setPressed(false);
    }, LONG_PRESS_MS);
  }, [isGameMaster, isMe, onLongPress, message.senderId]);

  const handlePointerUp = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPressed(false);
  }, []);

  if (isGameMaster) {
    return (
      <motion.div
        className="w-full"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="border-l-2 border-skin-gold bg-skin-gold/10 px-5 py-3.5 rounded-r-xl">
          <div className="flex items-center gap-2 mb-1">
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
      className={`flex gap-2.5 max-w-[88%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'} ${isOptimistic ? 'opacity-60' : ''}`}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: isOptimistic ? 0.6 : 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Avatar */}
      {!isMe && showSender && (
        <div className="shrink-0 w-9 h-9 rounded-full bg-skin-panel flex items-center justify-center text-sm font-bold font-mono text-skin-gold avatar-ring mt-5">
          {sender?.personaName?.charAt(0)?.toUpperCase() || '?'}
        </div>
      )}
      {!isMe && !showSender && <div className="shrink-0 w-9" />}

      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && showSender && (
          <span className="text-[11px] font-bold text-skin-dim uppercase tracking-wider mb-1 ml-1">
            {sender?.personaName || 'Unknown'}
          </span>
        )}
        <motion.div
          className={`px-5 py-3 rounded-2xl text-base leading-relaxed break-words relative
            ${isMe
              ? 'bg-skin-pink text-white rounded-tr-sm'
              : 'bg-white/10 border border-white/[0.08] text-skin-base rounded-tl-sm'
            }
            ${pressed ? 'scale-[0.97]' : ''}
          `}
          style={{ transition: 'transform 100ms ease-out' }}
        >
          {message.content}
        </motion.div>
        <span className={`text-[9px] font-mono text-skin-dim/50 mt-0.5 ${isMe ? 'mr-1' : 'ml-1'}`}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </motion.div>
  );
}
