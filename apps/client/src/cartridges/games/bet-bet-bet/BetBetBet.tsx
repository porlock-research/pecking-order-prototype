import React, { useState } from 'react';
import type { SyncDecisionProjection, SocialPlayer } from '@pecking-order/shared-types';
import SyncDecisionWrapper from '../wrappers/SyncDecisionWrapper';

interface BetBetBetProps {
  cartridge: SyncDecisionProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function BetBetBet(props: BetBetBetProps) {
  return (
    <SyncDecisionWrapper
      {...props}
      title="Bet Bet Bet"
      description="Everyone secretly bets silver. The 2nd-highest bettor wins the pot! But beware: the lowest bettor pays double, and ties cost 5x."
      renderDecisionInput={({ playerId, roster, onSubmit }) => {
        const maxBet = roster[playerId]?.silver ?? 1;
        return <BetInput maxBet={maxBet} onSubmit={onSubmit} />;
      }}
      renderReveal={({ decisions, results, roster, playerId }) => (
        <BetReveal decisions={decisions} results={results} roster={roster} playerId={playerId} />
      )}
    />
  );
}

function BetInput({ maxBet, onSubmit }: { maxBet: number; onSubmit: (d: Record<string, any>) => void }) {
  const [amount, setAmount] = useState(Math.max(1, Math.floor(maxBet / 2)));
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (confirmed) return;
    setConfirmed(true);
    onSubmit({ amount });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-skin-dim">Your bet</span>
          <span className="text-skin-gold font-bold text-lg">{amount} silver</span>
        </div>
        <input
          type="range"
          min={1}
          max={maxBet}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full accent-[#ffd700]"
          disabled={confirmed}
        />
        <div className="flex justify-between text-[10px] font-mono text-skin-dim/40">
          <span>1</span>
          <span>{maxBet}</span>
        </div>
      </div>

      <button
        onClick={handleConfirm}
        disabled={confirmed}
        className="w-full py-3 bg-skin-gold text-skin-inverted font-bold text-sm uppercase tracking-wider rounded-lg hover:brightness-110 active:scale-[0.97] transition-all btn-press shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {confirmed ? 'Bet Locked!' : 'Lock In Bet'}
      </button>
    </div>
  );
}

function BetReveal({
  decisions,
  results,
  roster,
  playerId,
}: {
  decisions: Record<string, any>;
  results: NonNullable<SyncDecisionProjection['results']>;
  roster: Record<string, SocialPlayer>;
  playerId: string;
}) {
  const { summary } = results;
  const bets = summary.bets as Record<string, number>;
  const winnerId = summary.winnerId as string | null;
  const lowestBettorId = summary.lowestBettorId as string | null;
  const tiedGroups = summary.tiedGroups as Record<number, string[]>;
  const shieldWinnerId = summary.shieldWinnerId as string | null;
  const potTotal = summary.potTotal as number;

  const sortedEntries = Object.entries(bets).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-4 space-y-3">
      <div className="text-center">
        <p className="text-xs font-mono text-skin-dim uppercase tracking-widest">Total Pot</p>
        <p className="text-2xl font-bold font-mono text-skin-gold">{potTotal} silver</p>
      </div>

      <div className="space-y-1.5">
        {sortedEntries.map(([pid, amount]) => {
          const name = roster[pid]?.personaName ?? pid;
          const isWinner = pid === winnerId;
          const isLowest = pid === lowestBettorId;
          const isTied = Object.values(tiedGroups).some((g: string[]) => g.includes(pid));
          const isShield = pid === shieldWinnerId;
          const reward = results.silverRewards[pid] ?? 0;
          const isMe = pid === playerId;

          return (
            <div
              key={pid}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-sm font-mono ${
                isWinner
                  ? 'bg-skin-green/10 border-skin-green/30'
                  : isLowest || isTied
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-white/[0.03] border-white/[0.06]'
              } ${isMe ? 'ring-1 ring-skin-gold/30' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={isWinner ? 'text-skin-green font-bold' : isLowest || isTied ? 'text-red-400' : 'text-skin-base'}>
                  {name.slice(0, 14)}
                </span>
                {isWinner && <span className="text-[10px] bg-skin-green/20 text-skin-green px-1.5 rounded">WINNER</span>}
                {isLowest && !isTied && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 rounded">LOWEST</span>}
                {isTied && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 rounded">TIED 5x</span>}
                {isShield && <span className="text-[10px] bg-skin-gold/20 text-skin-gold px-1.5 rounded">SHIELD</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-skin-dim/60">bet {amount}</span>
                <span className={`font-bold ${reward >= 0 ? 'text-skin-green' : 'text-red-400'}`}>
                  {reward >= 0 ? '+' : ''}{reward}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
