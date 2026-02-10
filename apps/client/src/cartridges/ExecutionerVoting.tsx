import React from 'react';
import { SocialPlayer } from '@pecking-order/shared-types';

interface ExecutionerVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendVote: (targetId: string) => void;
    sendExecutionerPick: (targetId: string) => void;
  };
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
  if (phase === 'REVEAL') {
    const eliminatedId: string | null = results?.eliminatedId ?? null;
    const exId: string | null = results?.summary?.executionerId ?? executionerId ?? null;
    const revealTallies: Record<string, number> = results?.summary?.electionTallies ?? electionTallies ?? {};
    const executioner = exId ? roster[exId] : null;
    const eliminated = eliminatedId ? roster[eliminatedId] : null;

    return (
      <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base space-y-3">
        <h3 className="text-sm font-mono font-bold text-skin-primary uppercase tracking-widest text-center">
          EXECUTIONER RESULTS
        </h3>

        {executioner && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-lg">{executioner.avatarUrl || '👤'}</span>
            <span className="font-bold text-skin-base">{executioner.personaName}</span>
            <span className="text-[10px] font-mono text-skin-muted uppercase">was the executioner</span>
          </div>
        )}

        {eliminated ? (
          <div className="flex items-center justify-center gap-2 p-3 rounded-lg border border-skin-danger bg-skin-danger/10">
            <span className="text-lg">{eliminated.avatarUrl || '👤'}</span>
            <div>
              <div className="text-sm font-bold text-skin-danger">{eliminated.personaName}</div>
              <span className="text-[10px] font-mono text-skin-danger uppercase">eliminated</span>
            </div>
          </div>
        ) : (
          <p className="text-xs font-mono text-skin-muted text-center uppercase">No elimination</p>
        )}

        {Object.keys(revealTallies).length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-mono text-skin-muted uppercase text-center">Election Tallies</p>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(revealTallies)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([targetId, count]) => {
                  const player = roster[targetId];
                  return (
                    <div key={targetId} className="flex items-center gap-1 p-1.5 rounded border border-skin-base text-xs">
                      <span>{player?.avatarUrl || '👤'}</span>
                      <span className="truncate flex-1 text-skin-base">{player?.personaName || targetId}</span>
                      <span className="font-mono font-bold text-skin-primary">{count as number}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // EXECUTIONER_PICKING phase
  if (phase === 'EXECUTIONER_PICKING') {
    const isExecutioner = playerId === executionerId;
    const executioner = executionerId ? roster[executionerId] : null;

    return (
      <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-skin-danger animate-pulse" />
          <h3 className="text-sm font-mono font-bold text-skin-danger uppercase tracking-widest">
            EXECUTIONER'S CHOICE
          </h3>
        </div>

        {executioner && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-lg">{executioner.avatarUrl || '👤'}</span>
            <span className="font-bold text-skin-base">{executioner.personaName}</span>
            <span className="text-[10px] font-mono text-skin-primary uppercase">executioner</span>
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
                    onClick={() => engine.sendExecutionerPick(targetId)}
                    className="flex items-center gap-2 p-2 rounded-lg border border-skin-base bg-skin-surface hover:border-skin-danger hover:bg-skin-danger/10 transition-all text-left"
                  >
                    <span className="text-lg shrink-0">{player?.avatarUrl || '👤'}</span>
                    <div className="text-xs font-bold truncate text-skin-base">
                      {player?.personaName || targetId}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center space-y-2 py-2">
            <div className="text-2xl animate-pulse">...</div>
            <p className="text-xs font-mono text-skin-muted uppercase">
              The Executioner is choosing...
            </p>
          </div>
        )}
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
    <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base space-y-3">
      <div className="flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-skin-primary animate-pulse" />
        <h3 className="text-sm font-mono font-bold text-skin-primary uppercase tracking-widest">
          ELECT THE EXECUTIONER
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
