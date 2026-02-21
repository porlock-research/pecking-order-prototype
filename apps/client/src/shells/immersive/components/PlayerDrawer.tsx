import React, { useState, useRef, useEffect } from 'react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { useGameStore } from '../../../store/useGameStore';
import { usePlayerTimeline } from '../../../hooks/usePlayerTimeline';
import { ChatBubble } from './ChatBubble';
import { SystemEvent } from './SystemEvent';
import { PlayerStatuses, GAME_MASTER_ID } from '@pecking-order/shared-types';
import { Coins, Trophy, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { SPRING, TAP } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface PlayerDrawerProps {
  targetPlayerId: string | null;
  onClose: () => void;
  engine: {
    sendDM: (targetId: string, content: string) => void;
    sendSilver: (amount: number, targetId: string) => void;
    sendTyping: (channel?: string) => void;
    stopTyping: (channel?: string) => void;
  };
}

const REJECTION_LABELS: Record<string, string> = {
  DMS_CLOSED: 'DMs are currently closed',
  PARTNER_LIMIT: "You've reached your daily conversation limit",
  CHAR_LIMIT: 'Daily character limit reached',
  INSUFFICIENT_SILVER: 'Not enough silver',
  TARGET_ELIMINATED: 'This player has been eliminated',
  SELF_DM: 'Cannot message yourself',
};

export function PlayerDrawer({ targetPlayerId, onClose, engine }: PlayerDrawerProps) {
  const { playerId, roster } = useGameStore();
  const dmRejection = useGameStore(s => s.dmRejection);
  const clearDmRejection = useGameStore(s => s.clearDmRejection);
  const dmStats = useGameStore(s => s.dmStats);
  const dmsOpen = useGameStore(s => s.dmsOpen);
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const entries = usePlayerTimeline(targetPlayerId || '');

  const [inputValue, setInputValue] = useState('');
  const [showSilverTransfer, setShowSilverTransfer] = useState(false);
  const [silverAmount, setSilverAmount] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const target = targetPlayerId ? roster[targetPlayerId] : null;
  const isOnline = targetPlayerId ? onlinePlayers.includes(targetPlayerId) : false;
  const isEliminated = target?.status === PlayerStatuses.ELIMINATED;
  const isGameMaster = targetPlayerId === GAME_MASTER_ID;
  const isMe = targetPlayerId === playerId;
  const canSendSilver = !isGameMaster && !isMe;

  const charsRemaining = dmStats ? Math.max(0, dmStats.charsLimit - dmStats.charsUsed) : 0;
  const charsLimit = dmStats?.charsLimit ?? 1200;
  const mySilver = playerId ? (roster[playerId]?.silver ?? 0) : 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  // Show DM rejections as toasts instead of inline banners
  useEffect(() => {
    if (!dmRejection) return;
    toast.error(REJECTION_LABELS[dmRejection.reason] || dmRejection.reason);
    clearDmRejection();
  }, [dmRejection, clearDmRejection]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !targetPlayerId) return;
    engine.sendDM(targetPlayerId, inputValue);
    engine.stopTyping(targetPlayerId);
    setInputValue('');
  };

  const handleSendSilver = () => {
    const amount = parseInt(silverAmount, 10);
    if (!amount || amount <= 0 || !targetPlayerId) return;
    engine.sendSilver(amount, targetPlayerId);
    setSilverAmount('');
    setShowSilverTransfer(false);
  };

  const shouldShowSender = (index: number): boolean => {
    const entry = entries[index];
    if (entry.kind !== 'chat') return true;
    if (index === 0) return true;
    const prev = entries[index - 1];
    if (prev.kind !== 'chat') return true;
    return prev.data.senderId !== entry.data.senderId;
  };

  return (
    <Drawer.Root
      open={!!targetPlayerId}
      onOpenChange={(open) => { if (!open) onClose(); }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-skin-fill/95 backdrop-blur-xl border-t border-white/[0.06] h-[65vh] max-h-[85vh]" aria-describedby={undefined}>
          <Drawer.Title className="sr-only">{isGameMaster ? 'Game Master' : (target?.personaName ?? 'Player')}</Drawer.Title>
          {/* Drag handle */}
          <div className="flex justify-center py-3">
            <div className="w-12 h-1 rounded-full bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.1)]" />
          </div>

          {/* Player header */}
          {(target || isGameMaster) && (
            <div className="shrink-0 px-5 pb-3 border-b border-white/[0.06] flex items-center gap-3">
              <div className="shrink-0">
                {isGameMaster ? (
                  <div className="w-[72px] h-[72px] rounded-full bg-skin-gold/20 flex items-center justify-center text-2xl font-bold font-mono text-skin-gold">GM</div>
                ) : (
                  <PersonaAvatar avatarUrl={target!.avatarUrl} personaName={target!.personaName} size={72} eliminated={isEliminated} isOnline={isOnline} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-base truncate ${isGameMaster ? 'text-skin-gold' : ''}`}>
                    {isGameMaster ? 'Game Master' : target!.personaName}
                  </span>
                  {isMe && <span className="badge-skew text-[9px]">YOU</span>}
                  {isEliminated && <span className="text-[9px] font-mono text-skin-danger uppercase">eliminated</span>}
                </div>
                {isGameMaster ? (
                  <span className="text-[10px] font-mono text-skin-gold/60 mt-0.5">System</span>
                ) : (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-mono ${isOnline ? 'text-skin-green' : 'text-skin-dim'}`}>
                      {isOnline ? 'online' : 'offline'}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      {(target!.gold ?? 0) > 0 && (
                        <div className="flex items-center gap-0.5 text-amber-400">
                          <Trophy size={10} />{target!.gold}
                        </div>
                      )}
                      <div className="flex items-center gap-0.5 text-skin-gold">
                        <Coins size={10} className="text-skin-dim" />{target!.silver ?? 0}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {!isMe && !isGameMaster && <span className="font-mono text-[10px] text-skin-dim shrink-0">{charsRemaining}/{charsLimit}</span>}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth" ref={scrollRef}>
            {entries.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-14 h-14 rounded-full bg-skin-glass-elevated border border-white/10 flex items-center justify-center">
                  <span className="text-skin-dim/40 font-mono text-lg">...</span>
                </div>
                <span className="text-base font-display text-skin-dim italic">
                  {isMe ? 'Your profile' : isGameMaster ? 'No messages from the Game Master yet.' : 'No whispers exchanged yet. Start scheming?'}
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
                    />
                  );
                case 'system':
                  return <SystemEvent key={entry.key} message={entry.data} />;
                default:
                  return null;
              }
            })}
          </div>

          {/* Input — hidden for Game Master (one-way messages) */}
          {!isMe && !isGameMaster && targetPlayerId && (
            <div className="shrink-0 p-3 bg-skin-panel/80 backdrop-blur-lg border-t border-white/[0.06]">
              {!dmsOpen && (
                <div className="mb-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-skin-dim text-xs font-mono text-center">
                  DMs are currently closed
                </div>
              )}
              {showSilverTransfer && canSendSilver && (
                <div className="mb-2 flex gap-2 items-center animate-fade-in">
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
                  <button onClick={handleSendSilver} disabled={!silverAmount || parseInt(silverAmount, 10) <= 0} className="bg-skin-gold/20 text-skin-gold border border-skin-gold/30 rounded-full px-3 py-1.5 text-[10px] font-bold font-mono uppercase disabled:opacity-40">
                    Send
                  </button>
                  <button onClick={() => { setShowSilverTransfer(false); setSilverAmount(''); }} className="text-skin-dim text-xs font-mono">
                    cancel
                  </button>
                </div>
              )}

              <form className="flex gap-2 items-center" onSubmit={handleSend}>
                {canSendSilver && !showSilverTransfer && (
                  <motion.button
                    type="button"
                    onClick={() => setShowSilverTransfer(true)}
                    className="shrink-0 w-11 h-11 rounded-full bg-skin-gold/10 border border-skin-gold/20 flex items-center justify-center text-skin-gold"
                    whileTap={TAP.button}
                    transition={SPRING.button}
                  >
                    <Coins className="w-4 h-4" />
                  </motion.button>
                )}
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    if (e.target.value && targetPlayerId) engine.sendTyping(targetPlayerId);
                  }}
                  placeholder={dmsOpen ? "Private message..." : "DMs closed..."}
                  maxLength={280}
                  disabled={!dmsOpen}
                  className="flex-1 bg-skin-deep border border-white/[0.06] rounded-full px-5 py-3 text-base text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-pink placeholder:text-skin-dim transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <motion.button
                  type="submit"
                  disabled={!inputValue.trim() || !dmsOpen}
                  className="shrink-0 w-12 h-12 rounded-full bg-skin-pink text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-btn"
                  whileTap={TAP.fab}
                  transition={SPRING.button}
                >
                  <Send size={18} />
                </motion.button>
              </form>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
