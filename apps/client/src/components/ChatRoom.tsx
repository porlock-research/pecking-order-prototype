import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { ChatMessage } from '@pecking-order/shared-types';

interface ChatRoomProps {
  engine: {
    sendMessage: (content: string, targetId?: string) => void;
  };
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ engine }) => {
  const { chatLog, playerId, roster } = useGameStore();
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
            <div className="flex flex-col items-center justify-center h-full text-skin-muted opacity-50 space-y-2">
                <span className="text-4xl">📡</span>
                <span className="text-xs font-mono uppercase tracking-widest">Channel Empty</span>
            </div>
        )}
        
        {displayedMessages.map((msg) => {
          const sender = roster[msg.senderId];
          const isMe = msg.senderId === playerId;
          const isOptimistic = msg.id.toString().startsWith('opt-');

          return (
            <div 
                key={msg.id} 
                className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'} ${isOptimistic ? 'opacity-50' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              {/* Sender Name (Only for others) */}
              {!isMe && (
                <span className="text-[10px] font-bold text-skin-muted mb-1 ml-1 uppercase tracking-wider">
                  {sender?.personaName || 'Unknown'}
                </span>
              )}

              {/* Message Bubble */}
              <div 
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm break-words relative group
                  ${isMe 
                    ? 'bg-skin-primary text-skin-inverted rounded-tr-sm' 
                    : 'bg-skin-surface border border-skin-base text-skin-base rounded-tl-sm'
                  }`}
              >
                {msg.content}
                
                {/* Timestamp (Hover) */}
                <span className={`absolute -bottom-5 text-[9px] font-mono text-skin-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap
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
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-skin-surface/95 backdrop-blur-md border-t border-skin-base">
        <form className="flex gap-2 items-center max-w-3xl mx-auto" onSubmit={handleSend}>
          <input 
            type="text" 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Broadcast message..."
            maxLength={280}
            className="flex-1 bg-skin-fill border border-skin-base rounded-full px-5 py-3 text-sm text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-primary focus:border-transparent placeholder:text-skin-muted transition-all shadow-inner"
          />
          <button 
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-skin-primary text-skin-inverted rounded-full p-3 font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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