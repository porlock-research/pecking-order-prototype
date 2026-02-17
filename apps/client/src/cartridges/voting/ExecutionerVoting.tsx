import React from 'react';
import { SocialPlayer, VotingPhases, VoteEvents } from '@pecking-order/shared-types';

interface ExecutionerVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function ExecutionerVoting({ cartridge, playerId, roster, engine }: ExecutionerVotingProps) {
  const {
    phase,
    eligibleVoters,
    eligibleTargets,
    votes,
    results,
    executionerId,
    electionTallies,
  } = cartridge;

  // REVEAL phase
  if (phase === VotingPhases.REVEAL) {
    const eliminatedId: string | null = results?.eliminatedId ?? null;
    const exId: string | null = results?.summary?.executionerId ?? executionerId ?? null;
    const revealTallies: Record<string, number> = results?.summary?.electionTallies ?? electionTallies ?? {};
    const executioner = exId ? roster[exId] : null;
    const eliminated = eliminatedId ? roster[eliminatedId] : null;

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-executioner" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-danger uppercase tracking-widest text-center">
            EXECUTIONER RESULTS
          </h3>

          {executioner && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-danger avatar-ring shrink-0">
                {executioner.personaName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span className="font-bold text-skin-base">{executioner.personaName}</span>
              <span className="text-[10px] font-mono text-skin-dim uppercase">was the executioner</span>
            </div>
          )}

          {eliminated ? (
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl border border-skin-danger bg-skin-danger/10 elimination-reveal">
              <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-danger shrink-0">
                {eliminated.personaName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-sm font-bold text-skin-danger">{eliminated.personaName}</div>
                <span className="text-[10px] font-mono text-skin-danger uppercase animate-flash-update">ELIMINATED</span>
              </div>
            </div>
          ) : (
            <p className="text-xs font-mono text-skin-dim text-center uppercase">No elimination</p>
          )}

          {Object.keys(revealTallies).length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-skin-dim uppercase text-center">Election Tallies</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(revealTallies)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([targetId, count]) => {
                    const player = roster[targetId];
                    return (
                      <div key={targetId} className="flex items-center gap-1 p-1.5 rounded-lg bg-skin-deep/40 border border-white/[0.06] text-xs">
                        <div className="w-6 h-6 rounded-full bg-skin-panel flex items-center justify-center text-[10px] font-bold font-mono text-skin-gold shrink-0">
                          {player?.personaName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="truncate flex-1 text-skin-base">{player?.personaName || targetId}</span>
                        <span className="font-mono font-bold text-skin-gold">{count as number}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // EXECUTIONER_PICKING phase
  if (phase === VotingPhases.EXECUTIONER_PICKING) {
    const isExecutioner = playerId === executionerId;
    const executioner = executionerId ? roster[executionerId] : null;

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-executioner" />
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-skin-danger pulse-live" />
            <h3 className="text-sm font-mono font-bold text-skin-danger uppercase tracking-widest">
              EXECUTIONER'S CHOICE
            </h3>
          </div>

          {executioner && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-skin-danger/20 border border-skin-danger/40 flex items-center justify-center text-xs font-bold font-mono text-skin-danger shrink-0">
                {executioner.personaName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span className="font-bold text-skin-base">{executioner.personaName}</span>
              <span className="text-[10px] font-mono bg-skin-danger/20 text-skin-danger px-2 py-0.5 rounded-full uppercase">executioner</span>
            </div>
          )}

          {isExecutioner ? (
            <>
              <p className="text-xs font-mono text-skin-danger text-center">
                Choose who to eliminate
              </p>
              <div className="grid grid-cols-2 gap-2">
                {eligibleTargets.map((targetId: string) => {
                  const player = roster[targetId];
                  return (
                    <button
                      key={targetId}
                      onClick={() => engine.sendVoteAction(VoteEvents.EXECUTIONER.PICK, targetId)}
                      className="flex items-center gap-2 p-2 rounded-xl bg-skin-deep/40 border border-white/[0.06] hover:border-skin-danger hover:bg-skin-danger/10 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-gold avatar-ring shrink-0">
                        {player?.personaName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="text-xs font-bold truncate text-skin-base">
                        {player?.personaName || targetId}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center space-y-2 py-4">
              <div className="w-10 h-10 mx-auto rounded-full bg-skin-danger/10 border border-skin-danger/20 flex items-center justify-center glow-breathe">
                <span className="font-mono text-skin-danger text-lg font-bold">?</span>
              </div>
              <p className="text-xs font-mono text-skin-dim italic">
                The Executioner is choosing...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // VOTING phase (election)
  const canVote = eligibleVoters.includes(playerId);
  const myVote = votes[playerId] ?? null;

  const tallies: Record<string, number> = {};
  for (const targetId of Object.values(votes) as string[]) {
    tallies[targetId] = (tallies[targetId] || 0) + 1;
  }

  return (
    <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
      <div className="h-1 vote-strip-majority" />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-skin-gold pulse-live" />
          <h3 className="text-sm font-mono font-bold text-skin-gold uppercase tracking-widest text-glow">
            ELECT THE EXECUTIONER
          </h3>
        </div>

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
            Tap a player to nominate as executioner
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
                onClick={() => engine.sendVoteAction(VoteEvents.EXECUTIONER.ELECT, targetId)}
                className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left
                  ${isSelected
                    ? 'border-skin-gold bg-skin-gold/20 ring-2 ring-skin-gold'
                    : 'bg-skin-deep/40 border-white/[0.06] hover:border-white/20'
                  }
                  ${(!!myVote || !canVote) && !isSelected ? 'opacity-40 grayscale' : ''}
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
