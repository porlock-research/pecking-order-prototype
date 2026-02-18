import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import type { SocialPlayer } from '@pecking-order/shared-types';

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

interface TimelineInputProps {
  engine: {
    sendMessage: (content: string, targetId?: string) => void;
    sendTyping: (channel?: string) => void;
    stopTyping: (channel?: string) => void;
  };
  inputValue: string;
  setInputValue: (val: string) => void;
  onSend: (e: React.FormEvent) => void;
}

export const TimelineInput: React.FC<TimelineInputProps> = ({
  engine,
  inputValue,
  setInputValue,
  onSend,
}) => {
  const { playerId, roster } = useGameStore();
  const typingPlayers = useGameStore(s => s.typingPlayers);
  const groupChatOpen = useGameStore(s => s.groupChatOpen);

  return (
    <div className="shrink-0 p-3 bg-skin-panel/80 backdrop-blur-lg border-t border-white/[0.06]">
      <TypingIndicator typingPlayers={typingPlayers} playerId={playerId} roster={roster} />
      {!groupChatOpen && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-skin-dim text-xs font-mono text-center">
          Group chat is currently closed
        </div>
      )}
      <form className="flex gap-2 items-center max-w-3xl mx-auto" onSubmit={onSend}>
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
          className="flex-1 bg-skin-deep border border-white/[0.06] rounded-full px-5 py-3 text-sm text-skin-base focus:outline-none focus:ring-2 focus:ring-skin-pink focus:border-transparent focus:shadow-[0_0_15px_var(--po-pink-dim)] placeholder:text-skin-dim transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || !groupChatOpen}
          className="bg-skin-pink text-white rounded-full px-4 py-3 font-display font-bold text-xs uppercase tracking-wider hover:brightness-110 active:translate-y-[1px] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          SHOUT &gt;
        </button>
      </form>
    </div>
  );
};
