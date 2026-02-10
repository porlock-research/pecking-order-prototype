import React from 'react';
import { SocialPlayer } from '@pecking-order/shared-types';

interface TrustPairsVotingProps {
  cartridge: any;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendVoteAction: (type: string, targetId: string) => void };
}

export default function TrustPairsVoting({ cartridge, playerId, roster, engine }: TrustPairsVotingProps) {
  const {
    phase,
    eligibleVoters,
    eligibleTargets,
    votes,
    results,
    trustPicks,
    votePicks,
    mutualPairs,
    immunePlayerIds,
  } = cartridge;

  const canVote = eligibleVoters.includes(playerId);
  const myTrust = trustPicks?.[playerId] ?? null;
  const myEliminate = votePicks?.[playerId] ?? null;

  if (phase === 'REVEAL') {
    const revealTallies: Record<string, number> = results?.summary?.tallies ?? {};
    const eliminatedId: string | null = results?.eliminatedId ?? null;
    const pairs: string[][] = results?.summary?.mutualPairs ?? mutualPairs ?? [];
    const immune: string[] = results?.summary?.immunePlayerIds ?? immunePlayerIds ?? [];

    return (
      <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base space-y-3">
        <h3 className="text-sm font-mono font-bold text-skin-primary uppercase tracking-widest text-center">
          TRUST PAIRS - RESULTS
        </h3>

        {pairs.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-mono text-skin-muted uppercase text-center">Mutual Trust = Immune</p>
            {pairs.map((pair: string[], i: number) => {
              const a = roster[pair[0]];
              const b = roster[pair[1]];
              return (
                <div key={i} className="flex items-center justify-center gap-2 p-2 rounded-lg border border-skin-secondary bg-skin-secondary/10">
                  <span className="text-lg">{a?.avatarUrl || '\u{1F464}'}</span>
                  <span className="text-xs font-bold text-skin-secondary">{a?.personaName || pair[0]}</span>
                  <span className="text-xs font-mono text-skin-muted">+</span>
                  <span className="text-lg">{b?.avatarUrl || '\u{1F464}'}</span>
                  <span className="text-xs font-bold text-skin-secondary">{b?.personaName || pair[1]}</span>
                  <span className="text-[10px] font-mono text-skin-secondary uppercase ml-1">immune</span>
                </div>
              );
            })}
          </div>
        )}

        {Object.keys(revealTallies).length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(revealTallies)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([targetId, count]) => {
                const player = roster[targetId];
                const isEliminated = targetId === eliminatedId;
                const isImmune = immune.includes(targetId);
                return (
                  <div
                    key={targetId}
                    className={`flex items-center gap-2 p-2 rounded-lg border ${
                      isEliminated
                        ? 'border-skin-danger bg-skin-danger/10'
                        : isImmune
                          ? 'border-skin-secondary bg-skin-secondary/10 opacity-60'
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
        )}

        {!eliminatedId && (
          <p className="text-xs font-mono text-skin-muted text-center uppercase">No elimination</p>
        )}
      </div>
    );
  }

  // VOTING phase — two sections
  const otherPlayers = eligibleTargets?.filter((id: string) => id !== playerId) ?? [];

  return (
    <div className="mx-4 my-2 p-4 rounded-xl bg-skin-surface border border-skin-base space-y-4">
      <div className="flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-skin-primary animate-pulse" />
        <h3 className="text-sm font-mono font-bold text-skin-primary uppercase tracking-widest">
          TRUST PAIRS
        </h3>
      </div>

      {/* Section 1: Trust */}
      <div className="space-y-2">
        <p className="text-xs font-mono font-bold text-skin-secondary uppercase text-center">
          Choose Your Trust Buddy
        </p>
        {myTrust ? (
          <p className="text-[10px] font-mono text-skin-secondary text-center uppercase">
            Trusted: {roster[myTrust]?.personaName || myTrust}
          </p>
        ) : !canVote ? (
          <p className="text-[10px] font-mono text-skin-muted text-center uppercase">Not eligible</p>
        ) : (
          <p className="text-[10px] font-mono text-skin-muted text-center">Tap to trust</p>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {otherPlayers.map((targetId: string) => {
            const player = roster[targetId];
            const isSelected = myTrust === targetId;
            return (
              <button
                key={`trust-${targetId}`}
                disabled={!!myTrust || !canVote}
                onClick={() => engine.sendVoteAction('VOTE.TRUST_PAIRS.TRUST', targetId)}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all
                  ${isSelected
                    ? 'border-skin-secondary bg-skin-secondary/20 ring-1 ring-skin-secondary'
                    : 'border-skin-base bg-skin-surface hover:border-skin-muted'
                  }
                  ${(!!myTrust || !canVote) && !isSelected ? 'opacity-50' : ''}
                `}
              >
                <span className="text-lg">{player?.avatarUrl || '\u{1F464}'}</span>
                <span className="text-[10px] font-bold truncate w-full text-center text-skin-base">
                  {player?.personaName || targetId}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Eliminate */}
      <div className="space-y-2 border-t border-skin-base pt-3">
        <p className="text-xs font-mono font-bold text-skin-danger uppercase text-center">
          Vote to Eliminate
        </p>
        {myEliminate ? (
          <p className="text-[10px] font-mono text-skin-danger text-center uppercase">
            Targeting: {roster[myEliminate]?.personaName || myEliminate}
          </p>
        ) : !canVote ? (
          <p className="text-[10px] font-mono text-skin-muted text-center uppercase">Not eligible</p>
        ) : (
          <p className="text-[10px] font-mono text-skin-muted text-center">Tap to eliminate</p>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {eligibleTargets?.map((targetId: string) => {
            const player = roster[targetId];
            const isSelected = myEliminate === targetId;
            return (
              <button
                key={`elim-${targetId}`}
                disabled={!!myEliminate || !canVote}
                onClick={() => engine.sendVoteAction('VOTE.TRUST_PAIRS.ELIMINATE', targetId)}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all
                  ${isSelected
                    ? 'border-skin-danger bg-skin-danger/20 ring-1 ring-skin-danger'
                    : 'border-skin-base bg-skin-surface hover:border-skin-muted'
                  }
                  ${(!!myEliminate || !canVote) && !isSelected ? 'opacity-50' : ''}
                `}
              >
                <span className="text-lg">{player?.avatarUrl || '\u{1F464}'}</span>
                <span className="text-[10px] font-bold truncate w-full text-center text-skin-base">
                  {player?.personaName || targetId}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status summary */}
      <div className="text-center text-[10px] font-mono text-skin-muted uppercase space-x-3">
        <span>Trust: {myTrust ? 'Done' : 'Pending'}</span>
        <span>Eliminate: {myEliminate ? 'Done' : 'Pending'}</span>
      </div>
    </div>
  );
}
