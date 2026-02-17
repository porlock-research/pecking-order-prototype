import React, { useState } from 'react';
import type { SyncDecisionProjection, SocialPlayer } from '@pecking-order/shared-types';
import SyncDecisionWrapper from '../wrappers/SyncDecisionWrapper';

interface KingsRansomProps {
  cartridge: SyncDecisionProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function KingsRansom(props: KingsRansomProps) {
  const kingId = props.cartridge.kingId as string | undefined;
  const vaultAmount = props.cartridge.vaultAmount as number | undefined;
  const kingName = kingId ? (props.roster[kingId]?.personaName ?? 'The King') : 'The King';
  const isKing = props.playerId === kingId;

  return (
    <SyncDecisionWrapper
      {...props}
      title="King's Ransom"
      description={
        isKing
          ? `You are the King! ${vaultAmount} silver from your vault is at stake. Others will decide your fate.`
          : `${kingName} has ${vaultAmount} silver at stake. Will you STEAL the vault or PROTECT the King?`
      }
      renderDecisionInput={({ onSubmit }) => (
        <RansomInput onSubmit={onSubmit} kingName={kingName} vaultAmount={vaultAmount ?? 0} />
      )}
      renderReveal={({ decisions, results, roster, playerId }) => (
        <RansomReveal decisions={decisions} results={results} roster={roster} playerId={playerId} />
      )}
    />
  );
}

function RansomInput({
  onSubmit,
  kingName,
  vaultAmount,
}: {
  onSubmit: (d: Record<string, any>) => void;
  kingName: string;
  vaultAmount: number;
}) {
  const [confirmed, setConfirmed] = useState(false);

  const handleChoice = (action: 'STEAL' | 'PROTECT') => {
    if (confirmed) return;
    setConfirmed(true);
    onSubmit({ action });
  };

  return (
    <div className="space-y-4">
      <div className="text-center p-3 rounded-lg bg-skin-gold/5 border border-skin-gold/20">
        <p className="text-xs font-mono text-skin-dim uppercase tracking-widest">Royal Vault</p>
        <p className="text-2xl font-bold font-mono text-skin-gold">{vaultAmount} silver</p>
        <p className="text-[10px] font-mono text-skin-dim/60">belonging to {kingName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleChoice('STEAL')}
          disabled={confirmed}
          className="p-4 rounded-lg border-2 border-red-500/30 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/50 transition-all text-center space-y-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
        >
          <div className="text-2xl">&#x2694;&#xFE0F;</div>
          <div className="text-sm font-bold text-red-400 uppercase tracking-wider">Steal</div>
          <div className="text-[10px] text-skin-dim/60">Split the vault</div>
        </button>

        <button
          onClick={() => handleChoice('PROTECT')}
          disabled={confirmed}
          className="p-4 rounded-lg border-2 border-skin-green/30 bg-skin-green/5 hover:bg-skin-green/10 hover:border-skin-green/50 transition-all text-center space-y-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
        >
          <div className="text-2xl">&#x1F6E1;&#xFE0F;</div>
          <div className="text-sm font-bold text-skin-green uppercase tracking-wider">Protect</div>
          <div className="text-[10px] text-skin-dim/60">Guard the King</div>
        </button>
      </div>
    </div>
  );
}

function RansomReveal({
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
  const kingId = summary.kingId as string;
  const vaultAmount = summary.vaultAmount as number;
  const stealCount = summary.stealCount as number;
  const protectCount = summary.protectCount as number;
  const outcome = summary.outcome as 'PROTECT_WINS' | 'STEAL_WINS' | 'TIE';
  const stealers = summary.stealers as string[];
  const protectors = summary.protectors as string[];
  const shieldWinnerId = summary.shieldWinnerId as string | null;

  const kingName = roster[kingId]?.personaName ?? 'The King';

  const outcomeLabel = {
    PROTECT_WINS: 'The King is Protected!',
    STEAL_WINS: 'The Vault is Raided!',
    TIE: 'Standoff — Nobody Gains!',
  }[outcome];

  const outcomeColor = {
    PROTECT_WINS: 'text-skin-green',
    STEAL_WINS: 'text-red-400',
    TIE: 'text-skin-dim',
  }[outcome];

  return (
    <div className="p-4 space-y-4">
      {/* Outcome */}
      <div className="text-center space-y-1">
        <p className={`text-lg font-bold font-display uppercase tracking-wider ${outcomeColor}`}>
          {outcomeLabel}
        </p>
        <p className="text-xs font-mono text-skin-dim">
          {stealCount} steal vs {protectCount} protect
        </p>
      </div>

      {/* Vote Breakdown Bar */}
      <div className="flex rounded-full overflow-hidden h-6 border border-white/[0.06]">
        {stealCount > 0 && (
          <div
            className="bg-red-500/40 flex items-center justify-center text-[10px] font-mono font-bold text-red-300"
            style={{ width: `${(stealCount / (stealCount + protectCount)) * 100}%` }}
          >
            {stealCount} STEAL
          </div>
        )}
        {protectCount > 0 && (
          <div
            className="bg-skin-green/40 flex items-center justify-center text-[10px] font-mono font-bold text-green-300"
            style={{ width: `${(protectCount / (stealCount + protectCount)) * 100}%` }}
          >
            {protectCount} PROTECT
          </div>
        )}
      </div>

      {/* Player List */}
      <div className="space-y-1.5">
        {/* King */}
        <div className={`flex items-center justify-between p-2.5 rounded-lg border text-sm font-mono bg-skin-gold/5 border-skin-gold/20 ${playerId === kingId ? 'ring-1 ring-skin-gold/30' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="text-skin-gold font-bold">{kingName.slice(0, 14)}</span>
            <span className="text-[10px] bg-skin-gold/20 text-skin-gold px-1.5 rounded">KING</span>
            {shieldWinnerId === kingId && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 rounded">SHIELD</span>}
          </div>
          <span className={`font-bold ${(results.silverRewards[kingId] ?? 0) >= 0 ? 'text-skin-green' : 'text-red-400'}`}>
            {(results.silverRewards[kingId] ?? 0) >= 0 ? '+' : ''}{results.silverRewards[kingId] ?? 0}
          </span>
        </div>

        {/* Others */}
        {[...stealers, ...protectors].map((pid) => {
          const name = roster[pid]?.personaName ?? pid;
          const action = decisions[pid]?.action as string;
          const isSteal = action === 'STEAL';
          const isMe = pid === playerId;
          const reward = results.silverRewards[pid] ?? 0;

          return (
            <div
              key={pid}
              className={`flex items-center justify-between p-2 rounded-lg border text-sm font-mono ${
                isSteal
                  ? 'bg-red-500/5 border-red-500/20'
                  : 'bg-skin-green/5 border-skin-green/20'
              } ${isMe ? 'ring-1 ring-skin-gold/30' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-skin-base">{name.slice(0, 14)}</span>
                <span className={`text-[10px] px-1.5 rounded ${isSteal ? 'bg-red-500/20 text-red-400' : 'bg-skin-green/20 text-skin-green'}`}>
                  {action}
                </span>
              </div>
              <span className={`font-bold ${reward >= 0 ? 'text-skin-green' : 'text-red-400'}`}>
                {reward >= 0 ? '+' : ''}{reward}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
