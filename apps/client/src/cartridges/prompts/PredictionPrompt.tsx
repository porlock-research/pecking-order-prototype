import React, { useState } from 'react';
import { PromptPhases, ActivityEvents, type SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import {
  PROMPT_ACCENT,
  PromptShell,
  PersonaPicker,
  LockedInReceipt,
  WinnerSpread,
  SilverEarned,
  SectionLabel,
} from './PromptShell';

interface PredictionCartridge {
  promptType: 'PREDICTION';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  responses: Record<string, string>;
  results: {
    mostPicked: { playerId: string; count: number } | null;
    consensusVoters: string[];
    silverRewards: Record<string, number>;
  } | null;
}

interface PredictionPromptProps {
  cartridge: PredictionCartridge;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function PredictionPrompt({
  cartridge,
  playerId,
  roster,
  engine,
}: PredictionPromptProps) {
  const { promptText, phase, eligibleVoters, responses, results } = cartridge;
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const hasResponded = playerId in responses;
  const respondedCount = Object.keys(responses).length;
  const totalEligible = eligibleVoters.length;
  const accent = PROMPT_ACCENT.PREDICTION;

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
      type="PREDICTION"
      accentColor={accent}
      status={status}
      statusBadge={phase === PromptPhases.ACTIVE && hasResponded ? 'Submitted' : undefined}
      promptText={promptText}
      helper={
        phase === PromptPhases.ACTIVE && !hasResponded
          ? 'Who’s it going to be? Matching the crowd earns bonus silver.'
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
          ctaLabel="Predict"
          onConfirm={handleConfirm}
        />
      )}

      {phase === PromptPhases.ACTIVE && hasResponded && (
        <LockedInReceipt
          accentColor={accent}
          label="You predicted"
          value={firstName(responses[playerId])}
        />
      )}

      {phase === PromptPhases.RESULTS && results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {results.mostPicked && (
            <WinnerSpread
              player={roster[results.mostPicked.playerId]}
              accentColor={accent}
              label="Most Predicted"
              name={firstName(results.mostPicked.playerId)}
              sublabel={`${results.mostPicked.count} ${
                results.mostPicked.count === 1 ? 'vote' : 'votes'
              }`}
            />
          )}

          {results.consensusVoters.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SectionLabel accentColor={accent}>With the crowd · +10 each</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {results.consensusVoters.map((id) => {
                  const p = roster[id];
                  const isMe = id === playerId;
                  return (
                    <span
                      key={id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px 4px 4px',
                        borderRadius: 9999,
                        background: isMe
                          ? `color-mix(in oklch, ${accent} 18%, transparent)`
                          : 'var(--po-bg-glass, rgba(255,255,255,0.04))',
                        border: `1px solid color-mix(in oklch, ${accent} ${
                          isMe ? 42 : 18
                        }%, transparent)`,
                      }}
                    >
                      <PersonaAvatar
                        avatarUrl={p?.avatarUrl}
                        personaName={p?.personaName}
                        size={22}
                      />
                      <span
                        style={{
                          fontFamily: 'var(--po-font-body)',
                          fontSize: 12,
                          fontWeight: 700,
                          color: isMe ? accent : 'var(--po-text)',
                        }}
                      >
                        {isMe ? 'You' : firstName(id)}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SectionLabel>All predictions</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(responses).map(([voterId, targetId]) => {
                const voter = roster[voterId];
                const target = roster[targetId];
                const isMe = voterId === playerId;
                return (
                  <div
                    key={voterId}
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
                    <PersonaAvatar
                      avatarUrl={voter?.avatarUrl}
                      personaName={voter?.personaName}
                      size={28}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--po-font-body)',
                        fontSize: 13,
                        fontWeight: 700,
                        color: isMe ? accent : 'var(--po-text)',
                      }}
                    >
                      {isMe ? 'You' : firstName(voterId)}
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
                    <PersonaAvatar
                      avatarUrl={target?.avatarUrl}
                      personaName={target?.personaName}
                      size={28}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--po-font-body)',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--po-text)',
                      }}
                    >
                      {firstName(targetId)}
                    </span>
                  </div>
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
