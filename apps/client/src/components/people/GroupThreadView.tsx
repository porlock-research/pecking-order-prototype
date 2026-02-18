import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { ChannelTypes } from '@pecking-order/shared-types';
import type { ChatMessage } from '@pecking-order/shared-types';
import { ArrowLeft } from 'lucide-react';

interface GroupThreadViewProps {
  channelId: string;
  onBack: () => void;
  engine: {
    sendToChannel: (channelId: string, content: string) => void;
    sendTyping: (channel?: string) => void;
    stopTyping: (channel?: string) => void;
  };
}

const REJECTION_LABELS: Record<string, string> = {
  DMS_CLOSED: 'DMs are currently closed',
  GROUP_CHAT_CLOSED: 'Group chat is currently closed',
  PARTNER_LIMIT: "You've reached your daily conversation limit",
  CHAR_LIMIT: 'Daily character limit reached',
  INSUFFICIENT_SILVER: 'Not enough silver (costs 1 silver)',
  GROUP_LIMIT: "You've reached your daily group DM limit (3)",
  INVALID_MEMBERS: 'Invalid group members',
};

export const GroupThreadView: React.FC<GroupThreadViewProps> = ({
  channelId,
  onBack,
  engine,
}) => {
  const { playerId, roster } = useGameStore();
  const chatLog = useGameStore(s => s.chatLog);
  const channels = useGameStore(s => s.channels);
  const dmRejection = useGameStore(s => s.dmRejection);
  const clearDmRejection = useGameStore(s => s.clearDmRejection);
  const dmStats = useGameStore(s => s.dmStats);
  const typingPlayers = useGameStore(s => s.typingPlayers);

  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const channel = channels[channelId];
  const memberNames = useMemo(() => {
    if (!channel || !playerId) return '';
    return channel.memberIds
      .filter(id => id !== playerId)
      .map(id => roster[id]?.personaName || 'Unknown')
      .join(', ');
  }, [channel, playerId, roster]);

  const initials = useMemo(() => {
    if (!channel || !playerId) return 'G';
    return channel.memberIds
      .filter(id => id !== playerId)
      .slice(0, 2)
      .map(id => roster[id]?.personaName?.charAt(0)?.toUpperCase() || '?')
      .join('');
  }, [channel, playerId, roster]);

  const messages = useMemo(() => {
    return chatLog
      .filter((m: ChatMessage) => m.channelId === channelId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [chatLog, channelId]);

  const charsRemaining = dmStats ? Math.max(0, dmStats.charsLimit - dmStats.charsUsed) : 0;
  const charsLimit = dmStats?.charsLimit ?? 1200;

  // Typing indicator for group members
  const typingNames = useMemo(() => {
    if (!channel || !playerId) return [];
    return channel.memberIds
      .filter(id => id !== playerId && typingPlayers[id] === channelId)
      .map(id => roster[id]?.personaName || 'Someone');
  }, [channel, playerId, typingPlayers, roster, channelId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Auto-clear rejection
  useEffect(() => {
    if (!dmRejection) return;
    const timer = setTimeout(clearDmRejection, 4000);
    return () => clearTimeout(timer);
  }, [dmRejection, clearDmRejection]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    engine.sendToChannel(channelId, inputValue);
    engine.stopTyping(channelId);
    setInputValue('');
  };

  if (!channel) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-sm text-skin-dim">Channel not found</p>
        <button onClick={onBack} className="mt-2 text-xs font-mono text-skin-gold">Go back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="text-skin-dim hover:text-skin-base transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-9 h-9 rounded-full bg-skin-panel flex items-center justify-center text-[10px] font-bold font-mono text-skin-pink avatar-ring shrink-0">
            {initials}
          </div>
          <span className="text-sm font-bold truncate text-skin-base">{memberNames}</span>
        </div>
        <span className="font-mono text-[10px] text-skin-dim shrink-0">{charsRemaining}/{charsLimit}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <div className="w-14 h-14 rounded-full bg-glass border border-white/10 flex items-center justify-center glow-breathe">
              <span className="font-mono text-xl text-skin-dim">(@)</span>
            </div>
            <span className="text-xs font-display tracking-wide text-skin-dim shimmer uppercase">
              No Messages Yet
            </span>
          </div>
        )}

        {messages.map(msg => {
          const isMe = msg.senderId === playerId;
          const senderName = !isMe ? (roster[msg.senderId]?.personaName || 'Unknown') : null;
          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'} slide-up-in`}
            >
              {senderName && (
                <span className="text-[10px] font-mono text-skin-pink mb-1 ml-1">{senderName}</span>
              )}
              <div
                className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words relative group
                  ${isMe
                    ? 'bg-skin-pink text-skin-base rounded-tr-sm shadow-glow'
                    : 'bg-glass border-l-2 border-skin-pink/40 border-r-0 border-t-0 border-b-0 text-skin-base rounded-tl-sm'
                  }`}
              >
                {msg.content}
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

      {/* Input */}
      <div className="shrink-0 p-3 bg-skin-panel/80 backdrop-blur-lg border-t border-white/[0.06]">
        {typingNames.length > 0 && (
          <div className="px-2 pb-1.5 text-[11px] font-mono text-skin-dim/70 animate-fade-in">
            {typingNames.length === 1 ? `${typingNames[0]} is typing...` : `${typingNames.join(', ')} are typing...`}
          </div>
        )}
        {dmRejection && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-skin-danger/10 border border-skin-danger/20 text-skin-danger text-xs font-mono animate-fade-in">
            {REJECTION_LABELS[dmRejection.reason] || dmRejection.reason}
          </div>
        )}
        <form className="flex gap-2 items-center max-w-3xl mx-auto" onSubmit={handleSend}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (e.target.value) engine.sendTyping(channelId);
            }}
            placeholder="Group message..."
            maxLength={280}
            className="flex-1 bg-skin-deep border border-white/[0.06] rounded-full px-5 py-3 text-sm text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-pink focus:border-transparent focus:shadow-[0_0_15px_var(--po-pink-dim)] placeholder:text-skin-dim transition-all"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-skin-pink text-skin-base rounded-full p-3 font-bold hover:brightness-110 active:translate-y-[2px] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-btn"
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
