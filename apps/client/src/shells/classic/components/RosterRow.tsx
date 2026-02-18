import React from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { Coins, Trophy } from 'lucide-react';

interface RosterRowProps {
  player: any;
  playerId: string;
  onClick?: () => void;
}

export function RosterRow({ player, playerId, onClick }: RosterRowProps) {
  const isMe = player.id === playerId;
  const isOnline = useGameStore((s) => s.onlinePlayers.includes(player.id));
  return (
    <li
      onClick={onClick}
      className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer
        ${isMe
          ? 'bg-skin-gold/10 border-skin-gold/30'
          : 'bg-glass border-white/[0.06] hover:border-white/20'
        }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-skin-panel flex items-center justify-center text-sm font-bold font-mono text-skin-gold avatar-ring">
            {player.personaName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-skin-fill ${isOnline ? 'bg-skin-green' : 'bg-skin-dim/40'}`} />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm">
            {player.personaName}
            {isMe && <span className="ml-2 badge-skew text-[9px]">YOU</span>}
          </span>
          <span className="text-[10px] font-mono text-skin-dim uppercase tracking-wider">{player.status}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 font-mono text-sm text-skin-gold font-bold">
          <Coins size={12} className="text-skin-dim" />
          {player.silver}
        </div>
        {player.gold > 0 && (
          <div className="flex items-center gap-1 font-mono text-sm text-amber-400 font-bold">
            <Trophy size={12} />
            {player.gold}
          </div>
        )}
      </div>
    </li>
  );
}
