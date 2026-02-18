import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { Send } from 'lucide-react';

interface FloatingInputProps {
  engine: {
    sendMessage: (content: string, targetId?: string) => void;
    sendTyping: (channel?: string) => void;
    stopTyping: (channel?: string) => void;
  };
}

function TypingIndicator({ typingPlayers, playerId, roster }: {
  typingPlayers: Record<string, string>;
  playerId: string | null;
  roster: Record<string, SocialPlayer>;
}) {
  const typers = Object.entries(typingPlayers)
    .filter(([pid, ch]) => ch === 'MAIN' && pid !== playerId)
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

export function FloatingInput({ engine }: FloatingInputProps) {
  const [inputValue, setInputValue] = useState('');
  const { playerId, roster } = useGameStore();
  const typingPlayers = useGameStore(s => s.typingPlayers);
  const groupChatOpen = useGameStore(s => s.groupChatOpen);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !playerId) return;
    engine.sendMessage(inputValue);
    engine.stopTyping('MAIN');
    setInputValue('');
  };

  return (
    <div className="shrink-0 bg-skin-panel/80 backdrop-blur-xl border-t border-white/[0.04]">
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <div className="px-3 pt-1.5 pb-3">
        <TypingIndicator typingPlayers={typingPlayers} playerId={playerId} roster={roster} />
        {!groupChatOpen && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-skin-dim text-xs font-mono text-center">
            Group chat is currently closed
          </div>
        )}
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
            className="flex-1 bg-skin-deep border border-white/[0.06] rounded-full px-5 py-3 text-base text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-pink focus:border-transparent placeholder:text-skin-dim transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <motion.button
            type="submit"
            disabled={!inputValue.trim() || !groupChatOpen}
            className="shrink-0 w-12 h-12 rounded-full bg-skin-pink text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed shadow-btn"
            whileTap={{ scale: 0.88, rotate: -3 }}
          >
            <Send size={18} />
          </motion.button>
        </form>
      </div>
    </div>
  );
}
