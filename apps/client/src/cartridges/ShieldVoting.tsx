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
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-shield" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-pink uppercase tracking-widest text-center">
            THE SHIELD -- RESULTS
          </h3>

          <p className="text-[10px] font-mono text-skin-dim text-center uppercase">
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
                    className={`flex items-center gap-2 p-2 rounded-xl ${
                      isEliminated
                        ? 'border border-skin-danger bg-skin-danger/10 elimination-reveal'
                        : 'bg-skin-deep/40 border border-white/[0.06]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-pink avatar-ring shrink-0">
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
                    <span className="font-mono font-bold text-sm bg-skin-pink/20 rounded-full px-2 min-w-[24px] text-center text-skin-pink">{count as number}</span>
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
      <div className="h-1 vote-strip-shield" />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-skin-pink pulse-live" />
          <h3 className="text-sm font-mono font-bold text-skin-pink uppercase tracking-widest">
            THE SHIELD
          </h3>
        </div>

        <p className="text-[10px] font-mono text-skin-dim text-center uppercase">Vote to save -- fewest saves = eliminated</p>

        {myVote ? (
          <p className="text-xs font-mono text-skin-pink text-center uppercase tracking-wider">
            Shield cast!
          </p>
        ) : !canVote ? (
          <p className="text-xs font-mono text-skin-dim text-center uppercase tracking-wider">
            You are not eligible to vote
          </p>
        ) : (
          <p className="text-xs font-mono text-skin-dim text-center">
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
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left
                  ${isSelected
                    ? 'border-skin-pink bg-skin-pink/20 ring-2 ring-skin-pink'
                    : 'bg-skin-deep/40 border-white/[0.06] hover:border-white/20'
                  }
                  ${(!!myVote || !canVote) && !isSelected ? 'opacity-40 grayscale' : ''}
                `}
              >
                <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-pink avatar-ring shrink-0">
                  {player?.personaName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate text-skin-base">
                    {player?.personaName || targetId}
                  </div>
                </div>
                {saveCount > 0 && (
                  <span className="font-mono text-xs font-bold bg-skin-pink/20 rounded-full px-2 min-w-[24px] text-center text-skin-pink count-pop">{saveCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
