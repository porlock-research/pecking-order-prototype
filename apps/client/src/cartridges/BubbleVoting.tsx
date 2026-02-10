import React from 'react';
import { SocialPlayer } from '@pecking-order/shared-types';

interface BubbleVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function BubbleVoting({ cartridge, playerId, roster, engine }: BubbleVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results, immunePlayerIds } = cartridge;
  const canVote = eligibleVoters.includes(playerId);
  const myVote = votes[playerId] ?? null;

  const tallies: Record<string, number> = {};
  for (const targetId of Object.values(votes) as string[]) {
    tallies[targetId] = (tallies[targetId] || 0) + 1;
  }

  if (phase === 'REVEAL') {
    const revealTallies: Record<string, number> = results?.summary?.tallies ?? tallies;
    const eliminatedId: string | null = results?.eliminatedId ?? null;
    const immune: string[] = results?.summary?.immunePlayerIds ?? immunePlayerIds ?? [];

    return (
      <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base space-y-3">
        <h3 className="text-sm font-mono font-bold text-skin-primary uppercase tracking-widest text-center">
          THE BUBBLE - RESULTS
        </h3>

        {immune.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-mono text-skin-muted uppercase text-center">Immune (Top 3 Silver)</p>
            <div className="flex justify-center gap-2">
              {immune.map((id: string) => {
                const player = roster[id];
                return (
                  <div key={id} className="flex items-center gap-1 p-1.5 rounded border border-skin-secondary bg-skin-secondary/10 text-xs">
                    <span>{player?.avatarUrl || '\u{1F464}'}</span>
                    <span className="text-skin-secondary font-bold">{player?.personaName || id}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
                  <span className="text-lg">{player?.avatarUrl || '\u{1F464}'}</span>
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
          THE BUBBLE
        </h3>
      </div>

      {immunePlayerIds?.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-skin-muted uppercase text-center">Immune (Top 3 Silver)</p>
          <div className="flex justify-center gap-2">
            {immunePlayerIds.map((id: string) => {
              const player = roster[id];
              return (
                <div key={id} className="flex items-center gap-1 p-1.5 rounded border border-skin-secondary bg-skin-secondary/10 text-xs opacity-60">
                  <span>{player?.avatarUrl || '\u{1F464}'}</span>
                  <span className="text-skin-secondary font-bold">{player?.personaName || id}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
          Tap a player to vote (ranks 4+ only)
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
              onClick={() => engine.sendVoteAction('VOTE.BUBBLE.CAST', targetId)}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left
                ${isSelected
                  ? 'border-skin-primary bg-skin-primary/20 ring-1 ring-skin-primary'
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
