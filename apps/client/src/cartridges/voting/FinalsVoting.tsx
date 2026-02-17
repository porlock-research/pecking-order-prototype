import React from 'react';
import { SocialPlayer } from '@pecking-order/shared-types';
import { Trophy } from 'lucide-react';

interface FinalsVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function FinalsVoting({ cartridge, playerId, roster, engine }: FinalsVotingProps) {
  const { phase, eligibleVoters, eligibleTargets, votes, results } = cartridge;
  const canVote = eligibleVoters.includes(playerId);
  const isFinalist = eligibleTargets.includes(playerId);
  const myVote = votes[playerId] ?? null;

  // Count votes per target
  const tallies: Record<string, number> = {};
  for (const targetId of Object.values(votes) as string[]) {
    tallies[targetId] = (tallies[targetId] || 0) + 1;
  }

  if (phase === 'WINNER') {
    const voteCounts: Record<string, number> = results?.summary?.voteCounts ?? tallies;
    const winnerId: string | null = results?.winnerId ?? null;
    const winnerPlayer = winnerId ? roster[winnerId] : null;

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-gold uppercase tracking-widest text-center text-glow">
            THE WINNER
          </h3>

          {winnerPlayer && (
            <div className="flex flex-col items-center gap-2 py-3">
              <div className="w-16 h-16 rounded-full bg-skin-panel flex items-center justify-center text-2xl font-bold font-mono text-skin-gold avatar-ring ring-2 ring-skin-gold">
                {winnerPlayer.personaName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-lg font-bold text-skin-gold">{winnerPlayer.personaName}</span>
                <Trophy className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(voteCounts)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([targetId, count]) => {
                const player = roster[targetId];
                const isWinner = targetId === winnerId;
                return (
                  <div
                    key={targetId}
                    className={`flex items-center gap-2 p-2 rounded-xl ${
                      isWinner
                        ? 'border border-skin-gold bg-skin-gold/20'
                        : 'bg-skin-deep/40 border border-white/[0.06]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-gold avatar-ring shrink-0">
                      {player?.personaName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold truncate ${isWinner ? 'text-skin-gold' : 'text-skin-base'}`}>
                        {player?.personaName || targetId}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-sm bg-skin-gold/20 rounded-full px-2 min-w-[24px] text-center text-skin-gold">{count as number}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  // VOTING phase
  return (
    <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <h3 className="text-sm font-mono font-bold text-skin-gold uppercase tracking-widest text-glow">
            FINALS VOTE
          </h3>
          <Trophy className="w-4 h-4 text-yellow-400" />
        </div>

        <p className="text-[10px] font-mono text-skin-dim text-center uppercase">
          Eliminated players vote for their favorite survivor
        </p>

        {isFinalist ? (
          <p className="text-xs font-mono text-skin-gold text-center uppercase tracking-wider">
            You are a finalist
          </p>
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
            Tap a player to crown the winner
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
                disabled={!!myVote || !canVote || isFinalist}
                onClick={() => engine.sendVoteAction('VOTE.FINALS.CAST', targetId)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left
                  ${isSelected
                    ? 'border-skin-gold bg-skin-gold/20 ring-2 ring-skin-gold'
                    : 'bg-skin-deep/40 border-white/[0.06] hover:border-white/20'
                  }
                  ${(!!myVote || !canVote || isFinalist) && !isSelected ? 'opacity-40 grayscale' : ''}
                `}
              >
                <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-gold avatar-ring shrink-0">
                  {player?.personaName?.charAt(0)?.toUpperCase() || '?'}
                </div>
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
