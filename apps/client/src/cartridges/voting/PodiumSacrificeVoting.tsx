import React from 'react';
import { SocialPlayer } from '@pecking-order/shared-types';

interface PodiumSacrificeVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function PodiumSacrificeVoting({ cartridge, playerId, roster, engine }: PodiumSacrificeVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results, podiumPlayerIds } = cartridge;
  const canVote = eligibleVoters.includes(playerId);
  const isOnPodium = podiumPlayerIds?.includes(playerId);
  const myVote = votes[playerId] ?? null;

  const tallies: Record<string, number> = {};
  for (const targetId of Object.values(votes) as string[]) {
    tallies[targetId] = (tallies[targetId] || 0) + 1;
  }

  if (phase === 'REVEAL') {
    const revealTallies: Record<string, number> = results?.summary?.tallies ?? tallies;
    const eliminatedId: string | null = results?.eliminatedId ?? null;

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-podium" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-orange uppercase tracking-widest text-center">
            PODIUM SACRIFICE -- RESULTS
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
                    className={`flex items-center gap-2 p-2 rounded-xl ${
                      isEliminated
                        ? 'border border-skin-danger bg-skin-danger/10 elimination-reveal'
                        : 'bg-skin-deep/40 border border-white/[0.06]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-orange avatar-ring shrink-0">
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
                    <span className="font-mono font-bold text-sm bg-skin-orange/20 rounded-full px-2 min-w-[24px] text-center text-skin-orange">{count as number}</span>
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
      <div className="h-1 vote-strip-podium" />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-skin-orange pulse-live" />
          <h3 className="text-sm font-mono font-bold text-skin-orange uppercase tracking-widest">
            PODIUM SACRIFICE
          </h3>
        </div>

        <p className="text-[10px] font-mono text-skin-dim text-center uppercase">Only top 3 can be eliminated</p>

        {podiumPlayerIds?.length > 0 && (
          <div className="flex justify-center gap-2">
            {podiumPlayerIds.map((id: string, i: number) => {
              const player = roster[id];
              const isPodiumMe = id === playerId;
              return (
                <div key={id} className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-xs ${isPodiumMe ? 'border-skin-orange/40 bg-skin-orange/10' : 'border-skin-orange/20 bg-skin-orange/5'}`}>
                  <span className="font-mono text-skin-orange text-[10px]">#{i + 1}</span>
                  <span className={`font-bold ${isPodiumMe ? 'text-skin-orange' : 'text-skin-base'}`}>{player?.personaName || id}</span>
                </div>
              );
            })}
          </div>
        )}

        {isOnPodium ? (
          <div className="text-center p-2 rounded-lg bg-skin-orange/10 border border-skin-orange/20">
            <p className="text-xs font-mono text-skin-orange uppercase tracking-wider">
              You're on the podium -- you cannot vote
            </p>
          </div>
        ) : myVote ? (
          <p className="text-xs font-mono text-skin-pink text-center uppercase tracking-wider">
            Vote cast!
          </p>
        ) : !canVote ? (
          <p className="text-xs font-mono text-skin-dim text-center uppercase tracking-wider">
            You are not eligible to vote
          </p>
        ) : (
          <p className="text-xs font-mono text-skin-dim text-center">
            Vote to eliminate a podium player
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
                onClick={() => engine.sendVoteAction('VOTE.PODIUM_SACRIFICE.CAST', targetId)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left
                  ${isSelected
                    ? 'border-skin-orange bg-skin-orange/20 ring-2 ring-skin-orange'
                    : 'bg-skin-deep/40 border-white/[0.06] hover:border-white/20'
                  }
                  ${(!!myVote || !canVote) && !isSelected ? 'opacity-40 grayscale' : ''}
                `}
              >
                <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-orange avatar-ring shrink-0">
                  {player?.personaName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate text-skin-base">
                    {player?.personaName || targetId}
                  </div>
                </div>
                {voteCount > 0 && (
                  <span className="font-mono text-xs font-bold bg-skin-orange/20 rounded-full px-2 min-w-[24px] text-center text-skin-orange count-pop">{voteCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
