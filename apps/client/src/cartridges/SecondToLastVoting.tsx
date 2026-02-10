import React from 'react';
import { SocialPlayer } from '@pecking-order/shared-types';

interface SecondToLastVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function SecondToLastVoting({ cartridge, playerId, roster }: SecondToLastVotingProps) {
  const { phase, results, silverRanking } = cartridge;
  const ranking: Array<{ id: string; silver: number }> = results?.summary?.silverRanking ?? silverRanking ?? [];
  const eliminatedId: string | null = results?.eliminatedId ?? null;
  const maxSilver = ranking.length > 0 ? Math.max(...ranking.map(r => r.silver), 1) : 1;

  if (!ranking.length) {
    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-second" />
        <div className="p-4 text-center space-y-3">
          <span className="inline-block w-6 h-6 border-2 border-skin-dim border-t-transparent rounded-full spin-slow" />
          <p className="text-xs font-mono text-skin-dim uppercase">Calculating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
      <div className="h-1 vote-strip-second" />
      <div className="p-4 space-y-3">
        <h3 className="text-sm font-mono font-bold text-skin-dim uppercase tracking-widest text-center">
          {phase === 'REVEAL' ? 'SECOND TO LAST -- RESULTS' : 'SECOND TO LAST'}
        </h3>

        <p className="text-[10px] font-mono text-skin-dim text-center uppercase">
          No vote -- 2nd-to-last silver is automatically eliminated
        </p>

        <div className="space-y-1">
          {ranking.map((entry: { id: string; silver: number }, i: number) => {
            const player = roster[entry.id];
            const isEliminated = entry.id === eliminatedId;
            const isSecondToLast = i === ranking.length - 2;
            const barWidth = Math.max((entry.silver / maxSilver) * 100, 4);

            return (
              <div
                key={entry.id}
                className={`flex items-center gap-2 p-2 rounded-xl relative overflow-hidden ${
                  isEliminated
                    ? 'border border-skin-danger bg-skin-danger/10 elimination-reveal'
                    : isSecondToLast
                      ? 'border border-skin-danger/40 bg-skin-danger/5'
                      : 'bg-skin-deep/40 border border-white/[0.06]'
                } ${isSecondToLast && !isEliminated ? 'pulse-live' : ''}`}
              >
                {/* Silver bar background */}
                <div
                  className="absolute inset-y-0 left-0 bg-skin-dim/10 rounded-xl"
                  style={{ width: `${barWidth}%` }}
                />
                <span className="text-xs font-mono text-skin-dim w-5 text-right relative z-10">#{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-dim avatar-ring shrink-0 relative z-10">
                  {player?.personaName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0 relative z-10">
                  <div className={`text-xs font-bold truncate ${isEliminated ? 'text-skin-danger' : 'text-skin-base'}`}>
                    {player?.personaName || entry.id}
                  </div>
                  {isEliminated && (
                    <span className="text-[10px] font-mono text-skin-danger uppercase animate-flash-update">ELIMINATED</span>
                  )}
                </div>
                <span className="font-mono text-xs text-skin-dim relative z-10">{entry.silver} Ag</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
