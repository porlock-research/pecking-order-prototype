import React from 'react';
import type { SyncDecisionProjection, SocialPlayer } from '@pecking-order/shared-types';
import SyncDecisionWrapper from '../wrappers/SyncDecisionWrapper';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { Coins } from '../../../shells/pulse/icons';
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
  const potAmount = (cartridge.potAmount as number | undefined) ?? 0;

  const opponentId = currentPairing
    ? currentPairing.find((id) => id !== playerId) ?? currentPairing[0]
    : null;
  const opponent = opponentId ? roster[opponentId] : undefined;

  return (
    <SyncDecisionWrapper
      {...props}
      renderRoundHeader={({ cartridge: c, roster: r }) => {
        const pairing = c.currentPairing as [string, string] | undefined;
        const pot = (c.potAmount as number | undefined) ?? 0;
        if (!pairing) return null;
        return <PairingStrip aId={pairing[0]} bId={pairing[1]} pot={pot} roster={r} />;
      }}
      renderDecisionInput={({ onSubmit, cartridge: c }) => (
        <SplitInput
          onSubmit={onSubmit}
          opponent={opponent}
          potAmount={(c.potAmount as number) ?? 0}
        />
      )}
      renderRoundReveal={({ roundResult, roster: r, playerId: pid, currentRound, totalRounds }) => (
        <SplitRoundReveal
          roundResult={roundResult}
          roster={r}
          playerId={pid}
          currentRound={currentRound}
          totalRounds={totalRounds}
        />
      )}
      renderReveal={({ results, roster: r, playerId: pid }) => (
        <SplitFinalReveal results={results} roster={r} playerId={pid} />
      )}
    />
  );
}

/* Compact pairing strip — sits above the input during COLLECTING in multi-round games. */
function PairingStrip({
  aId,
  bId,
  pot,
  roster,
}: {
  aId: string;
  bId: string;
  pot: number;
  roster: Record<string, SocialPlayer>;
}) {
  const a = roster[aId];
  const b = roster[bId];
  const aName = firstName(a);
  const bName = firstName(b);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 14px',
        marginBottom: 4,
        borderRadius: 14,
        background: 'color-mix(in oklch, var(--po-text) 4%, transparent)',
        border: '1px solid color-mix(in oklch, var(--po-text) 6%, transparent)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 auto' }}>
        <PersonaAvatar avatarUrl={a?.avatarUrl} personaName={a?.personaName} size={28} />
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--po-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 80,
          }}
        >
          {aName}
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.18em',
            color: 'var(--po-text-dim)',
          }}
        >
          VS
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--po-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 80,
          }}
        >
          {bName}
        </span>
        <PersonaAvatar avatarUrl={b?.avatarUrl} personaName={b?.personaName} size={28} />
      </div>
      <div
        aria-label={`Pot of ${pot} silver`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          borderRadius: 999,
          background: 'color-mix(in oklch, var(--po-gold) 14%, transparent)',
          border: '1px solid color-mix(in oklch, var(--po-gold) 28%, transparent)',
          color: 'var(--po-gold)',
          fontFamily: 'var(--po-font-display)',
          fontSize: 12,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        <Coins size={12} weight="fill" />
        {pot}
      </div>
    </div>
  );
}

function firstName(player: SocialPlayer | undefined): string {
  if (!player?.personaName) return '?';
  return player.personaName.split(' ')[0];
}
