import React from 'react';
import { SocialPlayer } from '@pecking-order/shared-types';

interface ShieldVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function ShieldVoting({ cartridge, playerId, roster, engine }: ShieldVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results } = cartridge;
  const canVote = eligibleVoters.includes(playerId);
  const myVote = votes[playerId] ?? null;

  // Count saves per target
  const saveCounts: Record<string, number> = {};
  for (const targetId of Object.values(votes) as string[]) {
    saveCounts[targetId] = (saveCounts[targetId] || 0) + 1;
  }

  if (phase === 'REVEAL') {
    const revealSaves: Record<string, number> = results?.summary?.saveCounts ?? saveCounts;
    const eliminatedId: string | null = results?.eliminatedId ?? null;

    return (
      <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base space-y-3">
        <h3 className="text-sm font-mono font-bold text-skin-secondary uppercase tracking-widest text-center">
          THE SHIELD - RESULTS
        </h3>

        <p className="text-[10px] font-mono text-skin-muted text-center uppercase">
          Fewest saves = eliminated
        </p>

        <div className="grid grid-cols-2 gap-2">
          {Object.entries(revealSaves)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([targetId, count]) => {
              const player = roster[targetId];
              const isEliminated = targetId === eliminatedId;
              return (
                <div
                  key={targetId}
                  className={`flex items-center gap-2 p-2 rounded-lg border ${
                    isEliminated
                      ? 'border-skin-danger bg-skin-danger/10'
                      : 'border-skin-base bg-skin-surface'
                  }`}
                >
                  <span className="text-lg">{player?.avatarUrl || '\u{1F464}'}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold truncate ${isEliminated ? 'text-skin-danger' : 'text-skin-base'}`}>
                      {player?.personaName || targetId}
                    </div>
                    {isEliminated && (
                      <span className="text-[10px] font-mono text-skin-danger uppercase">eliminated</span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-sm text-skin-secondary">{count as number}</span>
                </div>
              );
            })}
        </div>

        {!eliminatedId && (
          <p className="text-xs font-mono text-skin-muted text-center uppercase">No elimination</p>
        )}
      </div>
    );
  }

  // VOTING phase
  return (
    <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base space-y-3">
      <div className="flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-skin-secondary animate-pulse" />
        <h3 className="text-sm font-mono font-bold text-skin-secondary uppercase tracking-widest">
          THE SHIELD
        </h3>
      </div>

      {myVote ? (
        <p className="text-xs font-mono text-skin-secondary text-center uppercase tracking-wider">
          Shield cast!
        </p>
      ) : !canVote ? (
        <p className="text-xs font-mono text-skin-muted text-center uppercase tracking-wider">
          You are not eligible to vote
        </p>
      ) : (
        <p className="text-xs font-mono text-skin-muted text-center">
          Choose someone to SAVE
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {eligibleTargets.map((targetId: string) => {
          const player = roster[targetId];
          const isSelected = myVote === targetId;
          const saveCount = saveCounts[targetId] || 0;

          return (
            <button
              key={targetId}
              disabled={!!myVote || !canVote}
              onClick={() => engine.sendVoteAction('VOTE.SHIELD.SAVE', targetId)}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left
                ${isSelected
                  ? 'border-skin-secondary bg-skin-secondary/20 ring-1 ring-skin-secondary'
                  : 'border-skin-base bg-skin-surface hover:border-skin-muted'
                }
                ${(!!myVote || !canVote) && !isSelected ? 'opacity-60' : ''}
              `}
            >
              <span className="text-lg shrink-0">{player?.avatarUrl || '\u{1F464}'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate text-skin-base">
                  {player?.personaName || targetId}
                </div>
              </div>
              {saveCount > 0 && (
                <span className="font-mono text-xs font-bold text-skin-secondary">{saveCount}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
