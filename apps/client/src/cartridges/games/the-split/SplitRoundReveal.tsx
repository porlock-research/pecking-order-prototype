import React from 'react';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface SplitRoundRevealProps {
  decisions: Record<string, any>;
  roundResult: { silverRewards: Record<string, number>; goldContribution: number; summary: Record<string, any> };
  roundResults: Array<{ silverRewards: Record<string, number>; goldContribution: number; summary: Record<string, any> }>;
  roster: Record<string, SocialPlayer>;
  playerId: string;
  currentRound: number;
  totalRounds: number;
}

export default function SplitRoundReveal({
  roundResult,
  roundResults,
  roster,
  playerId,
  currentRound,
  totalRounds,
}: SplitRoundRevealProps) {
  const { summary } = roundResult;
  const pairing = summary.pairing as [string, string];
  const potAmount = summary.potAmount as number;
  const actionA = summary.actionA as string;
  const actionB = summary.actionB as string;
  const outcome = summary.outcome as string;
  const runningTotals = summary.runningTotals as Record<string, number>;

  const [playerA, playerB] = pairing;
  const nameA = roster[playerA]?.personaName ?? playerA;
  const nameB = roster[playerB]?.personaName ?? playerB;
  const rewardA = roundResult.silverRewards[playerA] ?? 0;
  const rewardB = roundResult.silverRewards[playerB] ?? 0;

  const outcomeLabel: Record<string, string> = {
    BOTH_SPLIT: 'Both Split!',
    A_STEALS: `${nameA.slice(0, 10)} Steals!`,
    B_STEALS: `${nameB.slice(0, 10)} Steals!`,
    BOTH_STEAL: 'Both Steal!',
  };

  const outcomeColor: Record<string, string> = {
    BOTH_SPLIT: 'text-skin-green',
    A_STEALS: 'text-red-400',
    B_STEALS: 'text-red-400',
    BOTH_STEAL: 'text-skin-dim',
  };

  return (
    <div className="p-4 space-y-4">
      {/* Outcome header */}
      <div className="text-center space-y-1">
        <p className={`text-lg font-bold font-display uppercase tracking-wider ${outcomeColor[outcome] ?? 'text-skin-dim'}`}>
          {outcomeLabel[outcome] ?? outcome}
        </p>
        <p className="text-xs font-mono text-skin-dim">
          Pot: {potAmount} silver
          {roundResult.goldContribution > 0 && (
            <span className="text-skin-gold"> (+{roundResult.goldContribution} gold)</span>
          )}
        </p>
      </div>

      {/* Card reveal for both players */}
      <div className="grid grid-cols-2 gap-3">
        <PlayerCard
          name={nameA}
          action={actionA}
          reward={rewardA}
          isMe={playerA === playerId}
        />
        <PlayerCard
          name={nameB}
          action={actionB}
          reward={rewardB}
          isMe={playerB === playerId}
        />
      </div>

      {/* Running totals leaderboard */}
      {runningTotals && Object.keys(runningTotals).length > 2 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-mono text-skin-dim/60 uppercase tracking-widest text-center">Running Totals</p>
          {Object.entries(runningTotals)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([pid, total]) => {
              const name = roster[pid]?.personaName ?? pid;
              const isMe = pid === playerId;
              return (
                <div
                  key={pid}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono ${
                    isMe ? 'bg-skin-gold/5 border border-skin-gold/20' : 'bg-white/[0.02]'
                  }`}
                >
                  <span className={isMe ? 'text-skin-gold' : 'text-skin-base'}>{name.slice(0, 14)}</span>
                  <span className="text-skin-gold font-bold">{total as number}</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-skin-dim/40">
          <span>Round {currentRound + 1}</span>
          <span>{totalRounds} total</span>
        </div>
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full bg-skin-gold/40 rounded-full transition-all duration-500"
            style={{ width: `${((currentRound + 1) / totalRounds) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function PlayerCard({
  name,
  action,
  reward,
  isMe,
}: {
  name: string;
  action: string;
  reward: number;
  isMe: boolean;
}) {
  const isSplit = action === 'SPLIT';
  return (
    <div
      className={`p-3 rounded-lg border-2 text-center space-y-1 ${
        isSplit
          ? 'border-skin-green/30 bg-skin-green/5'
          : 'border-red-500/30 bg-red-500/5'
      } ${isMe ? 'ring-1 ring-skin-gold/30' : ''}`}
    >
      <p className="text-xs font-mono text-skin-base truncate">{name.slice(0, 12)}</p>
      <p className="text-2xl">{isSplit ? '\u{1F91D}' : '\u{1F48E}'}</p>
      <p className={`text-xs font-bold font-mono uppercase ${isSplit ? 'text-skin-green' : 'text-red-400'}`}>
        {action}
      </p>
      <p className={`text-sm font-bold font-mono ${reward > 0 ? 'text-skin-green' : reward < 0 ? 'text-red-400' : 'text-skin-dim/60'}`}>
        {reward > 0 ? '+' : ''}{reward}
      </p>
    </div>
  );
}
