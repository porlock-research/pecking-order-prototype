import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import type { SocialPlayer, ChatMessage } from '@pecking-order/shared-types';
import { Send, X } from 'lucide-react';
import { SPRING, TAP } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface FloatingInputProps {
  engine: {
    sendMessage: (content: string, targetId?: string) => void;
    sendTyping: (channel?: string) => void;
    stopTyping: (channel?: string) => void;
  };
  replyTarget?: ChatMessage | null;
  onClearReply?: () => void;
}

function TypingDot({ delay }: { delay: number }) {
  return (
    <motion.span
      className="w-1.5 h-1.5 rounded-full bg-skin-dim"
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

function TypingIndicator({ typingPlayers, playerId, roster }: {
  typingPlayers: Record<string, string>;
  playerId: string | null;
  roster: Record<string, SocialPlayer>;
}) {
  const typerIds = Object.entries(typingPlayers)
    .filter(([pid, ch]) => ch === 'MAIN' && pid !== playerId)
    .map(([pid]) => pid);
  const typers = typerIds.map(pid => roster[pid]?.personaName || 'Someone');

  if (typers.length === 0) return null;

  const firstTyper = roster[typerIds[0]];
  const verb = 'is scheming';
  const text = typers.length === 1
    ? typers[0]
    : typers.length === 2
      ? `${typers[0]} and ${typers[1]}`
      : `${typers[0]} and ${typers.length - 1} others`;

  return (
    <motion.div
      className="flex items-center gap-2 px-2 pb-1.5"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <PersonaAvatar avatarUrl={firstTyper?.avatarUrl} personaName={firstTyper?.personaName} size={32} />
      <span className="text-[11px] font-mono text-skin-dim/70">
        {text} {verb}
      </span>
      <div className="flex gap-0.5 items-center">
        <TypingDot delay={0} />
        <TypingDot delay={0.15} />
        <TypingDot delay={0.3} />
      </div>
    </motion.div>
  );
}

export function FloatingInput({ engine, replyTarget, onClearReply }: FloatingInputProps) {
  const [inputValue, setInputValue] = useState('');
  const { playerId, roster } = useGameStore();
  const typingPlayers = useGameStore(s => s.typingPlayers);
  const groupChatOpen = useGameStore(s => s.groupChatOpen);

  const replyName = replyTarget ? (roster[replyTarget.senderId]?.personaName || 'Unknown') : '';

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !playerId) return;
    engine.sendMessage(inputValue);
    engine.stopTyping('MAIN');
    setInputValue('');
    onClearReply?.();
  };

  return (
    <div className="shrink-0 bg-skin-panel/80 backdrop-blur-xl border-t border-white/[0.04]">
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
      <div className="px-3 pt-1.5 pb-3">
        <AnimatePresence>
          <TypingIndicator typingPlayers={typingPlayers} playerId={playerId} roster={roster} />
        </AnimatePresence>

        {!groupChatOpen && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-skin-dim text-xs font-mono text-center">
            Group chat is currently closed
          </div>
        )}

        {/* Reply preview */}
        <AnimatePresence>
          {replyTarget && (
            <motion.div
              className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04]"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING.snappy}
            >
              <div className="w-0.5 h-full min-h-[24px] bg-skin-pink rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-skin-pink">{replyName}</span>
                <p className="text-xs text-skin-dim truncate">{replyTarget.content}</p>
              </div>
              <button onClick={onClearReply} className="text-skin-dim shrink-0 p-1">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form className="flex gap-2 items-center" onSubmit={handleSend}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (e.target.value) engine.sendTyping('MAIN');
            }}
            placeholder={groupChatOpen ? "Spill the tea..." : "Chat closed..."}
            maxLength={280}
            disabled={!groupChatOpen}
            className="flex-1 bg-skin-deep border border-white/[0.06] rounded-full px-5 py-3 text-base text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-pink focus:shadow-[0_0_0_4px_rgba(236,72,153,0.15)] focus:border-transparent placeholder:text-skin-dim transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <motion.button
            type="submit"
            disabled={!inputValue.trim() || !groupChatOpen}
            className="shrink-0 w-12 h-12 rounded-full bg-skin-pink text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-btn"
            whileTap={TAP.fab}
            transition={SPRING.button}
          >
            <Send size={18} />
          </motion.button>
        </form>
      </div>
    </div>
  );
}
