import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { usePlayerTimeline } from '../../../hooks/usePlayerTimeline';
import { TimelineChatBubble } from './TimelineChatBubble';
import { TimelineSystemEvent } from './TimelineSystemEvent';
import { PlayerStatuses, GAME_MASTER_ID } from '@pecking-order/shared-types';
import { Coins, ArrowLeft, Trophy } from 'lucide-react';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface PlayerDetailViewProps {
  targetPlayerId: string;
  onBack: () => void;
  engine: {
    sendDM: (targetId: string, content: string) => void;
    sendSilver: (amount: number, targetId: string) => void;
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
};

const SILVER_REJECTION_LABELS: Record<string, string> = {
  SELF_SEND: 'Cannot send silver to yourself',
  INVALID_AMOUNT: 'Invalid amount',
  INSUFFICIENT_SILVER: 'Not enough silver',
  TARGET_ELIMINATED: 'This player has been eliminated',
  TARGET_NOT_FOUND: 'Player not found',
};

export const PlayerDetailView: React.FC<PlayerDetailViewProps> = ({
  targetPlayerId,
  onBack,
  engine,
}) => {
  const { playerId, roster } = useGameStore();
  const dmRejection = useGameStore(s => s.dmRejection);
  const clearDmRejection = useGameStore(s => s.clearDmRejection);
  const silverTransferRejection = useGameStore(s => s.silverTransferRejection);
  const clearSilverTransferRejection = useGameStore(s => s.clearSilverTransferRejection);
  const dmStats = useGameStore(s => s.dmStats);
  const typingPlayers = useGameStore(s => s.typingPlayers);
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const entries = usePlayerTimeline(targetPlayerId);

  const [inputValue, setInputValue] = useState('');
  const [showSilverTransfer, setShowSilverTransfer] = useState(false);
  const [silverAmount, setSilverAmount] = useState('');
  const [silverSent, setSilverSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const target = roster[targetPlayerId];
  const isOnline = onlinePlayers.includes(targetPlayerId);
  const isEliminated = target?.status === PlayerStatuses.ELIMINATED;
  const isGameMaster = targetPlayerId === GAME_MASTER_ID;
  const isMe = targetPlayerId === playerId;
  const canSendSilver = !isGameMaster && !isMe;

  const charsRemaining = dmStats ? Math.max(0, dmStats.charsLimit - dmStats.charsUsed) : 0;
  const charsLimit = dmStats?.charsLimit ?? 1200;
  const mySilver = playerId ? (roster[playerId]?.silver ?? 0) : 0;

  // Typing indicator
  const isPartnerTyping = playerId && typingPlayers[targetPlayerId] === playerId;

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  // Auto-clear rejections
  useEffect(() => {
    if (!dmRejection) return;
    const timer = setTimeout(clearDmRejection, 4000);
    return () => clearTimeout(timer);
  }, [dmRejection, clearDmRejection]);

  useEffect(() => {
    if (!silverTransferRejection) return;
    const timer = setTimeout(clearSilverTransferRejection, 4000);
    return () => clearTimeout(timer);
  }, [silverTransferRejection, clearSilverTransferRejection]);

  useEffect(() => {
    if (!silverSent) return;
    const timer = setTimeout(() => setSilverSent(false), 2000);
    return () => clearTimeout(timer);
  }, [silverSent]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !targetPlayerId) return;
    engine.sendDM(targetPlayerId, inputValue);
    engine.stopTyping(targetPlayerId);
    setInputValue('');
  };

  const handleSendSilver = () => {
    const amount = parseInt(silverAmount, 10);
    if (!amount || amount <= 0) return;
    engine.sendSilver(amount, targetPlayerId);
    setSilverAmount('');
    setShowSilverTransfer(false);
    setSilverSent(true);
  };

  // Message grouping
  const shouldShowSender = (index: number): boolean => {
    const entry = entries[index];
    if (entry.kind !== 'chat') return true;
    if (index === 0) return true;
    const prev = entries[index - 1];
    if (prev.kind !== 'chat') return true;
    return prev.data.senderId !== entry.data.senderId;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with profile info */}
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-skin-dim hover:text-skin-base transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Avatar */}
          <div className="relative shrink-0">
            {isGameMaster ? (
              <div className="w-12 h-12 rounded-full bg-skin-gold/20 flex items-center justify-center text-lg font-bold font-mono text-skin-gold avatar-ring">GM</div>
            ) : (
              <PersonaAvatar avatarUrl={target?.avatarUrl} personaName={target?.personaName} size={48} eliminated={isEliminated} />
            )}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-skin-fill ${isOnline ? 'bg-skin-green' : 'bg-skin-dim/40'}`} />
          </div>

          {/* Name + status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-bold text-sm truncate ${isGameMaster ? 'text-skin-gold' : ''}`}>
                {isGameMaster ? 'Game Master' : target?.personaName || 'Unknown'}
              </span>
              {isMe && <span className="badge-skew text-[9px]">YOU</span>}
              {isEliminated && <span className="text-[9px] font-mono text-skin-danger uppercase">eliminated</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-mono ${isOnline ? 'text-skin-green' : 'text-skin-dim'}`}>
                {isOnline ? 'online' : 'offline'}
              </span>
              {!isGameMaster && (
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  {(target?.gold ?? 0) > 0 && (
                    <div className="flex items-center gap-0.5 text-amber-400">
                      <Trophy size={10} />
                      {target?.gold}
                    </div>
                  )}
                  <div className="flex items-center gap-0.5 text-skin-gold">
                    <Coins size={10} className="text-skin-dim" />
                    {target?.silver ?? 0}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Char counter */}
          {!isMe && <span className="font-mono text-[10px] text-skin-dim shrink-0">{charsRemaining}/{charsLimit}</span>}
        </div>
      </div>

      {/* Interaction timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth" ref={scrollRef}>
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <div className="w-14 h-14 rounded-full bg-glass border border-white/10 flex items-center justify-center">
              <span className="text-skin-dim/40 font-mono text-lg">...</span>
            </div>
            <span className="text-xs font-display tracking-wide text-skin-dim uppercase">
              No interactions yet
            </span>
            <p className="text-[10px] text-skin-dim/60 font-mono max-w-[200px] text-center">
              {isMe ? 'This is your profile.' : 'Send a message to start a conversation.'}
            </p>
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
            default:
              return null;
          }
        })}
      </div>

      {/* Input area */}
      {!isMe && (
        <div className="shrink-0 p-3 bg-skin-panel/80 backdrop-blur-lg border-t border-white/[0.06]">
          {/* Typing indicator */}
          {isPartnerTyping && (
            <div className="px-2 pb-1.5 text-[11px] font-mono text-skin-dim/70 animate-fade-in">
              {target?.personaName || 'Someone'} is typing...
            </div>
          )}

          {/* Rejection banners */}
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

          {/* Silver transfer row */}
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

          {/* Message input */}
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
                if (e.target.value) engine.sendTyping(targetPlayerId);
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
      )}
    </div>
  );
};
