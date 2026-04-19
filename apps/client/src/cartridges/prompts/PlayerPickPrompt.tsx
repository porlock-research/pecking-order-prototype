import React, { useState } from 'react';
import { PromptPhases, ActivityEvents, type SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { Heart } from 'lucide-react';
import {
  PROMPT_ACCENT,
  PromptShell,
  PersonaPicker,
  LockedInReceipt,
  WinnerSpread,
  SilverEarned,
  SectionLabel,
} from './PromptShell';

interface PlayerPickCartridge {
  promptType: 'PLAYER_PICK';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  responses: Record<string, string>;
  results: {
    mostPicked: { playerId: string; count: number } | null;
    mutualPicks: Array<[string, string]>;
    silverRewards: Record<string, number>;
  } | null;
}

interface PlayerPickPromptProps {
  cartridge: PlayerPickCartridge;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function PlayerPickPrompt({
  cartridge,
  playerId,
  roster,
  engine,
}: PlayerPickPromptProps) {
  const { promptText, phase, eligibleVoters, responses, results } = cartridge;
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const hasResponded = playerId in responses;
  const respondedCount = Object.keys(responses).length;
  const totalEligible = eligibleVoters.length;
  const accent = PROMPT_ACCENT.PLAYER_PICK;

  const name = (id: string) => roster[id]?.personaName || id;
  const firstName = (id: string) => name(id).split(' ')[0];

  const handleConfirm = () => {
    if (!selectedTarget || hasResponded || phase !== PromptPhases.ACTIVE) return;
    engine.sendActivityAction(ActivityEvents.PROMPT.SUBMIT, { targetId: selectedTarget });
  };

  const targets = eligibleVoters.filter((id) => id !== playerId);

  const status =
    phase === PromptPhases.RESULTS
      ? 'Results'
      : respondedCount === totalEligible
        ? 'All in'
        : `${respondedCount}/${totalEligible} in`;

  return (
    <PromptShell
      type="PLAYER_PICK"
      accentColor={accent}
      status={status}
      statusBadge={phase === PromptPhases.ACTIVE && hasResponded ? 'Submitted' : undefined}
      promptText={promptText}
      helper={
        phase === PromptPhases.ACTIVE && !hasResponded
          ? 'Tap a face to pick. Mutual picks earn +10 silver each.'
          : undefined
      }
      eligibleIds={phase === PromptPhases.ACTIVE ? eligibleVoters : undefined}
      respondedIds={phase === PromptPhases.ACTIVE ? Object.keys(responses) : undefined}
      roster={roster}
    >
      {phase === PromptPhases.ACTIVE && !hasResponded && (
        <PersonaPicker
          candidates={targets}
          roster={roster}
          accentColor={accent}
          selectedId={selectedTarget}
          onSelect={setSelectedTarget}
          ctaLabel="Pick"
          onConfirm={handleConfirm}
        />
      )}

      {phase === PromptPhases.ACTIVE && hasResponded && (
        <LockedInReceipt
          accentColor={accent}
          label="You picked"
          value={firstName(responses[playerId])}
        />
      )}

      {phase === PromptPhases.RESULTS && results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {results.mostPicked && (
            <WinnerSpread
              player={roster[results.mostPicked.playerId]}
              accentColor={accent}
              label="Most Picked"
              name={firstName(results.mostPicked.playerId)}
              sublabel={`${results.mostPicked.count} ${
                results.mostPicked.count === 1 ? 'pick' : 'picks'
              }`}
            />
          )}

          {results.mutualPicks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SectionLabel accentColor="var(--po-pink)">Mutual picks · +10 each</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.mutualPicks.map(([a, b], idx) => {
                  const isMe = a === playerId || b === playerId;
                  return (
                    <MutualPickRow
                      key={idx}
                      playerA={roster[a]}
                      playerB={roster[b]}
                      nameA={firstName(a)}
                      nameB={firstName(b)}
                      isMe={isMe}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionLabel>All picks</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(responses).map(([pickerId, targetId]) => {
                const picker = roster[pickerId];
                const target = roster[targetId];
                const isMe = pickerId === playerId;
                return (
                  <PickRow
                    key={pickerId}
                    picker={picker}
                    target={target}
                    nameFrom={isMe ? 'You' : firstName(pickerId)}
                    nameTo={firstName(targetId)}
                    accent={accent}
                    isMe={isMe}
                  />
                );
              })}
            </div>
          </div>

          <SilverEarned amount={results.silverRewards[playerId] ?? 0} />
        </div>
      )}
    </PromptShell>
  );
}

function MutualPickRow({
  playerA,
  playerB,
  nameA,
  nameB,
  isMe,
}: {
  playerA?: SocialPlayer;
  playerB?: SocialPlayer;
  nameA: string;
  nameB: string;
  isMe: boolean;
}) {
  const bg = isMe
    ? 'color-mix(in oklch, var(--po-pink) 12%, transparent)'
    : 'var(--po-bg-glass, rgba(255,255,255,0.03))';
  const border = isMe
    ? '1.5px solid color-mix(in oklch, var(--po-pink) 38%, transparent)'
    : '1px solid var(--po-border, rgba(255,255,255,0.05))';
  const accent = 'var(--po-pink)';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 12,
        background: bg,
        border,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <PersonaAvatar avatarUrl={playerA?.avatarUrl} personaName={playerA?.personaName} size={32} />
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--po-text)',
          }}
        >
          {nameA}
        </span>
      </div>
      <Heart size={14} strokeWidth={2.5} color={accent} fill={accent} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--po-text)',
          }}
        >
          {nameB}
        </span>
        <PersonaAvatar avatarUrl={playerB?.avatarUrl} personaName={playerB?.personaName} size={32} />
      </div>
    </div>
  );
}

function PickRow({
  picker,
  target,
  nameFrom,
  nameTo,
  accent,
  isMe,
}: {
  picker?: SocialPlayer;
  target?: SocialPlayer;
  nameFrom: string;
  nameTo: string;
  accent: string;
  isMe: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 10px',
        borderRadius: 10,
        background: isMe
          ? `color-mix(in oklch, ${accent} 10%, transparent)`
          : 'transparent',
        border: isMe
          ? `1px solid color-mix(in oklch, ${accent} 26%, transparent)`
          : '1px solid transparent',
      }}
    >
      <PersonaAvatar avatarUrl={picker?.avatarUrl} personaName={picker?.personaName} size={28} />
      <span
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 13,
          fontWeight: 700,
          color: isMe ? accent : 'var(--po-text)',
        }}
      >
        {nameFrom}
      </span>
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 13,
          color: 'var(--po-text-dim)',
          margin: '0 2px',
        }}
      >
        →
      </span>
      <PersonaAvatar avatarUrl={target?.avatarUrl} personaName={target?.personaName} size={28} />
      <span
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--po-text)',
        }}
      >
        {nameTo}
      </span>
    </div>
  );
}
