import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { ChatMessage, GAME_MASTER_ID, SocialPlayer } from '@pecking-order/shared-types';

function TypingIndicator({ typingPlayers, channel, playerId, roster }: {
  typingPlayers: Record<string, string>;
  channel: string;
  playerId: string | null;
  roster: Record<string, SocialPlayer>;
}) {
  const typers = Object.entries(typingPlayers)
    .filter(([pid, ch]) => ch === channel && pid !== playerId)
    .map(([pid]) => roster[pid]?.personaName || 'Someone');

  if (typers.length === 0) return null;

  const text = typers.length === 1
    ? `${typers[0]} is typing...`
    : `${typers.join(', ')} are typing...`;

  return (
    <div className="px-2 pb-1.5 text-[11px] font-mono text-skin-dim/70 animate-fade-in">
      {text}
    </div>
  );
}

interface ChatRoomProps {
  engine: {
    sendMessage: (content: string, targetId?: string) => void;
    sendTyping: (channel?: string) => void;
    stopTyping: (channel?: string) => void;
  };
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ engine }) => {
  const { playerId, roster } = useGameStore();
  const rawChatLog = useGameStore(s => s.chatLog);
  const typingPlayers = useGameStore(s => s.typingPlayers);
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
    engine.stopTyping('MAIN');
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

      {/* Sub-header */}
      <div className="shrink-0 px-4 py-2.5 border-b border-white/[0.06] bg-skin-panel/30">
        <span className="text-xs font-black text-skin-base uppercase tracking-widest font-display">Green Room</span>
      </div>

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
          const isGameMaster = msg.senderId === GAME_MASTER_ID;
          const isOptimistic = msg.id.toString().startsWith('opt-');

          // Game Master messages — full-width banner style
          if (isGameMaster) {
            return (
              <div key={msg.id} className="w-full slide-up-in">
                <div className="border-l-2 border-skin-gold bg-skin-gold/10 px-4 py-3 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-skin-gold uppercase tracking-wider font-display">
                      Game Master
                    </span>
                    <span className="text-[9px] font-mono text-skin-dim/50">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-skin-base leading-relaxed">{msg.content}</p>
                </div>
              </div>
            );
          }

          return (
            <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'} ${isOptimistic ? 'shimmer' : ''} slide-up-in`}
            >
              {/* Sender Name + Time (Only for others) */}
              {!isMe && (
                <div className="flex items-center gap-2 mb-1 ml-1">
                  <span className="text-[11px] font-bold text-skin-dim uppercase tracking-wider">
                    {sender?.personaName || 'Unknown'}
                  </span>
                  <span className="text-[9px] font-mono text-skin-dim/50">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words relative group
                  ${isMe
                    ? 'bg-skin-pink text-white rounded-tr-sm'
                    : 'bg-white/10 border border-white/[0.08] text-skin-base rounded-tl-sm'
                  }`}
              >
                {msg.content}

                {/* Timestamp (Hover — own messages) */}
                {isMe && (
                  <span className="absolute -bottom-5 right-0 text-[9px] font-mono text-skin-dim opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area (Fixed at bottom of this container) */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-skin-panel/80 backdrop-blur-lg border-t border-white/[0.06]">
        <TypingIndicator typingPlayers={typingPlayers} channel="MAIN" playerId={playerId} roster={roster} />
        <form className="flex gap-2 items-center max-w-3xl mx-auto" onSubmit={handleSend}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (e.target.value) engine.sendTyping('MAIN');
            }}
            placeholder="Spill the tea..."
            maxLength={280}
            className="flex-1 bg-skin-deep border border-white/[0.06] rounded-full px-5 py-3 text-sm text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-pink focus:border-transparent focus:shadow-[0_0_15px_var(--po-pink-dim)] placeholder:text-skin-dim transition-all"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-skin-pink text-white rounded-full px-4 py-3 font-display font-bold text-xs uppercase tracking-wider hover:brightness-110 active:translate-y-[1px] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            SHOUT &gt;
          </button>
        </form>
      </div>

    </div>
  );
};
