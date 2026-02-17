import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useTimeline } from '../../hooks/useTimeline';
import { TimelineChatBubble } from './TimelineChatBubble';
import { TimelineSystemEvent } from './TimelineSystemEvent';
import { TimelineCartridgeCard } from './TimelineCartridgeCard';
import { TimelineInput } from './TimelineInput';
import type { ChatMessage } from '@pecking-order/shared-types';
import { ArrowDown } from 'lucide-react';

interface TimelineProps {
  engine: {
    sendMessage: (content: string, targetId?: string) => void;
    sendTyping: (channel?: string) => void;
    stopTyping: (channel?: string) => void;
    sendVoteAction: (type: string, targetId: string) => void;
    sendGameAction: (type: string, payload?: any) => void;
    sendPerk: (perkType: string, targetId?: string) => void;
  };
}

const SCROLL_THRESHOLD = 100;

export const Timeline: React.FC<TimelineProps> = ({ engine }) => {
  const { playerId, roster } = useGameStore();
  const entries = useTimeline();
  const chatLog = useGameStore(s => s.chatLog);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distanceFromBottom > SCROLL_THRESHOLD);
  }, []);

  // Auto-scroll to bottom when new entries arrive (unless user scrolled up)
  useEffect(() => {
    if (!userScrolledUp && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, optimisticMessages, userScrolledUp]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUserScrolledUp(false);
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !playerId) return;

    const optimisticMsg: ChatMessage = {
      id: `opt-${Date.now()}`,
      senderId: playerId,
      timestamp: Date.now(),
      content: inputValue,
      channelId: 'MAIN',
      channel: 'MAIN',
    };

    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    engine.sendMessage(inputValue);
    engine.stopTyping('MAIN');
    setInputValue('');

    setTimeout(() => {
      setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }, 5000);
  };

  // Build display list: real entries + optimistic messages
  // Filter out optimistic messages already confirmed by server
  const pendingOptimistic = optimisticMessages.filter(opt =>
    !chatLog.some(m =>
      m.senderId === opt.senderId &&
      m.content === opt.content &&
      Math.abs(m.timestamp - opt.timestamp) < 2000
    )
  );

  // Message grouping: consecutive chat messages from the same sender
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
      {/* Scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth"
        onScroll={handleScroll}
      >
        {entries.length === 0 && pendingOptimistic.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <div className="w-14 h-14 rounded-full bg-glass border border-white/10 flex items-center justify-center glow-breathe">
              <span className="font-mono text-xl text-skin-dim">(~)</span>
            </div>
            <span className="text-xs font-display tracking-wide text-skin-dim shimmer uppercase">
              Channel Empty
            </span>
          </div>
        )}

        {entries.map((entry, i) => {
          switch (entry.kind) {
            case 'chat':
              return (
                <TimelineChatBubble
                  key={entry.key}
                  message={entry.data}
                  isMe={entry.data.senderId === playerId}
                  sender={roster[entry.data.senderId]}
                  showSender={shouldShowSender(i)}
                />
              );
            case 'system':
              return <TimelineSystemEvent key={entry.key} message={entry.data} />;
            case 'voting':
            case 'game':
            case 'prompt':
              return <TimelineCartridgeCard key={entry.key} entry={entry} engine={engine} />;
          }
        })}

        {/* Optimistic messages */}
        {pendingOptimistic.map(msg => (
          <TimelineChatBubble
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

      {/* "Jump to latest" pill */}
      {userScrolledUp && (
        <div className="relative">
          <button
            onClick={scrollToBottom}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-skin-panel/95 border border-white/[0.1] text-xs font-mono text-skin-gold shadow-card backdrop-blur-md hover:border-skin-gold/30 transition-all animate-fade-in z-10"
          >
            <ArrowDown size={12} />
            Jump to latest
          </button>
        </div>
      )}

      {/* Pinned input */}
      <TimelineInput
        engine={engine}
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSend={handleSend}
      />
    </div>
  );
};
