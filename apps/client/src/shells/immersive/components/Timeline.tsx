import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { useTimeline } from '../../../hooks/useTimeline';
import { ChatBubble } from './ChatBubble';
import { SystemEvent } from './SystemEvent';
import { FloatingInput } from './FloatingInput';
import type { ChatMessage } from '@pecking-order/shared-types';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';
import { ArrowDown } from 'lucide-react';

interface TimelineProps {
  engine: any;
  onLongPressBubble?: (playerId: string, position: { x: number; y: number }) => void;
}

const SCROLL_THRESHOLD = 100;

export function Timeline({ engine, onLongPressBubble }: TimelineProps) {
  const { playerId, roster } = useGameStore();
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const entries = useTimeline();
  const chatLog = useGameStore(s => s.chatLog);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
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

  // Show timestamp on the last message of a group (next entry breaks the group)
  const shouldShowTimestamp = (index: number): boolean => {
    const entry = entries[index];
    if (entry.kind !== 'chat') return true;
    // Last entry always shows timestamp
    if (index === entries.length - 1) return true;
    const next = entries[index + 1];
    if (next.kind !== 'chat') return true;
    if (next.data.senderId !== entry.data.senderId) return true;
    if (next.data.timestamp - entry.data.timestamp > 120000) return true;
    return false;
  };

  const handleTapReply = useCallback((message: ChatMessage) => {
    setReplyTarget(message);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto overflow-x-hidden p-4 scroll-smooth pb-4"
        onScroll={handleScroll}
      >
        {entries.length === 0 && pendingOptimistic.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <div className="w-16 h-16 rounded-full bg-skin-glass-elevated border border-white/10 flex items-center justify-center">
              <span className="text-skin-dim/40 font-mono text-lg">...</span>
            </div>
            <span className="text-base font-display text-skin-dim italic">
              The room is quiet... for now.
            </span>
          </div>
        )}

        {entries.map((entry, i) => {
          const isGrouped = entry.kind === 'chat' && !shouldShowSender(i);
          const spacing = i === 0 ? '' : isGrouped ? 'mt-0.5' : 'mt-2';

          switch (entry.kind) {
            case 'chat':
              return (
                <div key={entry.key} className={spacing}>
                  <ChatBubble
                    message={entry.data}
                    isMe={entry.data.senderId === playerId}
                    sender={roster[entry.data.senderId]}
                    showSender={shouldShowSender(i)}
                    showTimestamp={shouldShowTimestamp(i)}
                    isOnline={onlinePlayers.includes(entry.data.senderId)}
                    onLongPress={onLongPressBubble}
                    onTapReply={handleTapReply}
                    playerIndex={playerIndexMap.get(entry.data.senderId) ?? 0}
                  />
                </div>
              );
            case 'system':
              return <div key={entry.key} className={spacing}><SystemEvent message={entry.data} /></div>;
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

      {/* Jump to latest */}
      {userScrolledUp && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full bg-skin-panel/95 border border-white/[0.1] text-xs font-mono text-skin-gold shadow-card backdrop-blur-md hover:border-skin-gold/30 transition-all animate-fade-in z-10"
        >
          <ArrowDown size={12} />
          Jump to latest
        </button>
      )}
      </div>

      <FloatingInput
        engine={engine}
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
      />
    </div>
  );
}
