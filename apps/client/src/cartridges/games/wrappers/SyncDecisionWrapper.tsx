import React, { useState, type ReactNode } from 'react';
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
}: SyncDecisionWrapperProps) {
  const { phase, submitted, eligiblePlayers, gameType } = cartridge;
  const hasSubmitted = submitted[playerId] ?? false;
  const isEligible = eligiblePlayers.includes(playerId);
  const [localSubmitted, setLocalSubmitted] = useState(false);

  const submittedCount = Object.values(submitted).filter(Boolean).length;
  const totalEligible = eligiblePlayers.length;

  const handleSubmit = (decision: Record<string, any>) => {
    engine.sendGameAction(Events.Game.event(gameType, 'SUBMIT'), decision);
    setLocalSubmitted(true);
  };

  const showSubmitted = hasSubmitted || localSubmitted;

  return (
    <CartridgeContainer>
      <CartridgeHeader
        label={title}
        roundInfo={phase === SyncDecisionPhases.COLLECTING ? `${submittedCount}/${totalEligible} submitted` : undefined}
      />

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

      {/* REVEAL */}
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
