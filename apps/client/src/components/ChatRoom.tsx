import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { ChatMessage } from '@pecking-order/shared-types';

interface ChatRoomProps {
  engine: {
    sendMessage: (content: string, targetId?: string) => void;
  };
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ engine }) => {
  const { playerId, roster } = useGameStore();
  const rawChatLog = useGameStore(s => s.chatLog);
  const chatLog = useMemo(() => rawChatLog.filter(m => m.channel === 'MAIN'), [rawChatLog]);
  const [inputValue, setInputValue] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatLog, optimisticMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !playerId) return;

    // Create optimistic message
    const optimisticMsg: ChatMessage = {
      id: `opt-${Date.now()}`,
      senderId: playerId,
      timestamp: Date.now(),
      content: inputValue,
      channel: 'MAIN',
    };

    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    engine.sendMessage(inputValue);
    setInputValue('');

    // Remove optimistic message after 5 seconds if server doesn't confirm (simple cleanup)
    setTimeout(() => {
      setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }, 5000);
  };

  // Combine real and optimistic messages, filtering out duplicates if server confirms
  const displayedMessages = [...chatLog];
  optimisticMessages.forEach(opt => {
    const alreadyReceived = chatLog.some(m =>
      m.senderId === opt.senderId &&
      m.content === opt.content &&
      Math.abs(m.timestamp - opt.timestamp) < 2000
    );
    if (!alreadyReceived) {
      displayedMessages.push(opt);
    }
  });

  return (
    <div className="flex flex-col h-full relative">

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth pb-20" ref={scrollRef}>
        {displayedMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <div className="w-14 h-14 rounded-full bg-glass border border-white/10 flex items-center justify-center glow-breathe">
              <span className="font-mono text-xl text-skin-dim">(~)</span>
            </div>
            <span className="text-xs font-display tracking-wide text-skin-dim shimmer uppercase">
              Channel Empty
            </span>
          </div>
        )}

        {displayedMessages.map((msg) => {
          const sender = roster[msg.senderId];
          const isMe = msg.senderId === playerId;
          const isOptimistic = msg.id.toString().startsWith('opt-');

          return (
            <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'} ${isOptimistic ? 'shimmer' : ''} slide-up-in`}
            >
              {/* Sender Name (Only for others) */}
              {!isMe && (
                <span className="text-[11px] font-bold text-skin-dim mb-1 ml-1 uppercase tracking-wider">
                  {sender?.personaName || 'Unknown'}
                </span>
              )}

              {/* Message Bubble */}
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words relative group
                  ${isMe
                    ? 'bg-skin-gold text-skin-inverted rounded-tr-sm shadow-glow'
                    : 'bg-glass border border-white/[0.06] text-skin-base rounded-tl-sm'
                  }`}
              >
                {msg.content}

                {/* Timestamp (Hover) */}
                <span className={`absolute -bottom-5 text-[9px] font-mono text-skin-dim opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap
                    ${isMe ? 'right-0' : 'left-0'}
                `}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area (Fixed at bottom of this container) */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-skin-panel/80 backdrop-blur-lg border-t border-white/[0.06]">
        <form className="flex gap-2 items-center max-w-3xl mx-auto" onSubmit={handleSend}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Broadcast message..."
            maxLength={280}
            className="flex-1 bg-skin-deep border border-white/[0.06] rounded-full px-5 py-3 text-sm text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-gold focus:border-transparent focus:shadow-[0_0_15px_var(--po-gold-dim)] placeholder:text-skin-dim transition-all"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-skin-gold text-skin-inverted rounded-full p-3 font-bold hover:brightness-110 active:translate-y-[2px] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </form>
      </div>

    </div>
  );
};
