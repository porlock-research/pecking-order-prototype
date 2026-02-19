import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { useTimeline } from '../../../hooks/useTimeline';
import { ChatBubble } from './ChatBubble';
import { SystemEvent } from './SystemEvent';
import { FloatingInput } from './FloatingInput';
import { CartridgeWrapper } from './CartridgeWrapper';
import VotingPanel from '../../../components/panels/VotingPanel';
import GamePanel from '../../../components/panels/GamePanel';
import PromptPanel from '../../../components/panels/PromptPanel';
import type { ChatMessage } from '@pecking-order/shared-types';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';
import { ArrowDown, Vote, Gamepad2, MessageSquare } from 'lucide-react';
import { SPRING, TAP } from '../springs';

interface TimelineProps {
  engine: any;
  onLongPressBubble?: (playerId: string, position: { x: number; y: number }) => void;
}

const SCROLL_THRESHOLD = 100;

export function Timeline({ engine, onLongPressBubble }: TimelineProps) {
  const { playerId, roster } = useGameStore();
  const activeVotingCartridge = useGameStore(s => s.activeVotingCartridge);
  const activeGameCartridge = useGameStore(s => s.activeGameCartridge);
  const activePromptCartridge = useGameStore(s => s.activePromptCartridge);
  const entries = useTimeline();
  const chatLog = useGameStore(s => s.chatLog);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cartridgeRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);

  // Build a player index map for deterministic avatar colors
  const playerIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    Object.keys(roster).forEach(pid => {
      if (pid !== GAME_MASTER_ID) {
        map.set(pid, idx++);
      }
    });
    return map;
  }, [roster]);

  const hasActiveCartridge = !!(activeVotingCartridge || activeGameCartridge || activePromptCartridge);

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

  const scrollToCartridge = useCallback(() => {
    cartridgeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

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
    if (prev.data.senderId !== entry.data.senderId) return true;
    // Group messages within 2 minutes
    if (entry.data.timestamp - prev.data.timestamp > 120000) return true;
    return false;
  };

  const handleTapReply = useCallback((message: ChatMessage) => {
    setReplyTarget(message);
  }, []);

  // Determine return-to-action pill label
  const returnPillLabel = activeVotingCartridge ? 'Return to Vote' : activeGameCartridge ? 'Return to Game' : activePromptCartridge ? 'Return to Activity' : null;
  const returnPillIcon = activeVotingCartridge ? Vote : activeGameCartridge ? Gamepad2 : MessageSquare;
  const returnPillColor = activeVotingCartridge ? 'bg-skin-gold/90 text-skin-inverted' : activeGameCartridge ? 'bg-skin-green/90 text-white' : 'bg-skin-pink/90 text-white';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth pb-4"
        onScroll={handleScroll}
      >
        {entries.length === 0 && pendingOptimistic.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <div className="w-16 h-16 rounded-full bg-skin-glass-elevated border border-white/10 flex items-center justify-center">
              <span className="text-3xl">🐔</span>
            </div>
            <span className="text-base font-display text-skin-dim italic">
              The room is quiet... for now.
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
                  onTapReply={handleTapReply}
                  playerIndex={playerIndexMap.get(entry.data.senderId) ?? 0}
                />
              );
            case 'system':
              return <SystemEvent key={entry.key} message={entry.data} />;
            case 'voting':
              return (
                <div key={entry.key} ref={cartridgeRef}>
                  <CartridgeWrapper kind="voting">
                    <VotingPanel engine={engine} />
                  </CartridgeWrapper>
                </div>
              );
            case 'game':
              return (
                <div key={entry.key} ref={cartridgeRef}>
                  <CartridgeWrapper kind="game">
                    <GamePanel engine={engine} />
                  </CartridgeWrapper>
                </div>
              );
            case 'prompt':
              return (
                <div key={entry.key} ref={cartridgeRef}>
                  <CartridgeWrapper kind="prompt">
                    <PromptPanel engine={engine} />
                  </CartridgeWrapper>
                </div>
              );
            case 'completed-cartridge':
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
            playerIndex={playerIndexMap.get(msg.senderId) ?? 0}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Return to action pill */}
      <AnimatePresence>
        {hasActiveCartridge && userScrolledUp && returnPillLabel && (
          <div className="relative">
            <motion.button
              onClick={scrollToCartridge}
              className={`absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-full ${returnPillColor} shadow-card font-bold text-xs uppercase tracking-wider z-10`}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={SPRING.bouncy}
              whileTap={TAP.button}
            >
              {React.createElement(returnPillIcon, { size: 14 })}
              {returnPillLabel}
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* Jump to latest (only when no active cartridge pill) */}
      {userScrolledUp && !hasActiveCartridge && (
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

      <FloatingInput
        engine={engine}
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
      />
    </div>
  );
}
