import React, { useState, useEffect, type ReactNode } from 'react';
import { SyncDecisionPhases, Events, CARTRIDGE_INFO } from '@pecking-order/shared-types';
import type { SyncDecisionProjection, SocialPlayer } from '@pecking-order/shared-types';
import {
  getGameInfo,
  GameShell,
  GameHeader,
  GameSubmissionStatus,
  GameResultHero,
} from '../shared';

interface SyncDecisionWrapperProps {
  cartridge: SyncDecisionProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
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

  const submittedIds = Object.entries(submitted)
    .filter(([, v]) => v)
    .map(([k]) => k);

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

  const info = CARTRIDGE_INFO[gameType];
  const game = getGameInfo(gameType);
  const gameName = info?.displayName ?? gameType;
  const tagline = info?.tagline;
  const description = info?.description;

  const headerStatus = isMultiRound && phase === SyncDecisionPhases.COLLECTING
    ? `Round ${currentRound + 1}/${totalRounds}`
    : isMultiRound && phase === SyncDecisionPhases.ROUND_REVEAL
      ? `Round ${currentRound + 1}/${totalRounds}`
      : undefined;

  const lastRoundResult =
    cartridge.roundResults?.[cartridge.roundResults.length - 1] ?? {
      silverRewards: {},
      goldContribution: 0,
      summary: {},
    };

  return (
    <GameShell
      accent={game.accent}
      header={
        <GameHeader
          gameName={gameName}
          moodSubtitle={game.moodSubtitle ?? tagline}
          accent={game.accent}
          howItWorks={description}
          status={headerStatus}
        />
      }
    >
      {/* Round header (multi-round only) */}
      {isMultiRound && phase === SyncDecisionPhases.COLLECTING && renderRoundHeader && (
        renderRoundHeader({ cartridge, roster, playerId })
      )}

      {/* COLLECTING: Not yet submitted (eligible) */}
      {phase === SyncDecisionPhases.COLLECTING && !showSubmitted && isEligible && (
        renderDecisionInput({ playerId, roster, cartridge, onSubmit: handleSubmit })
      )}

      {/* COLLECTING: Already submitted OR ineligible — waiting */}
      {phase === SyncDecisionPhases.COLLECTING && (showSubmitted || !isEligible) && (
        <GameSubmissionStatus
          eligibleIds={eligiblePlayers}
          submittedIds={submittedIds}
          selfId={playerId}
          roster={roster}
          accent={game.accent}
          ineligible={!isEligible}
        />
      )}

      {/* ROUND_REVEAL (multi-round only) */}
      {phase === SyncDecisionPhases.ROUND_REVEAL && isMultiRound && (
        renderRoundReveal ? (
          renderRoundReveal({
            decisions: cartridge.decisions ?? {},
            roundResult: lastRoundResult,
            roundResults: cartridge.roundResults ?? [],
            roster,
            playerId,
            currentRound,
            totalRounds,
          })
        ) : (
          renderReveal({
            decisions: cartridge.decisions ?? {},
            results: lastRoundResult as any,
            roster,
            playerId,
          })
        )
      )}

      {/* REVEAL (final) */}
      {phase === SyncDecisionPhases.REVEAL && cartridge.results && (
        <>
          {renderReveal({
            decisions: cartridge.decisions ?? {},
            results: cartridge.results,
            roster,
            playerId,
          })}
          <GameResultHero
            accent={game.accent}
            gameName={gameName}
            silverEarned={cartridge.results.silverRewards[playerId] ?? 0}
            goldContribution={cartridge.results.goldContribution}
            onDismiss={onDismiss}
          />
        </>
      )}
    </GameShell>
  );
}
