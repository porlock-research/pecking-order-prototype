import React from 'react';
import { SocialPlayer } from '@pecking-order/shared-types';

interface MajorityVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVote: (targetId: string) => void };
}

export default function MajorityVoting({ cartridge, playerId, roster, engine }: MajorityVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results } = cartridge;
  const canVote = eligibleVoters.includes(playerId);
  const myVote = votes[playerId] ?? null;

  // Count votes per target
  const tallies: Record<string, number> = {};
  for (const targetId of Object.values(votes) as string[]) {
    tallies[targetId] = (tallies[targetId] || 0) + 1;
  }

  if (phase === 'REVEAL') {
    const revealTallies: Record<string, number> = results?.summary?.tallies ?? tallies;
    const eliminatedId: string | null = results?.eliminatedId ?? null;

    return (
      <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base space-y-3">
        <h3 className="text-sm font-mono font-bold text-skin-primary uppercase tracking-widest text-center">
          VOTE RESULTS
        </h3>

        <div className="grid grid-cols-2 gap-2">
          {Object.entries(revealTallies)
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
                  <span className="text-lg">{player?.avatarUrl || '👤'}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold truncate ${isEliminated ? 'text-skin-danger' : 'text-skin-base'}`}>
                      {player?.personaName || targetId}
                    </div>
                    {isEliminated && (
                      <span className="text-[10px] font-mono text-skin-danger uppercase">eliminated</span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-sm text-skin-primary">{count as number}</span>
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
        <span className="w-2 h-2 rounded-full bg-skin-primary animate-pulse" />
        <h3 className="text-sm font-mono font-bold text-skin-primary uppercase tracking-widest">
          MAJORITY VOTE
        </h3>
      </div>

      {myVote ? (
        <p className="text-xs font-mono text-skin-secondary text-center uppercase tracking-wider">
          Vote cast!
        </p>
      ) : !canVote ? (
        <p className="text-xs font-mono text-skin-muted text-center uppercase tracking-wider">
          You are not eligible to vote
        </p>
      ) : (
        <p className="text-xs font-mono text-skin-muted text-center">
          Tap a player to vote
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {eligibleTargets.map((targetId: string) => {
          const player = roster[targetId];
          const isSelected = myVote === targetId;
          const voteCount = tallies[targetId] || 0;

          return (
            <button
              key={targetId}
              disabled={!!myVote || !canVote}
              onClick={() => engine.sendVote(targetId)}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left
                ${isSelected
                  ? 'border-skin-primary bg-skin-primary/20 ring-1 ring-skin-primary'
                  : 'border-skin-base bg-skin-surface hover:border-skin-muted'
                }
                ${(!!myVote || !canVote) && !isSelected ? 'opacity-60' : ''}
              `}
            >
              <span className="text-lg shrink-0">{player?.avatarUrl || '👤'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate text-skin-base">
                  {player?.personaName || targetId}
                </div>
              </div>
              {voteCount > 0 && (
                <span className="font-mono text-xs font-bold text-skin-primary">{voteCount}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
