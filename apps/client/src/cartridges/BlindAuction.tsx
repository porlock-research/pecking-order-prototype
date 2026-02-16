import React, { useState } from 'react';
import type { SyncDecisionProjection, SocialPlayer } from '@pecking-order/shared-types';
import SyncDecisionWrapper from './SyncDecisionWrapper';

interface BlindAuctionProps {
  cartridge: SyncDecisionProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function BlindAuction(props: BlindAuctionProps) {
  return (
    <SyncDecisionWrapper
      {...props}
      title="Blind Auction"
      description="Three mystery prizes await. Pick a slot and place your bid. Highest bidder wins — but if you're the only one bidding on a slot, you get it for free!"
      renderDecisionInput={({ playerId, roster, cartridge, onSubmit }) => {
        const maxBid = roster[playerId]?.silver ?? 0;
        return <AuctionInput maxBid={maxBid} onSubmit={onSubmit} />;
      }}
      renderReveal={({ decisions, results, roster, playerId }) => (
        <AuctionReveal decisions={decisions} results={results} roster={roster} playerId={playerId} />
      )}
    />
  );
}

function AuctionInput({ maxBid, onSubmit }: { maxBid: number; onSubmit: (d: Record<string, any>) => void }) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [amount, setAmount] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = () => {
    if (confirmed || selectedSlot === null) return;
    setConfirmed(true);
    onSubmit({ slot: selectedSlot, amount });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((slot) => (
          <button
            key={slot}
            onClick={() => !confirmed && setSelectedSlot(slot)}
            disabled={confirmed}
            className={`p-4 rounded-lg border-2 text-center transition-all ${
              selectedSlot === slot
                ? 'border-skin-gold bg-skin-gold/10'
                : 'border-white/[0.1] bg-white/[0.03] hover:border-white/[0.2]'
            } disabled:cursor-not-allowed`}
          >
            <div className="text-2xl mb-1">?</div>
            <div className="text-[10px] font-mono text-skin-dim uppercase tracking-wider">Slot {slot}</div>
          </button>
        ))}
      </div>

      {selectedSlot !== null && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-skin-dim">Your bid for Slot {selectedSlot}</span>
            <span className="text-skin-gold font-bold text-lg">{amount} silver</span>
          </div>
          <input
            type="range"
            min={0}
            max={maxBid}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-[#ffd700]"
            disabled={confirmed}
          />
          <div className="flex justify-between text-[10px] font-mono text-skin-dim/40">
            <span>0 (free if solo)</span>
            <span>{maxBid}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={confirmed || selectedSlot === null}
        className="w-full py-3 bg-skin-gold text-skin-inverted font-bold text-sm uppercase tracking-wider rounded-lg hover:brightness-110 active:scale-[0.97] transition-all btn-press shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {confirmed ? 'Bid Locked!' : selectedSlot ? 'Place Bid' : 'Select a Slot'}
      </button>
    </div>
  );
}

const PRIZE_ICONS: Record<string, string> = {
  SILVER: 'coins',
  SHIELD: 'shield',
  CURSE_NO_DM: 'message-x',
  CURSE_HALF_VOTE: 'scale',
};

const PRIZE_COLORS: Record<string, string> = {
  SILVER: 'text-skin-gold',
  SHIELD: 'text-blue-400',
  CURSE_NO_DM: 'text-red-400',
  CURSE_HALF_VOTE: 'text-red-400',
};

function AuctionReveal({
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
  const prizes = summary.prizes as { type: string; label: string; value: number }[];
  const bids = summary.bids as Record<string, { slot: number; amount: number }>;
  const slotWinners = summary.slotWinners as Record<number, string | null>;
  const silverSpent = summary.silverSpent as number;

  return (
    <div className="p-4 space-y-4">
      {/* Prize Reveals */}
      <div className="grid grid-cols-3 gap-2">
        {prizes.map((prize, i) => {
          const slot = i + 1;
          const winnerId = slotWinners[slot];
          const winnerName = winnerId ? (roster[winnerId]?.personaName ?? winnerId).slice(0, 10) : null;
          const isCurse = prize.type.startsWith('CURSE');

          return (
            <div
              key={slot}
              className={`p-3 rounded-lg border text-center space-y-1 ${
                isCurse ? 'border-red-500/30 bg-red-500/5' : 'border-skin-gold/30 bg-skin-gold/5'
              }`}
            >
              <div className={`text-xs font-bold ${PRIZE_COLORS[prize.type] ?? 'text-skin-base'}`}>
                {prize.label}
              </div>
              {winnerName ? (
                <div className="text-[10px] font-mono text-skin-dim">
                  Won by <span className="text-skin-base font-bold">{winnerName}</span>
                </div>
              ) : (
                <div className="text-[10px] font-mono text-skin-dim/40">No bids</div>
              )}
            </div>
          );
        })}
      </div>

      {/* All Bids */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">All Bids</p>
        {Object.entries(bids).map(([pid, bid]) => {
          const name = roster[pid]?.personaName ?? pid;
          const isWinner = slotWinners[bid.slot] === pid;
          const isMe = pid === playerId;
          const reward = results.silverRewards[pid] ?? 0;

          return (
            <div
              key={pid}
              className={`flex items-center justify-between p-2 rounded-lg border text-sm font-mono ${
                isWinner
                  ? 'bg-skin-green/10 border-skin-green/30'
                  : 'bg-white/[0.03] border-white/[0.06]'
              } ${isMe ? 'ring-1 ring-skin-gold/30' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-skin-base">{name.slice(0, 12)}</span>
                <span className="text-skin-dim/40">Slot {bid.slot}</span>
                {isWinner && <span className="text-[10px] bg-skin-green/20 text-skin-green px-1.5 rounded">WON</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-skin-dim/60">bid {bid.amount}</span>
                <span className={`font-bold ${reward >= 0 ? 'text-skin-green' : 'text-red-400'}`}>
                  {reward >= 0 ? '+' : ''}{reward}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {silverSpent > 0 && (
        <div className="text-center">
          <p className="text-xs font-mono text-skin-dim/60">{silverSpent} silver converted to gold</p>
        </div>
      )}
    </div>
  );
}
