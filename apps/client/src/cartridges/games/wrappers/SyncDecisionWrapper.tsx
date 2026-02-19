import React, { useState, useEffect, type ReactNode } from 'react';
import { SyncDecisionPhases, Events } from '@pecking-order/shared-types';
import type { SyncDecisionProjection, SocialPlayer } from '@pecking-order/shared-types';
import {
  CartridgeContainer,
  CartridgeHeader,
  CelebrationSequence,
} from '../shared';

interface SyncDecisionWrapperProps {
  cartridge: SyncDecisionProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
  title: string;
  description: string;
  renderDecisionInput: (props: {
    playerId: string;
    roster: Record<string, SocialPlayer>;
    cartridge: SyncDecisionProjection;
    onSubmit: (decision: Record<string, any>) => void;
  }) => ReactNode;
  renderReveal: (props: {
    decisions: Record<string, any>;
    results: NonNullable<SyncDecisionProjection['results']>;
    roster: Record<string, SocialPlayer>;
    playerId: string;
  }) => ReactNode;
  /** Optional: render round-specific header (e.g. pairing info, pot amount) */
  renderRoundHeader?: (props: {
    cartridge: SyncDecisionProjection;
    roster: Record<string, SocialPlayer>;
    playerId: string;
  }) => ReactNode;
  /** Optional: render round reveal (defaults to renderReveal with round result) */
  renderRoundReveal?: (props: {
    decisions: Record<string, any>;
    roundResult: { silverRewards: Record<string, number>; goldContribution: number; summary: Record<string, any> };
    roundResults: Array<{ silverRewards: Record<string, number>; goldContribution: number; summary: Record<string, any> }>;
    roster: Record<string, SocialPlayer>;
    playerId: string;
    currentRound: number;
    totalRounds: number;
  }) => ReactNode;
}

export default function SyncDecisionWrapper({
  cartridge,
  playerId,
  roster,
  engine,
  onDismiss,
  title,
  description,
  renderDecisionInput,
  renderReveal,
  renderRoundHeader,
  renderRoundReveal,
}: SyncDecisionWrapperProps) {
  const { phase, submitted, eligiblePlayers, gameType } = cartridge;
  const hasSubmitted = submitted[playerId] ?? false;
  const isEligible = eligiblePlayers.includes(playerId);
  const [localSubmitted, setLocalSubmitted] = useState(false);
  const [lastSeenRound, setLastSeenRound] = useState(cartridge.currentRound ?? 0);

  const isMultiRound = (cartridge.totalRounds ?? 1) > 1;
  const currentRound = cartridge.currentRound ?? 0;
  const totalRounds = cartridge.totalRounds ?? 1;

  const submittedCount = Object.values(submitted).filter(Boolean).length;
  const totalEligible = eligiblePlayers.length;

  // Reset localSubmitted when round changes (multi-round)
  useEffect(() => {
    if (isMultiRound && currentRound !== lastSeenRound) {
      setLocalSubmitted(false);
      setLastSeenRound(currentRound);
    }
  }, [currentRound, lastSeenRound, isMultiRound]);

  const handleSubmit = (decision: Record<string, any>) => {
    engine.sendGameAction(Events.Game.event(gameType, 'SUBMIT'), decision);
    setLocalSubmitted(true);
  };

  const showSubmitted = hasSubmitted || localSubmitted;

  // Build round info string
  let roundInfo: string | undefined;
  if (isMultiRound && phase === SyncDecisionPhases.COLLECTING) {
    roundInfo = `Round ${currentRound + 1}/${totalRounds} \u00B7 ${submittedCount}/${totalEligible} submitted`;
  } else if (phase === SyncDecisionPhases.COLLECTING) {
    roundInfo = `${submittedCount}/${totalEligible} submitted`;
  } else if (isMultiRound && phase === SyncDecisionPhases.ROUND_REVEAL) {
    roundInfo = `Round ${currentRound + 1}/${totalRounds}`;
  }

  return (
    <CartridgeContainer>
      <CartridgeHeader
        label={title}
        roundInfo={roundInfo}
      />

      {/* Round header (multi-round only) */}
      {isMultiRound && phase === SyncDecisionPhases.COLLECTING && renderRoundHeader && (
        renderRoundHeader({ cartridge, roster, playerId })
      )}

      {/* COLLECTING: Not yet submitted */}
      {phase === SyncDecisionPhases.COLLECTING && !showSubmitted && isEligible && (
        <div className="p-4 space-y-4">
          <p className="text-xs text-skin-dim leading-relaxed text-center">{description}</p>
          {renderDecisionInput({ playerId, roster, cartridge, onSubmit: handleSubmit })}
        </div>
      )}

      {/* COLLECTING: Already submitted — waiting */}
      {phase === SyncDecisionPhases.COLLECTING && (showSubmitted || !isEligible) && (
        <div className="p-6 text-center space-y-4">
          <div className="space-y-2">
            <span className="inline-block w-5 h-5 border-2 border-skin-gold border-t-transparent rounded-full spin-slow" />
            <p className="text-sm font-mono text-skin-dim">
              {!isEligible ? 'Watching...' : 'Decision locked in!'}
            </p>
            <p className="text-xs text-skin-dim/60">
              Waiting for others ({submittedCount}/{totalEligible})
            </p>
          </div>

          {/* Submission status */}
          <div className="flex flex-wrap justify-center gap-2">
            {eligiblePlayers.map((pid) => {
              const name = roster[pid]?.personaName ?? pid;
              const done = submitted[pid];
              return (
                <span
                  key={pid}
                  className={`px-2 py-1 rounded-full text-[10px] font-mono tracking-wider border ${
                    done
                      ? 'bg-skin-green/10 border-skin-green/30 text-skin-green'
                      : 'bg-white/[0.03] border-white/[0.06] text-skin-dim/40'
                  }`}
                >
                  {name.slice(0, 12)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ROUND_REVEAL (multi-round only) */}
      {phase === SyncDecisionPhases.ROUND_REVEAL && isMultiRound && (
        <div className="space-y-0">
          {renderRoundReveal ? (
            renderRoundReveal({
              decisions: cartridge.decisions ?? {},
              roundResult: cartridge.roundResults?.[cartridge.roundResults.length - 1] ?? { silverRewards: {}, goldContribution: 0, summary: {} },
              roundResults: cartridge.roundResults ?? [],
              roster,
              playerId,
              currentRound,
              totalRounds,
            })
          ) : (
            // Fallback: use renderReveal with the latest round result
            cartridge.roundResults?.[cartridge.roundResults.length - 1] && renderReveal({
              decisions: cartridge.decisions ?? {},
              results: cartridge.roundResults[cartridge.roundResults.length - 1] as any,
              roster,
              playerId,
            })
          )}
        </div>
      )}

      {/* REVEAL (final) */}
      {phase === SyncDecisionPhases.REVEAL && cartridge.results && (
        <div className="space-y-0">
          {renderReveal({
            decisions: cartridge.decisions ?? {},
            results: cartridge.results,
            roster,
            playerId,
          })}

          <CelebrationSequence
            title={`${title} Results`}
            silverEarned={cartridge.results.silverRewards[playerId] ?? 0}
            goldContribution={cartridge.results.goldContribution}
            onDismiss={onDismiss}
          />
        </div>
      )}
    </CartridgeContainer>
  );
}
