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

  if (!ranking.length) {
    return (
      <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base text-center">
        <div className="text-2xl animate-pulse">...</div>
        <p className="text-xs font-mono text-skin-muted uppercase mt-2">Calculating...</p>
      </div>
    );
  }

  return (
    <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base space-y-3">
      <h3 className="text-sm font-mono font-bold text-skin-primary uppercase tracking-widest text-center">
        {phase === 'REVEAL' ? 'SECOND TO LAST - RESULTS' : 'SECOND TO LAST'}
      </h3>

      <p className="text-[10px] font-mono text-skin-muted text-center uppercase">
        No vote — 2nd-to-last silver is automatically eliminated
      </p>

      <div className="space-y-1">
        {ranking.map((entry: { id: string; silver: number }, i: number) => {
          const player = roster[entry.id];
          const isEliminated = entry.id === eliminatedId;
          const isSecondToLast = i === ranking.length - 2;

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-2 p-2 rounded-lg border ${
                isEliminated || isSecondToLast
                  ? 'border-skin-danger bg-skin-danger/10'
                  : 'border-skin-base bg-skin-surface'
              }`}
            >
              <span className="text-xs font-mono text-skin-muted w-5 text-right">#{i + 1}</span>
              <span className="text-lg">{player?.avatarUrl || '\u{1F464}'}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-bold truncate ${isEliminated ? 'text-skin-danger' : 'text-skin-base'}`}>
                  {player?.personaName || entry.id}
                </div>
                {isEliminated && (
                  <span className="text-[10px] font-mono text-skin-danger uppercase">eliminated</span>
                )}
              </div>
              <span className="font-mono text-xs text-skin-muted">{entry.silver} silver</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
