import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { useTimeline } from '../../../hooks/useTimeline';
import { ChatBubble } from './ChatBubble';
import { SystemEvent } from './SystemEvent';
import { FloatingInput } from './FloatingInput';
import VotingPanel from '../../../components/panels/VotingPanel';
import GamePanel from '../../../components/panels/GamePanel';
import PromptPanel from '../../../components/panels/PromptPanel';
import type { ChatMessage } from '@pecking-order/shared-types';
import { ArrowDown } from 'lucide-react';

interface TimelineProps {
  engine: any;
  onLongPressBubble?: (playerId: string, position: { x: number; y: number }) => void;
}

const SCROLL_THRESHOLD = 100;

export function Timeline({ engine, onLongPressBubble }: TimelineProps) {
  const { playerId, roster } = useGameStore();
  const entries = useTimeline();
  const chatLog = useGameStore(s => s.chatLog);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distanceFromBottom > SCROLL_THRESHOLD);
  }, []);

  useEffect(() => {
    if (!userScrolledUp && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, optimisticMessages, userScrolledUp]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUserScrolledUp(false);
  }, []);

  // Optimistic send is handled via FloatingInput -> engine.sendMessage
  // We hook into chatLog changes to add optimistic messages
  const handleOptimisticSend = useCallback((content: string) => {
    if (!playerId) return;
    const optimisticMsg: ChatMessage = {
      id: `opt-${Date.now()}`,
      senderId: playerId,
      timestamp: Date.now(),
      content,
      channelId: 'MAIN',
      channel: 'MAIN',
    };
    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => {
      setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }, 5000);
  }, [playerId]);

  const pendingOptimistic = optimisticMessages.filter(opt =>
    !chatLog.some(m =>
      m.senderId === opt.senderId &&
      m.content === opt.content &&
      Math.abs(m.timestamp - opt.timestamp) < 2000
    )
  );

  const shouldShowSender = (index: number): boolean => {
    const entry = entries[index];
    if (entry.kind !== 'chat') return true;
    if (index === 0) return true;
    const prev = entries[index - 1];
    if (prev.kind !== 'chat') return true;
    return prev.data.senderId !== entry.data.senderId;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth pb-4"
        onScroll={handleScroll}
      >
        {entries.length === 0 && pendingOptimistic.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <div className="w-16 h-16 rounded-full bg-glass border border-white/10 flex items-center justify-center glow-breathe">
              <span className="font-mono text-2xl text-skin-dim">(~)</span>
            </div>
            <span className="text-sm font-display tracking-wide text-skin-dim shimmer uppercase">
              Channel Empty
            </span>
          </div>
        )}

        {entries.map((entry, i) => {
          switch (entry.kind) {
            case 'chat':
              return (
                <ChatBubble
                  key={entry.key}
                  message={entry.data}
                  isMe={entry.data.senderId === playerId}
                  sender={roster[entry.data.senderId]}
                  showSender={shouldShowSender(i)}
                  onLongPress={onLongPressBubble}
                />
              );
            case 'system':
              return <SystemEvent key={entry.key} message={entry.data} />;
            case 'voting':
              return (
                <motion.div
                  key={entry.key}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <VotingPanel engine={engine} />
                </motion.div>
              );
            case 'game':
              return (
                <motion.div
                  key={entry.key}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <GamePanel engine={engine} />
                </motion.div>
              );
            case 'prompt':
              return (
                <motion.div
                  key={entry.key}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <PromptPanel engine={engine} />
                </motion.div>
              );
            case 'completed-cartridge':
              // Reuse classic's CompletedCartridgeCard for now
              return null;
          }
        })}

        {pendingOptimistic.map(msg => (
          <ChatBubble
            key={msg.id}
            message={msg}
            isMe={true}
            sender={playerId ? roster[playerId] : undefined}
            showSender={false}
            isOptimistic
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {userScrolledUp && (
        <div className="relative">
          <button
            onClick={scrollToBottom}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-skin-panel/95 border border-white/[0.1] text-xs font-mono text-skin-gold shadow-card backdrop-blur-md hover:border-skin-gold/30 transition-all animate-fade-in z-10"
          >
            <ArrowDown size={12} />
            Jump to latest
          </button>
        </div>
      )}

      <FloatingInput engine={engine} />
    </div>
  );
}
