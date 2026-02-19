import React from 'react';
import type { SyncDecisionProjection, SocialPlayer } from '@pecking-order/shared-types';

interface SplitFinalRevealProps {
  results: NonNullable<SyncDecisionProjection['results']>;
  roster: Record<string, SocialPlayer>;
  playerId: string;
}

export default function SplitFinalReveal({ results, roster, playerId }: SplitFinalRevealProps) {
  const { summary, silverRewards, shieldWinnerId } = results;
  const winnerId = summary.winnerId as string | null;
  const winnerBonus = summary.winnerBonus as number;
  const stealCounts = summary.stealCounts as Record<string, number>;

  // Sort by silver earned (descending)
  const ranked = Object.entries(silverRewards).sort(([, a], [, b]) => b - a);

  return (
    <div className="p-4 space-y-4">
      {/* Title */}
      <div className="text-center space-y-1">
        <p className="text-lg font-bold font-display uppercase tracking-wider text-skin-gold">
          Final Results
        </p>
        {winnerId && (
          <p className="text-xs font-mono text-skin-dim">
            {roster[winnerId]?.personaName ?? winnerId} wins +{winnerBonus} bonus silver!
          </p>
        )}
      </div>

      {/* Ranking table */}
      <div className="space-y-1.5">
        {ranked.map(([pid, total], index) => {
          const name = roster[pid]?.personaName ?? pid;
          const isMe = pid === playerId;
          const isWinner = pid === winnerId;
          const isShield = pid === shieldWinnerId;
          const steals = stealCounts[pid] ?? 0;

          return (
            <div
              key={pid}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-sm font-mono ${
                isWinner
                  ? 'bg-skin-gold/10 border-skin-gold/30'
                  : 'bg-white/[0.03] border-white/[0.06]'
              } ${isMe ? 'ring-1 ring-skin-gold/30' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-skin-dim/40 text-xs w-4 text-right">#{index + 1}</span>
                <span className={isWinner ? 'text-skin-gold font-bold' : 'text-skin-base'}>
                  {name.slice(0, 14)}
                </span>
                {isWinner && (
                  <span className="text-[10px] bg-skin-gold/20 text-skin-gold px-1.5 rounded">WINNER</span>
                )}
                {isShield && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 rounded">SHIELD</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {steals > 0 && (
                  <span className="text-[10px] text-red-400/60">{steals} steal{steals !== 1 ? 's' : ''}</span>
                )}
                <span className={`font-bold ${total >= 0 ? 'text-skin-green' : 'text-red-400'}`}>
                  +{total}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gold contribution */}
      {results.goldContribution > 0 && (
        <div className="text-center p-2 rounded-lg bg-skin-gold/5 border border-skin-gold/20">
          <p className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Greed Tax</p>
          <p className="text-sm font-bold font-mono text-skin-gold">
            {results.goldContribution} silver sent to gold pool
          </p>
          <p className="text-[10px] font-mono text-skin-dim/60">from mutual steal rounds</p>
        </div>
      )}
    </div>
  );
}
