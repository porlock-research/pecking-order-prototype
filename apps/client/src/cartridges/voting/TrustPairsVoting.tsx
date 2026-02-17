import React from 'react';
import { SocialPlayer, VotingPhases, VoteEvents } from '@pecking-order/shared-types';

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

  if (phase === VotingPhases.REVEAL) {
    const revealTallies: Record<string, number> = results?.summary?.tallies ?? {};
    const eliminatedId: string | null = results?.eliminatedId ?? null;
    const pairs: string[][] = results?.summary?.mutualPairs ?? mutualPairs ?? [];
    const immune: string[] = results?.summary?.immunePlayerIds ?? immunePlayerIds ?? [];

    return (
      <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
        <div className="h-1 vote-strip-trust" />
        <div className="p-4 space-y-3 animate-slide-up-in">
          <h3 className="text-sm font-mono font-bold text-skin-green uppercase tracking-widest text-center">
            TRUST PAIRS -- RESULTS
          </h3>

          {pairs.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-skin-dim uppercase text-center">Mutual Trust = Immune</p>
              {pairs.map((pair: string[], i: number) => {
                const a = roster[pair[0]];
                const b = roster[pair[1]];
                return (
                  <div key={i} className="flex items-center justify-center gap-2 p-2 rounded-xl border border-skin-green/30 bg-skin-green/10 animate-badge-pop">
                    <div className="w-7 h-7 rounded-full bg-skin-panel flex items-center justify-center text-[10px] font-bold font-mono text-skin-green shrink-0">
                      {a?.personaName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span className="text-xs font-bold text-skin-green">{a?.personaName || pair[0]}</span>
                    <span className="text-xs font-mono text-skin-dim">+</span>
                    <div className="w-7 h-7 rounded-full bg-skin-panel flex items-center justify-center text-[10px] font-bold font-mono text-skin-green shrink-0">
                      {b?.personaName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span className="text-xs font-bold text-skin-green">{b?.personaName || pair[1]}</span>
                    <span className="text-[10px] font-mono bg-skin-green/20 text-skin-green px-2 py-0.5 rounded-full uppercase ml-1">immune</span>
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
                      className={`flex items-center gap-2 p-2 rounded-xl ${
                        isEliminated
                          ? 'border border-skin-danger bg-skin-danger/10 elimination-reveal'
                          : isImmune
                            ? 'border border-skin-green/30 bg-skin-green/10 opacity-60'
                            : 'bg-skin-deep/40 border border-white/[0.06]'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-green avatar-ring shrink-0">
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
                      <span className="font-mono font-bold text-sm bg-skin-green/20 rounded-full px-2 min-w-[24px] text-center text-skin-green">{count as number}</span>
                    </div>
                  );
                })}
            </div>
          )}

          {!eliminatedId && (
            <p className="text-xs font-mono text-skin-dim text-center uppercase">No elimination</p>
          )}
        </div>
      </div>
    );
  }

  // VOTING phase -- two sections
  const otherPlayers = eligibleTargets?.filter((id: string) => id !== playerId) ?? [];

  return (
    <div className="mx-4 my-2 rounded-xl vote-panel overflow-hidden">
      <div className="h-1 vote-strip-trust" />
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-skin-green pulse-live" />
          <h3 className="text-sm font-mono font-bold text-skin-green uppercase tracking-widest">
            TRUST PAIRS
          </h3>
        </div>

        {/* Section 1: Trust */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-skin-green" />
            <p className="text-xs font-mono font-bold text-skin-green uppercase text-center">
              Choose Your Trust Buddy
            </p>
          </div>
          {myTrust ? (
            <p className="text-[10px] font-mono text-skin-green text-center uppercase">
              Trusted: {roster[myTrust]?.personaName || myTrust}
            </p>
          ) : !canVote ? (
            <p className="text-[10px] font-mono text-skin-dim text-center uppercase">Not eligible</p>
          ) : (
            <p className="text-[10px] font-mono text-skin-dim text-center">Tap to trust</p>
          )}
          <div className="grid grid-cols-3 gap-1.5">
            {otherPlayers.map((targetId: string) => {
              const player = roster[targetId];
              const isSelected = myTrust === targetId;
              return (
                <button
                  key={`trust-${targetId}`}
                  disabled={!!myTrust || !canVote}
                  onClick={() => engine.sendVoteAction(VoteEvents.TRUST_PAIRS.TRUST, targetId)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all
                    ${isSelected
                      ? 'border-skin-green bg-skin-green/20 ring-2 ring-skin-green'
                      : 'bg-skin-deep/40 border-white/[0.06] hover:border-white/20'
                    }
                    ${(!!myTrust || !canVote) && !isSelected ? 'opacity-40 grayscale' : ''}
                  `}
                >
                  <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-green avatar-ring">
                    {player?.personaName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <span className="text-[10px] font-bold truncate w-full text-center text-skin-base">
                    {player?.personaName || targetId}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-white/10" />
          <span className="text-[10px] font-mono text-skin-dim uppercase">vs</span>
          <div className="flex-1 border-t border-white/10" />
        </div>

        {/* Section 2: Eliminate */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-skin-danger" />
            <p className="text-xs font-mono font-bold text-skin-danger uppercase text-center">
              Vote to Eliminate
            </p>
          </div>
          {myEliminate ? (
            <p className="text-[10px] font-mono text-skin-danger text-center uppercase">
              Targeting: {roster[myEliminate]?.personaName || myEliminate}
            </p>
          ) : !canVote ? (
            <p className="text-[10px] font-mono text-skin-dim text-center uppercase">Not eligible</p>
          ) : (
            <p className="text-[10px] font-mono text-skin-dim text-center">Tap to eliminate</p>
          )}
          <div className="grid grid-cols-3 gap-1.5">
            {eligibleTargets?.map((targetId: string) => {
              const player = roster[targetId];
              const isSelected = myEliminate === targetId;
              return (
                <button
                  key={`elim-${targetId}`}
                  disabled={!!myEliminate || !canVote}
                  onClick={() => engine.sendVoteAction(VoteEvents.TRUST_PAIRS.ELIMINATE, targetId)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all
                    ${isSelected
                      ? 'border-skin-danger bg-skin-danger/20 ring-2 ring-skin-danger'
                      : 'bg-skin-deep/40 border-white/[0.06] hover:border-white/20'
                    }
                    ${(!!myEliminate || !canVote) && !isSelected ? 'opacity-40 grayscale' : ''}
                  `}
                >
                  <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-danger avatar-ring">
                    {player?.personaName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <span className="text-[10px] font-bold truncate w-full text-center text-skin-base">
                    {player?.personaName || targetId}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status summary */}
        <div className="flex items-center justify-center gap-3 text-[10px] font-mono uppercase">
          <span className={`px-2 py-0.5 rounded-full ${myTrust ? 'bg-skin-green/20 text-skin-green' : 'bg-white/5 text-skin-dim'}`}>
            Trust {myTrust ? '/' : '--'}
          </span>
          <span className={`px-2 py-0.5 rounded-full ${myEliminate ? 'bg-skin-danger/20 text-skin-danger' : 'bg-white/5 text-skin-dim'}`}>
            Eliminate {myEliminate ? '/' : '--'}
          </span>
        </div>
      </div>
    </div>
  );
}
