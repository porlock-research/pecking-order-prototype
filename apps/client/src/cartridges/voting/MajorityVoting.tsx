import React from 'react';
import { SocialPlayer, VotingPhases, VoteEvents } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';

interface MajorityVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
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

  if (phase === VotingPhases.REVEAL) {
    const revealTallies: Record<string, number> = results?.summary?.tallies ?? tallies;
    const eliminatedId: string | null = results?.eliminatedId ?? null;

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-majority" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-gold uppercase tracking-widest text-center text-glow">
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
                    className={`flex items-center gap-2 p-2 rounded-xl ${
                      isEliminated
                        ? 'border border-skin-danger bg-skin-danger/10 elimination-reveal'
                        : 'bg-skin-deep/40 border border-white/[0.06]'
                    }`}
                  >
                    <PersonaAvatar avatarUrl={player?.avatarUrl} personaName={player?.personaName} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold truncate ${isEliminated ? 'text-skin-danger' : 'text-skin-base'}`}>
                        {player?.personaName || targetId}
                      </div>
                      {isEliminated && (
                        <span className="text-[10px] font-mono text-skin-danger uppercase animate-flash-update">ELIMINATED</span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-sm bg-skin-gold/20 rounded-full px-2 min-w-[24px] text-center text-skin-gold">{count as number}</span>
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
      <div className="h-1 vote-strip-majority" />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-skin-gold pulse-live" />
          <h3 className="text-sm font-mono font-bold text-skin-gold uppercase tracking-widest text-glow">
            MAJORITY VOTE
          </h3>
        </div>

        <p className="text-[10px] font-mono text-skin-dim text-center uppercase">Most votes = eliminated</p>

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
                onClick={() => engine.sendVoteAction(VoteEvents.MAJORITY.CAST, targetId)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left
                  ${isSelected
                    ? 'border-skin-gold bg-skin-gold/20 ring-2 ring-skin-gold'
                    : 'bg-skin-deep/40 border-white/[0.06] hover:border-white/20'
                  }
                  ${(!!myVote || !canVote) && !isSelected ? 'opacity-40 grayscale' : ''}
                `}
              >
                <PersonaAvatar avatarUrl={player?.avatarUrl} personaName={player?.personaName} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate text-skin-base">
                    {player?.personaName || targetId}
                  </div>
                </div>
                {voteCount > 0 && (
                  <span className="font-mono text-xs font-bold bg-skin-gold/20 rounded-full px-2 min-w-[24px] text-center text-skin-gold count-pop">{voteCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
