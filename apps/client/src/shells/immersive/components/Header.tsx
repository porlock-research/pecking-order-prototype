import React from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { PushPrompt } from '../../../components/PushPrompt';
import { Coins, Trophy } from 'lucide-react';
import { PlayerStatuses } from '@pecking-order/shared-types';

interface HeaderProps {
  token: string | null;
}

export function Header({ token }: HeaderProps) {
  const { roster, goldPool, playerId } = useGameStore();
  const onlineCount = useGameStore(s => s.onlinePlayers.length);
  const me = playerId ? roster[playerId] : null;

  return (
    <header className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-b border-white/[0.06] px-4 py-2 flex items-center justify-between shadow-card z-50">
      <h1 className="text-base font-black font-display tracking-tighter text-skin-gold italic text-glow leading-none">
        PO
      </h1>
      <div className="flex items-center gap-2">
        <PushPrompt token={token} />
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-pill bg-skin-green/10 border border-skin-green/20">
          <span className="w-1.5 h-1.5 rounded-full bg-skin-green animate-pulse-live" />
          <span className="text-[9px] font-mono text-skin-green font-bold">{onlineCount}</span>
        </div>
        {me && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-pill bg-skin-gold/10 border border-skin-gold/20">
            <Coins size={11} className="text-skin-dim" />
            <span className="font-mono font-bold text-skin-gold text-sm">{me.silver}</span>
          </div>
        )}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-pill bg-amber-500/10 border border-amber-500/20">
          <Trophy size={11} className="text-amber-400" />
          <span className="font-mono font-bold text-amber-400 text-sm">{goldPool}</span>
        </div>
      </div>
    </header>
  );
}
