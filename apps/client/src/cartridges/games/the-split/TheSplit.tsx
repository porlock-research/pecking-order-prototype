import React from 'react';
import type { SyncDecisionProjection, SocialPlayer } from '@pecking-order/shared-types';
import SyncDecisionWrapper from '../wrappers/SyncDecisionWrapper';
import SplitInput from './SplitInput';
import SplitRoundReveal from './SplitRoundReveal';
import SplitFinalReveal from './SplitFinalReveal';

interface TheSplitProps {
  cartridge: SyncDecisionProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function TheSplit(props: TheSplitProps) {
  const { cartridge, playerId, roster } = props;
  const currentPairing = cartridge.currentPairing as [string, string] | undefined;
  const potAmount = cartridge.potAmount as number | undefined;

  // Find opponent name for the current player
  const opponentId = currentPairing
    ? currentPairing.find((id) => id !== playerId) ?? currentPairing[0]
    : null;
  const opponentName = opponentId ? (roster[opponentId]?.personaName ?? 'opponent') : 'opponent';

  return (
    <SyncDecisionWrapper
      {...props}
      title="The Split"
      description={
        currentPairing?.includes(playerId)
          ? `You face ${opponentName}. Pot: ${potAmount ?? 0} silver. SPLIT to share, or STEAL to take it all.`
          : 'Watch as this round plays out...'
      }
      renderRoundHeader={({ cartridge: c, roster: r }) => {
        const pairing = c.currentPairing as [string, string] | undefined;
        const pot = c.potAmount as number | undefined;
        if (!pairing) return null;
        const nameA = r[pairing[0]]?.personaName ?? pairing[0];
        const nameB = r[pairing[1]]?.personaName ?? pairing[1];
        return (
          <div className="px-4 py-2 border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-skin-base">{nameA.slice(0, 10)}</span>
              <span className="text-skin-dim/40">vs</span>
              <span className="text-skin-base">{nameB.slice(0, 10)}</span>
            </div>
            <span className="text-xs font-mono font-bold text-skin-gold">{pot ?? 0} silver</span>
          </div>
        );
      }}
      renderDecisionInput={({ onSubmit, cartridge: c }) => (
        <SplitInput
          onSubmit={onSubmit}
          opponentName={opponentName}
          potAmount={(c.potAmount as number) ?? 0}
        />
      )}
      renderRoundReveal={({ decisions, roundResult, roundResults, roster: r, playerId: pid, currentRound, totalRounds }) => (
        <SplitRoundReveal
          decisions={decisions}
          roundResult={roundResult}
          roundResults={roundResults}
          roster={r}
          playerId={pid}
          currentRound={currentRound}
          totalRounds={totalRounds}
        />
      )}
      renderReveal={({ results, roster: r, playerId: pid }) => (
        <SplitFinalReveal
          results={results}
          roster={r}
          playerId={pid}
        />
      )}
    />
  );
}
