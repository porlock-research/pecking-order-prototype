import React from 'react';
import { SocialPlayer, VotingPhases, VoteEvents } from '@pecking-order/shared-types';

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

  if (phase === VotingPhases.REVEAL) {
    const revealTallies: Record<string, number> = results?.summary?.tallies ?? tallies;
    const eliminatedId: string | null = results?.eliminatedId ?? null;
    const immune: string[] = results?.summary?.immunePlayerIds ?? immunePlayerIds ?? [];

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-bubble" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-info uppercase tracking-widest text-center">
            THE BUBBLE -- RESULTS
          </h3>

          {immune.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-skin-dim uppercase text-center">Immune (Top 3 Silver)</p>
              <div className="flex justify-center gap-2">
                {immune.map((id: string) => {
                  const player = roster[id];
                  return (
                    <div key={id} className="flex items-center gap-1 p-1.5 rounded-lg border border-skin-info/30 bg-skin-info/10 text-xs animate-badge-pop">
                      <span className="font-mono text-skin-info text-[10px]">[*]</span>
                      <span className="text-skin-info font-bold">{player?.personaName || id}</span>
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
                    className={`flex items-center gap-2 p-2 rounded-xl ${
                      isEliminated
                        ? 'border border-skin-danger bg-skin-danger/10 elimination-reveal'
                        : 'bg-skin-deep/40 border border-white/[0.06]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-info avatar-ring shrink-0">
                      {player?.personaName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold truncate ${isEliminated ? 'text-skin-danger' : 'text-skin-base'}`}>
                        {player?.personaName || targetId}
                      </div>
                      {isEliminated && (
                        <span className="text-[10px] font-mono text-skin-danger uppercase animate-flash-update">ELIMINATED</span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-sm bg-skin-info/20 rounded-full px-2 min-w-[24px] text-center text-skin-info">{count as number}</span>
                  </div>
                );
              })}
          </div>

          {!eliminatedId && (
            <p className="text-xs font-mono text-skin-dim text-center uppercase">No elimination</p>
          )}
        </div>
      </div>
    );
  }

  // VOTING phase
  return (
    <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
      <div className="h-1 vote-strip-bubble" />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-skin-info pulse-live" />
          <h3 className="text-sm font-mono font-bold text-skin-info uppercase tracking-widest">
            THE BUBBLE
          </h3>
        </div>

        <p className="text-[10px] font-mono text-skin-dim text-center uppercase">Top 3 silver holders are immune</p>

        {immunePlayerIds?.length > 0 && (
          <div className="space-y-1">
            <div className="flex justify-center gap-2">
              {immunePlayerIds.map((id: string) => {
                const player = roster[id];
                return (
                  <div key={id} className="flex items-center gap-1 p-1.5 rounded-lg border border-skin-info/30 bg-skin-info/10 text-xs animate-badge-pop">
                    <span className="font-mono text-skin-info text-[10px]">[*]</span>
                    <span className="text-skin-info font-bold">{player?.personaName || id}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {myVote ? (
          <p className="text-xs font-mono text-skin-pink text-center uppercase tracking-wider">
            Vote cast!
          </p>
        ) : !canVote ? (
          <p className="text-xs font-mono text-skin-dim text-center uppercase tracking-wider">
            You are not eligible to vote
          </p>
        ) : (
          <p className="text-xs font-mono text-skin-dim text-center">
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
                onClick={() => engine.sendVoteAction(VoteEvents.BUBBLE.CAST, targetId)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left
                  ${isSelected
                    ? 'border-skin-info bg-skin-info/20 ring-2 ring-skin-info'
                    : 'bg-skin-deep/40 border-white/[0.06] hover:border-white/20'
                  }
                  ${(!!myVote || !canVote) && !isSelected ? 'opacity-40 grayscale' : ''}
                `}
              >
                <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-info avatar-ring shrink-0">
                  {player?.personaName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate text-skin-base">
                    {player?.personaName || targetId}
                  </div>
                </div>
                {voteCount > 0 && (
                  <span className="font-mono text-xs font-bold bg-skin-info/20 rounded-full px-2 min-w-[24px] text-center text-skin-info count-pop">{voteCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
