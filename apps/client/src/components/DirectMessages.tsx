import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { ChatMessage } from '@pecking-order/shared-types';

interface DirectMessagesProps {
  engine: {
    sendDM: (targetId: string, content: string) => void;
  };
}

const REJECTION_LABELS: Record<string, string> = {
  DMS_CLOSED: 'DMs are currently closed',
  PARTNER_LIMIT: "You've reached your daily conversation limit",
  CHAR_LIMIT: 'Daily character limit reached',
  INSUFFICIENT_SILVER: 'Not enough silver (costs 1 silver)',
  TARGET_ELIMINATED: 'This player has been eliminated',
  SELF_DM: 'Cannot message yourself',
};

export const DirectMessages: React.FC<DirectMessagesProps> = ({ engine }) => {
  const { playerId, roster, dmRejection, clearDmRejection } = useGameStore();
  const chatLog = useGameStore(s => s.chatLog);
  const dmStats = useGameStore(s => s.dmStats);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [showNewDm, setShowNewDm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Derive DM threads via useMemo (not a store selector) to avoid infinite loop
  const threads = useMemo(() => {
    if (!playerId) return [];
    const dmMessages = chatLog.filter((m: ChatMessage) => m.channel === 'DM');
    const threadMap = new Map<string, ChatMessage[]>();
    for (const msg of dmMessages) {
      const partnerId = msg.senderId === playerId ? msg.targetId! : msg.senderId;
      const existing = threadMap.get(partnerId) || [];
      existing.push(msg);
      threadMap.set(partnerId, existing);
    }
    return Array.from(threadMap.entries())
      .map(([partnerId, messages]) => ({
        partnerId,
        messages: messages.sort((a, b) => a.timestamp - b.timestamp),
        lastTimestamp: messages[messages.length - 1].timestamp,
      }))
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [chatLog, playerId]);

  // Server-authoritative DM stats (includes perk overrides)
  const charsRemaining = dmStats ? Math.max(0, dmStats.charsLimit - dmStats.charsUsed) : 0;
  const charsLimit = dmStats?.charsLimit ?? 1200;
  const partnersRemaining = dmStats ? Math.max(0, dmStats.partnersLimit - dmStats.partnersUsed) : 0;
  const partnersLimit = dmStats?.partnersLimit ?? 3;

  // Auto-clear rejection after 4 seconds
  useEffect(() => {
    if (!dmRejection) return;
    const timer = setTimeout(clearDmRejection, 4000);
    return () => clearTimeout(timer);
  }, [dmRejection, clearDmRejection]);

  // Scroll to bottom when active thread changes
  const activeThread = threads.find(t => t.partnerId === activePartnerId);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeThread?.messages?.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activePartnerId) return;
    engine.sendDM(activePartnerId, inputValue);
    setInputValue('');
  };

  const handleStartNewDm = (partnerId: string) => {
    setActivePartnerId(partnerId);
    setShowNewDm(false);
  };

  // Available players to DM (alive, not me)
  const availablePlayers = Object.values(roster).filter(
    p => p.id !== playerId && p.status === 'ALIVE'
  );

  // New DM picker
  if (showNewDm) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40 flex items-center gap-3">
          <button
            onClick={() => setShowNewDm(false)}
            className="text-skin-dim hover:text-skin-base font-mono text-lg transition-colors"
          >
            {'<-'}
          </button>
          <span className="text-sm font-bold text-skin-pink uppercase tracking-wider font-display">New Message</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {availablePlayers.map(p => (
            <button
              key={p.id}
              onClick={() => handleStartNewDm(p.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-glass border border-white/[0.06] hover:border-skin-pink/30 transition-all"
            >
              <div className="w-9 h-9 rounded-full bg-skin-panel flex items-center justify-center text-sm font-bold font-mono text-skin-pink avatar-ring">
                {p.personaName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span className="font-bold text-sm text-skin-base">{p.personaName}</span>
            </button>
          ))}
          {availablePlayers.length === 0 && (
            <div className="text-center text-skin-dim text-sm py-8">No players available</div>
          )}
        </div>
      </div>
    );
  }

  // Thread view
  if (activePartnerId && activeThread) {
    const partner = roster[activePartnerId];
    return (
      <div className="flex flex-col h-full relative">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActivePartnerId(null)}
              className="text-skin-dim hover:text-skin-base font-mono text-lg transition-colors"
            >
              {'<-'}
            </button>
            <div className="w-7 h-7 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-pink avatar-ring">
              {partner?.personaName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span className="text-sm font-bold text-skin-base">{partner?.personaName || 'Unknown'}</span>
          </div>
          <span className="font-mono text-[10px] text-skin-dim">{charsRemaining}/{charsLimit}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth pb-20" ref={scrollRef}>
          {activeThread.messages.map(msg => {
            const isMe = msg.senderId === playerId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'} slide-up-in`}
              >
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
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-skin-panel/80 backdrop-blur-lg border-t border-white/[0.06]">
          {dmRejection && (
            <div className="mb-2 px-3 py-1.5 rounded-lg bg-skin-danger/10 border border-skin-danger/20 text-skin-danger text-xs font-mono animate-fade-in">
              {REJECTION_LABELS[dmRejection.reason] || dmRejection.reason}
            </div>
          )}
          <form className="flex gap-2 items-center max-w-3xl mx-auto" onSubmit={handleSend}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Private message..."
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
  }

  // If activePartnerId is set but no thread yet (new conversation)
  if (activePartnerId) {
    const partner = roster[activePartnerId];
    return (
      <div className="flex flex-col h-full relative">
        <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActivePartnerId(null)}
              className="text-skin-dim hover:text-skin-base font-mono text-lg transition-colors"
            >
              {'<-'}
            </button>
            <div className="w-7 h-7 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-pink avatar-ring">
              {partner?.personaName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span className="text-sm font-bold text-skin-base">{partner?.personaName || 'Unknown'}</span>
          </div>
          <span className="font-mono text-[10px] text-skin-dim">{charsRemaining}/{charsLimit}</span>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <span className="font-mono text-2xl text-skin-dim opacity-40">(@)</span>
            <p className="text-xs text-skin-dim font-mono uppercase tracking-wider">Start a private conversation</p>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3 bg-skin-panel/80 backdrop-blur-lg border-t border-white/[0.06]">
          {dmRejection && (
            <div className="mb-2 px-3 py-1.5 rounded-lg bg-skin-danger/10 border border-skin-danger/20 text-skin-danger text-xs font-mono animate-fade-in">
              {REJECTION_LABELS[dmRejection.reason] || dmRejection.reason}
            </div>
          )}
          <form className="flex gap-2 items-center max-w-3xl mx-auto" onSubmit={handleSend}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Private message..."
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
  }

  // Thread list (default view)
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-skin-pink uppercase tracking-wider font-display">Direct Messages</span>
          {dmStats && (
            <span className="text-[10px] font-mono text-skin-dim">
              {dmStats.partnersUsed}/{partnersLimit} partners · {charsRemaining} chars left
            </span>
          )}
        </div>
        <button
          onClick={() => setShowNewDm(true)}
          className="text-[10px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-3 py-1 text-skin-pink uppercase tracking-widest hover:bg-skin-pink/20 transition-colors"
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {threads.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <div className="w-14 h-14 rounded-full bg-glass border border-white/10 flex items-center justify-center glow-breathe">
              <span className="font-mono text-xl text-skin-dim">(@)</span>
            </div>
            <span className="text-xs font-display tracking-wide text-skin-dim shimmer uppercase">
              No Conversations Yet
            </span>
            <p className="text-[10px] text-skin-dim/60 font-mono max-w-[200px] text-center">
              Start a private message with any active player. Costs 1 silver per message.
            </p>
          </div>
        )}

        {threads.map(thread => {
          const partner = roster[thread.partnerId];
          const lastMsg = thread.messages[thread.messages.length - 1];
          const isFromMe = lastMsg?.senderId === playerId;

          return (
            <button
              key={thread.partnerId}
              onClick={() => setActivePartnerId(thread.partnerId)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-glass border border-white/[0.06] hover:border-skin-pink/30 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-full bg-skin-panel flex items-center justify-center text-sm font-bold font-mono text-skin-pink avatar-ring shrink-0">
                {partner?.personaName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-sm text-skin-base truncate">
                    {partner?.personaName || 'Unknown'}
                  </span>
                  <span className="text-[9px] font-mono text-skin-dim shrink-0 ml-2">
                    {new Date(thread.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-skin-dim truncate">
                  {isFromMe ? 'You: ' : ''}{lastMsg?.content || ''}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
