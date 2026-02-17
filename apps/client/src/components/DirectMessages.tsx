import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { ChatMessage, GAME_MASTER_ID, SocialPlayer } from '@pecking-order/shared-types';
import { Coins } from 'lucide-react';

function DmTypingIndicator({ typingPlayers, partnerId, playerId, roster }: {
  typingPlayers: Record<string, string>;
  partnerId: string;
  playerId: string | null;
  roster: Record<string, SocialPlayer>;
}) {
  // In DMs, the partner's typing channel should be MY playerId (they're typing to me)
  const isPartnerTyping = playerId && typingPlayers[partnerId] === playerId;
  if (!isPartnerTyping) return null;

  const name = roster[partnerId]?.personaName || 'Someone';
  return (
    <div className="px-2 pb-1.5 text-[11px] font-mono text-skin-dim/70 animate-fade-in">
      {name} is typing...
    </div>
  );
}

interface DirectMessagesProps {
  engine: {
    sendDM: (targetId: string, content: string) => void;
    sendSilver: (amount: number, targetId: string) => void;
    sendToChannel: (channelId: string, content: string) => void;
    createGroupDm: (memberIds: string[]) => void;
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
  TARGET_ELIMINATED: 'This player has been eliminated',
  SELF_DM: 'Cannot message yourself',
  GROUP_LIMIT: "You've reached your daily group DM limit (3)",
  INVALID_MEMBERS: 'Invalid group members',
};

const SILVER_REJECTION_LABELS: Record<string, string> = {
  SELF_SEND: 'Cannot send silver to yourself',
  INVALID_AMOUNT: 'Invalid amount',
  INSUFFICIENT_SILVER: 'Not enough silver',
  TARGET_ELIMINATED: 'This player has been eliminated',
  TARGET_NOT_FOUND: 'Player not found',
};

function resolvePartner(partnerId: string, roster: Record<string, any>): { name: string; initial: string; isGameMaster: boolean } {
  if (partnerId === GAME_MASTER_ID) {
    return { name: 'Game Master', initial: 'GM', isGameMaster: true };
  }
  const p = roster[partnerId];
  return { name: p?.personaName || 'Unknown', initial: p?.personaName?.charAt(0)?.toUpperCase() || '?', isGameMaster: false };
}

export const DirectMessages: React.FC<DirectMessagesProps> = ({ engine }) => {
  const { playerId, roster, dmRejection, clearDmRejection } = useGameStore();
  const chatLog = useGameStore(s => s.chatLog);
  const channels = useGameStore(s => s.channels);
  const dmStats = useGameStore(s => s.dmStats);
  const typingPlayers = useGameStore(s => s.typingPlayers);
  const silverTransferRejection = useGameStore(s => s.silverTransferRejection);
  const clearSilverTransferRejection = useGameStore(s => s.clearSilverTransferRejection);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [showNewDm, setShowNewDm] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [showSilverTransfer, setShowSilverTransfer] = useState(false);
  const [silverAmount, setSilverAmount] = useState('');
  const [silverSent, setSilverSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Derive DM threads from channels (with legacy fallback)
  const threads = useMemo(() => {
    if (!playerId) return [];

    // Channel-based derivation (DM + GROUP_DM)
    const dmChannels = Object.values(channels).filter(
      ch => (ch.type === 'DM' || ch.type === 'GROUP_DM') && ch.memberIds.includes(playerId)
    );

    if (dmChannels.length > 0) {
      return dmChannels.map(ch => {
        const isGroup = ch.type === 'GROUP_DM';
        const partnerId = isGroup
          ? ch.id
          : (ch.memberIds.find(id => id !== playerId) || ch.memberIds[0]);
        const messages = chatLog
          .filter((m: ChatMessage) => m.channelId === ch.id)
          .sort((a, b) => a.timestamp - b.timestamp);
        return {
          partnerId,
          channelId: ch.id,
          messages,
          lastTimestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : ch.createdAt,
          isGroup,
          memberIds: isGroup ? ch.memberIds : undefined,
        };
      })
      // Group threads show even if empty; 1-to-1 only if messages exist
      .filter(t => t.isGroup || t.messages.length > 0)
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
    }

    // Legacy fallback
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
        channelId: `dm:${[playerId, partnerId].sort().join(':')}`,
        messages: messages.sort((a, b) => a.timestamp - b.timestamp),
        lastTimestamp: messages[messages.length - 1].timestamp,
      }))
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [chatLog, channels, playerId]);

  // Server-authoritative DM stats (includes perk overrides)
  const charsRemaining = dmStats ? Math.max(0, dmStats.charsLimit - dmStats.charsUsed) : 0;
  const charsLimit = dmStats?.charsLimit ?? 1200;
  const partnersRemaining = dmStats ? Math.max(0, dmStats.partnersLimit - dmStats.partnersUsed) : 0;
  const partnersLimit = dmStats?.partnersLimit ?? 3;
  const groupsUsed = dmStats?.groupsUsed ?? 0;
  const groupsLimit = dmStats?.groupsLimit ?? 3;
  const groupsRemaining = Math.max(0, groupsLimit - groupsUsed);

  // Auto-clear rejection after 4 seconds
  useEffect(() => {
    if (!dmRejection) return;
    const timer = setTimeout(clearDmRejection, 4000);
    return () => clearTimeout(timer);
  }, [dmRejection, clearDmRejection]);

  // Scroll to bottom when active thread changes
  const activeThread = activeChannelId
    ? threads.find(t => t.channelId === activeChannelId)
    : threads.find(t => t.partnerId === activePartnerId);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeThread?.messages?.length]);

  // Auto-clear silver transfer rejection after 4 seconds
  useEffect(() => {
    if (!silverTransferRejection) return;
    const timer = setTimeout(clearSilverTransferRejection, 4000);
    return () => clearTimeout(timer);
  }, [silverTransferRejection, clearSilverTransferRejection]);

  // Clear silver sent confirmation after 2 seconds
  useEffect(() => {
    if (!silverSent) return;
    const timer = setTimeout(() => setSilverSent(false), 2000);
    return () => clearTimeout(timer);
  }, [silverSent]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activePartnerId) return;
    if (activeChannelId?.startsWith('gdm:')) {
      engine.sendToChannel(activeChannelId, inputValue);
      engine.stopTyping(activeChannelId);
    } else {
      engine.sendDM(activePartnerId, inputValue);
      engine.stopTyping(activePartnerId);
    }
    setInputValue('');
  };

  const handleSendSilver = () => {
    const amount = parseInt(silverAmount, 10);
    if (!amount || amount <= 0 || !activePartnerId) return;
    engine.sendSilver(amount, activePartnerId);
    setSilverAmount('');
    setShowSilverTransfer(false);
    setSilverSent(true);
  };

  const handleStartNewDm = (partnerId: string) => {
    setActivePartnerId(partnerId);
    setActiveChannelId(null);
    setShowNewDm(false);
  };

  const handleCreateGroup = () => {
    if (selectedGroupMembers.length < 2) return;
    engine.createGroupDm(selectedGroupMembers);
    setSelectedGroupMembers([]);
    setShowNewGroup(false);
  };

  const handleOpenThread = (thread: typeof threads[0]) => {
    setActivePartnerId(thread.partnerId);
    setActiveChannelId(thread.channelId);
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

  // Group creation picker
  if (showNewGroup) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40 flex items-center gap-3">
          <button
            onClick={() => { setShowNewGroup(false); setSelectedGroupMembers([]); }}
            className="text-skin-dim hover:text-skin-base font-mono text-lg transition-colors"
          >
            {'<-'}
          </button>
          <span className="text-sm font-bold text-skin-pink uppercase tracking-wider font-display">New Group</span>
          <span className="text-[10px] font-mono text-skin-dim ml-auto">{selectedGroupMembers.length} selected</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {availablePlayers.map(p => {
            const isSelected = selectedGroupMembers.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedGroupMembers(prev =>
                    isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id]
                  );
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl bg-glass border transition-all ${
                  isSelected ? 'border-skin-pink/50 bg-skin-pink/10' : 'border-white/[0.06] hover:border-skin-pink/30'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs shrink-0 ${
                  isSelected ? 'border-skin-pink bg-skin-pink text-skin-base' : 'border-white/20'
                }`}>
                  {isSelected && '\u2713'}
                </div>
                <div className="w-9 h-9 rounded-full bg-skin-panel flex items-center justify-center text-sm font-bold font-mono text-skin-pink avatar-ring">
                  {p.personaName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span className="font-bold text-sm text-skin-base">{p.personaName}</span>
              </button>
            );
          })}
          {availablePlayers.length === 0 && (
            <div className="text-center text-skin-dim text-sm py-8">No players available</div>
          )}
        </div>
        <div className="shrink-0 p-4 border-t border-white/[0.06] bg-skin-panel/40">
          {dmRejection && (
            <div className="mb-2 px-3 py-1.5 rounded-lg bg-skin-danger/10 border border-skin-danger/20 text-skin-danger text-xs font-mono animate-fade-in">
              {REJECTION_LABELS[dmRejection.reason] || dmRejection.reason}
            </div>
          )}
          <button
            onClick={handleCreateGroup}
            disabled={selectedGroupMembers.length < 2}
            className="w-full bg-skin-pink text-skin-base rounded-full py-3 font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-btn"
          >
            Create Group ({selectedGroupMembers.length} members)
          </button>
        </div>
      </div>
    );
  }

  // Shared footer for DM thread views (existing thread + new conversation)
  const mySilver = playerId ? (roster[playerId]?.silver ?? 0) : 0;
  const isGroupThread = activeChannelId?.startsWith('gdm:');
  const isPartnerGameMaster = activePartnerId === GAME_MASTER_ID;
  const canSendSilver = activePartnerId && !isPartnerGameMaster && !isGroupThread;

  const renderThreadFooter = () => (
    <div className="absolute bottom-0 left-0 right-0 p-3 bg-skin-panel/80 backdrop-blur-lg border-t border-white/[0.06]">
      <DmTypingIndicator typingPlayers={typingPlayers} partnerId={activePartnerId!} playerId={playerId} roster={roster} />
      {dmRejection && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-skin-danger/10 border border-skin-danger/20 text-skin-danger text-xs font-mono animate-fade-in">
          {REJECTION_LABELS[dmRejection.reason] || dmRejection.reason}
        </div>
      )}
      {silverTransferRejection && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-skin-danger/10 border border-skin-danger/20 text-skin-danger text-xs font-mono animate-fade-in">
          {SILVER_REJECTION_LABELS[silverTransferRejection.reason] || silverTransferRejection.reason}
        </div>
      )}
      {silverSent && (
        <div className="mb-2 px-3 py-1.5 rounded-lg bg-skin-gold/10 border border-skin-gold/20 text-skin-gold text-xs font-mono animate-fade-in">
          Silver sent!
        </div>
      )}
      {showSilverTransfer && canSendSilver && (
        <div className="mb-2 flex gap-2 items-center max-w-3xl mx-auto animate-fade-in">
          <span className="text-[10px] font-mono text-skin-dim shrink-0">Send silver</span>
          <input
            type="number"
            min="1"
            max={mySilver}
            value={silverAmount}
            onChange={(e) => setSilverAmount(e.target.value)}
            placeholder="Amt"
            className="w-20 bg-skin-deep border border-skin-gold/20 rounded-full px-3 py-1.5 text-xs font-mono text-skin-base focus:outline-none focus:ring-1 focus:ring-skin-gold placeholder:text-skin-dim"
          />
          <button
            onClick={handleSendSilver}
            disabled={!silverAmount || parseInt(silverAmount, 10) <= 0 || parseInt(silverAmount, 10) > mySilver}
            className="bg-skin-gold/20 text-skin-gold border border-skin-gold/30 rounded-full px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider hover:bg-skin-gold/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
          <button
            onClick={() => { setShowSilverTransfer(false); setSilverAmount(''); }}
            className="text-skin-dim hover:text-skin-base text-xs font-mono transition-colors"
          >
            cancel
          </button>
          <span className="text-[9px] font-mono text-skin-dim ml-auto">{mySilver} available</span>
        </div>
      )}
      <form className="flex gap-2 items-center max-w-3xl mx-auto" onSubmit={handleSend}>
        {canSendSilver && !showSilverTransfer && (
          <button
            type="button"
            onClick={() => setShowSilverTransfer(true)}
            title="Send silver"
            className="shrink-0 w-9 h-9 rounded-full bg-skin-gold/10 border border-skin-gold/20 flex items-center justify-center text-skin-gold hover:bg-skin-gold/20 transition-all"
          >
            <Coins className="w-4 h-4" />
          </button>
        )}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (e.target.value && activePartnerId) engine.sendTyping(isGroupThread ? activeChannelId! : activePartnerId);
          }}
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
  );

  // Thread view
  if (activePartnerId && activeThread) {
    const isGroup = activeThread.isGroup;
    const groupMemberNames = isGroup && activeThread.memberIds
      ? activeThread.memberIds
          .filter(id => id !== playerId)
          .map(id => roster[id]?.personaName || 'Unknown')
          .join(', ')
      : '';
    const partnerInfo = isGroup
      ? { name: groupMemberNames, initial: activeThread.memberIds?.filter(id => id !== playerId).slice(0, 2).map(id => roster[id]?.personaName?.charAt(0)?.toUpperCase() || '?').join('') || 'G', isGameMaster: false }
      : resolvePartner(activePartnerId, roster);
    return (
      <div className="flex flex-col h-full relative">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => { setActivePartnerId(null); setActiveChannelId(null); }}
              className="text-skin-dim hover:text-skin-base font-mono text-lg transition-colors shrink-0"
            >
              {'<-'}
            </button>
            {isGroup ? (
              <div className="w-7 h-7 rounded-full bg-skin-panel flex items-center justify-center text-[10px] font-bold font-mono text-skin-pink avatar-ring shrink-0">
                {partnerInfo.initial}
              </div>
            ) : (
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono avatar-ring shrink-0 ${partnerInfo.isGameMaster ? 'bg-skin-gold/20 text-skin-gold' : 'bg-skin-panel text-skin-pink'}`}>
                {partnerInfo.initial}
              </div>
            )}
            <span className={`text-sm font-bold truncate ${partnerInfo.isGameMaster ? 'text-skin-gold' : 'text-skin-base'}`}>{partnerInfo.name}</span>
          </div>
          <span className="font-mono text-[10px] text-skin-dim shrink-0">{charsRemaining}/{charsLimit}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth pb-20" ref={scrollRef}>
          {activeThread.messages.map(msg => {
            const isMe = msg.senderId === playerId;
            const senderName = isGroup && !isMe
              ? (roster[msg.senderId]?.personaName || 'Unknown')
              : null;
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

        {renderThreadFooter()}
      </div>
    );
  }

  // If activePartnerId is set but no thread yet (new conversation)
  if (activePartnerId) {
    const partnerInfo = resolvePartner(activePartnerId, roster);
    return (
      <div className="flex flex-col h-full relative">
        <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setActivePartnerId(null); setActiveChannelId(null); }}
              className="text-skin-dim hover:text-skin-base font-mono text-lg transition-colors"
            >
              {'<-'}
            </button>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono avatar-ring ${partnerInfo.isGameMaster ? 'bg-skin-gold/20 text-skin-gold' : 'bg-skin-panel text-skin-pink'}`}>
              {partnerInfo.initial}
            </div>
            <span className={`text-sm font-bold ${partnerInfo.isGameMaster ? 'text-skin-gold' : 'text-skin-base'}`}>{partnerInfo.name}</span>
          </div>
          <span className="font-mono text-[10px] text-skin-dim">{charsRemaining}/{charsLimit}</span>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <span className="font-mono text-2xl text-skin-dim opacity-40">(@)</span>
            <p className="text-xs text-skin-dim font-mono uppercase tracking-wider">Start a private conversation</p>
          </div>
        </div>

        {renderThreadFooter()}
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewGroup(true)}
            className="text-[10px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-3 py-1 text-skin-pink uppercase tracking-widest hover:bg-skin-pink/20 transition-colors"
          >
            + Group <span className="text-skin-dim">{groupsRemaining}/{groupsLimit}</span>
          </button>
          <button
            onClick={() => setShowNewDm(true)}
            className="text-[10px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-3 py-1 text-skin-pink uppercase tracking-widest hover:bg-skin-pink/20 transition-colors"
          >
            + New
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {dmRejection && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-skin-danger/10 border border-skin-danger/20 text-skin-danger text-xs font-mono animate-fade-in">
            {REJECTION_LABELS[dmRejection.reason] || dmRejection.reason}
          </div>
        )}

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
          if (thread.isGroup) {
            const memberNames = (thread.memberIds || [])
              .filter(id => id !== playerId)
              .map(id => roster[id]?.personaName || 'Unknown');
            const initials = memberNames.slice(0, 2).map(n => n.charAt(0).toUpperCase()).join('');
            const lastMsg = thread.messages[thread.messages.length - 1];
            const lastSenderName = lastMsg ? (roster[lastMsg.senderId]?.personaName || 'Unknown') : '';
            const isFromMe = lastMsg?.senderId === playerId;

            return (
              <button
                key={thread.channelId}
                onClick={() => handleOpenThread(thread)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-glass border border-white/[0.06] hover:border-skin-pink/30 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-skin-panel flex items-center justify-center text-[11px] font-bold font-mono text-skin-pink avatar-ring shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-sm truncate text-skin-base">
                      {memberNames.join(', ')}
                    </span>
                    <span className="text-[9px] font-mono text-skin-dim shrink-0 ml-2">
                      {lastMsg ? new Date(thread.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'New'}
                    </span>
                  </div>
                  <p className="text-xs text-skin-dim truncate">
                    {lastMsg ? `${isFromMe ? 'You' : lastSenderName}: ${lastMsg.content}` : 'No messages yet'}
                  </p>
                </div>
              </button>
            );
          }

          const partnerInfo = resolvePartner(thread.partnerId, roster);
          const lastMsg = thread.messages[thread.messages.length - 1];
          const isFromMe = lastMsg?.senderId === playerId;

          return (
            <button
              key={thread.partnerId}
              onClick={() => handleOpenThread(thread)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-glass border border-white/[0.06] hover:border-skin-pink/30 transition-all text-left"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold font-mono avatar-ring shrink-0 ${partnerInfo.isGameMaster ? 'bg-skin-gold/20 text-skin-gold' : 'bg-skin-panel text-skin-pink'}`}>
                {partnerInfo.initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`font-bold text-sm truncate ${partnerInfo.isGameMaster ? 'text-skin-gold' : 'text-skin-base'}`}>
                    {partnerInfo.name}
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
