import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import type { GameHistoryEntry } from '@pecking-order/shared-types';
import { Coins, ChevronDown, ChevronRight, Trophy, Clock } from 'lucide-react';

const GAME_LABELS: Record<string, string> = {
  BET_BET_BET: 'Bet Bet Bet',
  BLIND_AUCTION: 'Blind Auction',
  KINGS_RANSOM: "King's Ransom",
  TRIVIA: 'Trivia',
  REALTIME_TRIVIA: 'Live Trivia',
  GAP_RUN: 'Gap Run',
  GRID_PUSH: 'Grid Push',
  SEQUENCE: 'Sequence',
  REACTION_TIME: 'Reaction Time',
  COLOR_MATCH: 'Color Match',
  STACKER: 'Stacker',
  QUICK_MATH: 'Quick Math',
  SIMON_SAYS: 'Simon Says',
  AIM_TRAINER: 'Aim Trainer',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function EntryRow({ entry, playerId, roster }: {
  entry: GameHistoryEntry;
  playerId: string;
  roster: Record<string, any>;
}) {
  const [expanded, setExpanded] = useState(false);
  const mySilver = entry.silverRewards[playerId] ?? 0;
  const label = GAME_LABELS[entry.gameType] || entry.gameType;

  return (
    <div className="border border-white/[0.06] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown size={14} className="text-skin-dim" /> : <ChevronRight size={14} className="text-skin-dim" />}
          <span className="text-xs font-bold uppercase tracking-wide text-skin-base">{label}</span>
          <span className="text-[10px] font-mono text-skin-dim">
            <Clock size={10} className="inline mr-0.5" />
            {formatTime(entry.timestamp)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Coins size={11} className="text-gray-300" />
          <span className={`font-mono text-xs font-bold ${mySilver > 0 ? 'text-skin-green' : mySilver < 0 ? 'text-skin-danger' : 'text-skin-dim'}`}>
            {mySilver > 0 ? '+' : ''}{mySilver}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-2 pt-1 border-t border-white/[0.04] space-y-1 animate-fade-in">
          <ResultsTable entry={entry} roster={roster} playerId={playerId} />
        </div>
      )}
    </div>
  );
}

function ResultsTable({ entry, roster, playerId }: {
  entry: GameHistoryEntry;
  roster: Record<string, any>;
  playerId: string;
}) {
  // Sort by silver descending
  const sorted = Object.entries(entry.silverRewards)
    .sort(([, a], [, b]) => (b as number) - (a as number));

  if (sorted.length === 0) {
    return <p className="text-[10px] text-skin-dim font-mono">No results recorded</p>;
  }

  return (
    <div className="space-y-1">
      {sorted.map(([pid, silver], i) => {
        const name = roster[pid]?.personaName || pid;
        const isMe = pid === playerId;
        const s = silver as number;
        return (
          <div
            key={pid}
            className={`flex items-center justify-between text-xs px-2 py-1 rounded ${isMe ? 'bg-skin-gold/10' : ''}`}
          >
            <div className="flex items-center gap-2">
              {i === 0 && s > 0 && <Trophy size={11} className="text-skin-gold" />}
              <span className={`font-mono ${isMe ? 'text-skin-gold font-bold' : 'text-skin-base'}`}>
                {name}
              </span>
            </div>
            <span className={`font-mono font-bold ${s > 0 ? 'text-skin-green' : s < 0 ? 'text-skin-danger' : 'text-skin-dim'}`}>
              {s > 0 ? '+' : ''}{s}
            </span>
          </div>
        );
      })}
      {entry.goldContribution > 0 && (
        <div className="text-[10px] font-mono text-skin-dim pt-1 border-t border-white/[0.04]">
          +{entry.goldContribution} gold contributed
        </div>
      )}
    </div>
  );
}

export default function GameHistory() {
  const gameHistory = useGameStore((s) => s.gameHistory);
  const playerId = useGameStore((s) => s.playerId);
  const roster = useGameStore((s) => s.roster);
  const [collapsed, setCollapsed] = useState(true);

  if (!gameHistory || gameHistory.length === 0 || !playerId) return null;

  // Group by dayIndex
  const byDay = new Map<number, GameHistoryEntry[]>();
  for (const entry of gameHistory) {
    const existing = byDay.get(entry.dayIndex) || [];
    existing.push(entry);
    byDay.set(entry.dayIndex, existing);
  }
  const sortedDays = Array.from(byDay.entries()).sort(([a], [b]) => b - a);

  return (
    <div className="mx-4 my-2 rounded-xl bg-glass border border-white/[0.06] overflow-hidden shadow-card">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-skin-base font-display">
            Game History
          </span>
          <span className="text-[10px] font-mono bg-skin-gold/10 border border-skin-gold/30 rounded-pill px-1.5 py-0.5 text-skin-gold">
            {gameHistory.length}
          </span>
        </div>
        {collapsed
          ? <ChevronRight size={14} className="text-skin-dim" />
          : <ChevronDown size={14} className="text-skin-dim" />
        }
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-3 animate-fade-in">
          {sortedDays.map(([dayIndex, entries]) => (
            <div key={dayIndex} className="space-y-1.5">
              <p className="text-[10px] font-mono text-skin-dim uppercase tracking-widest px-1">
                Day {dayIndex}
              </p>
              {entries.map((entry, i) => (
                <EntryRow key={`${entry.gameType}-${entry.timestamp}-${i}`} entry={entry} playerId={playerId} roster={roster} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
