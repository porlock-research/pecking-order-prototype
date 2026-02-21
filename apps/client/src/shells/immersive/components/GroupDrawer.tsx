import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { useGameStore } from '../../../store/useGameStore';
import { ChatBubble } from './ChatBubble';
import { ChannelTypes } from '@pecking-order/shared-types';
import type { ChatMessage } from '@pecking-order/shared-types';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SPRING, TAP } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface GroupDrawerProps {
  channelId: string | null;
  onClose: () => void;
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
  INSUFFICIENT_SILVER: 'Not enough silver',
  GROUP_LIMIT: "You've reached your daily group DM limit",
  INVALID_MEMBERS: 'Invalid group members',
};

function TypingDot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="w-1.5 h-1.5 rounded-full bg-skin-dim"
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

export function GroupDrawer({ channelId, onClose, engine }: GroupDrawerProps) {
  const { playerId, roster } = useGameStore();
  const chatLog = useGameStore(s => s.chatLog);
  const channels = useGameStore(s => s.channels);
  const dmRejection = useGameStore(s => s.dmRejection);
  const clearDmRejection = useGameStore(s => s.clearDmRejection);
  const dmStats = useGameStore(s => s.dmStats);
  const dmsOpen = useGameStore(s => s.dmsOpen);
  const typingPlayers = useGameStore(s => s.typingPlayers);

  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const channel = channelId ? channels[channelId] : null;

  const otherMemberIds = useMemo(() => {
    if (!channel || !playerId) return [];
    return channel.memberIds.filter(id => id !== playerId);
  }, [channel, playerId]);

  const memberNames = useMemo(() => {
    return otherMemberIds.map(id => roster[id]?.personaName || 'Unknown').join(', ');
  }, [otherMemberIds, roster]);

  const messages = useMemo(() => {
    if (!channelId) return [];
    return chatLog
      .filter((m: ChatMessage) => m.channelId === channelId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [chatLog, channelId]);

  const charsRemaining = dmStats ? Math.max(0, dmStats.charsLimit - dmStats.charsUsed) : 0;
  const charsLimit = dmStats?.charsLimit ?? 1200;

  const typingNames = useMemo(() => {
    if (!channel || !playerId) return [];
    return channel.memberIds
      .filter(id => id !== playerId && typingPlayers[id] === channelId)
      .map(id => roster[id]?.personaName || 'Someone');
  }, [channel, playerId, typingPlayers, roster, channelId]);

  const firstTyper = useMemo(() => {
    if (!channel || !playerId) return null;
    const id = channel.memberIds.find(id => id !== playerId && typingPlayers[id] === channelId);
    return id ? roster[id] : null;
  }, [channel, playerId, typingPlayers, roster, channelId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (!dmRejection) return;
    toast.error(REJECTION_LABELS[dmRejection.reason] || dmRejection.reason);
    clearDmRejection();
  }, [dmRejection, clearDmRejection]);

  // Reset input when drawer opens with a different channel
  useEffect(() => {
    setInputValue('');
  }, [channelId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !channelId) return;
    engine.sendToChannel(channelId, inputValue);
    engine.stopTyping(channelId);
    setInputValue('');
  };

  const shouldShowSender = (index: number): boolean => {
    if (index === 0) return true;
    return messages[index - 1].senderId !== messages[index].senderId;
  };

  return (
    <Drawer.Root
      open={!!channelId}
      onOpenChange={(open) => { if (!open) onClose(); }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl bg-skin-fill/95 backdrop-blur-xl border-t border-white/[0.06] h-[65vh] max-h-[85vh]" aria-describedby={undefined}>
          <Drawer.Title className="sr-only">{memberNames || 'Group'}</Drawer.Title>
          {/* Drag handle */}
          <div className="flex justify-center py-3">
            <div className="w-12 h-1 rounded-full bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.1)]" />
          </div>

          {/* Group header */}
          {channel && (
            <div className="shrink-0 px-5 pb-3 border-b border-white/[0.06] flex items-center gap-3">
              <div className="relative shrink-0" style={{ width: 52, height: 52 }}>
                {otherMemberIds.slice(0, 2).map((id, idx) => {
                  const p = roster[id];
                  return (
                    <div key={id} className="absolute" style={{ top: idx * 12, left: idx * 12, zIndex: 2 - idx }}>
                      <PersonaAvatar avatarUrl={p?.avatarUrl} personaName={p?.personaName} size={36} className="ring-2 ring-skin-deep" />
                    </div>
                  );
                })}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-base truncate block">{memberNames}</span>
                <span className="text-[10px] font-mono text-skin-dim">
                  {channel.memberIds.length} members
                </span>
              </div>
              <span className="font-mono text-[10px] text-skin-dim shrink-0">{charsRemaining}/{charsLimit}</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-14 h-14 rounded-full bg-skin-glass-elevated border border-white/10 flex items-center justify-center">
                  <span className="text-skin-dim/40 font-mono text-lg">...</span>
                </div>
                <span className="text-base font-display text-skin-dim italic">
                  No messages yet. Start scheming?
                </span>
              </div>
            )}

            {messages.map((msg, i) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                isMe={msg.senderId === playerId}
                sender={roster[msg.senderId]}
                showSender={shouldShowSender(i)}
              />
            ))}
          </div>

          {/* Input */}
          <div className="shrink-0 p-3 bg-skin-panel/80 backdrop-blur-lg border-t border-white/[0.06]">
            {!dmsOpen && (
              <div className="mb-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-skin-dim text-xs font-mono text-center">
                DMs are currently closed
              </div>
            )}
            <AnimatePresence>
              {typingNames.length > 0 && (
                <motion.div
                  className="flex items-center gap-2 px-2 pb-1.5"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <PersonaAvatar avatarUrl={firstTyper?.avatarUrl} personaName={firstTyper?.personaName} size={24} />
                  <span className="text-[11px] font-mono text-skin-dim/70">
                    {typingNames.length === 1 ? typingNames[0] : `${typingNames.join(', ')}`} is scheming
                  </span>
                  <div className="flex gap-0.5 items-center">
                    <TypingDot delay={0} />
                    <TypingDot delay={0.15} />
                    <TypingDot delay={0.3} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form className="flex gap-2 items-center" onSubmit={handleSend}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (e.target.value && channelId) engine.sendTyping(channelId);
                }}
                placeholder={dmsOpen ? "Group message..." : "DMs closed..."}
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
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
