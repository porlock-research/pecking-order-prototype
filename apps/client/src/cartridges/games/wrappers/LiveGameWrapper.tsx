import React, { useState, useEffect, type ReactNode } from 'react';
import type { LiveGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import {
  CountdownBar,
  CartridgeContainer,
  CartridgeHeader,
  CelebrationSequence,
} from '../shared';

interface LiveGameWrapperProps {
  cartridge: LiveGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
  title: string;
  description: string;
  /** Event type sent when player clicks Start (solo) */
  startEvent: string;
  /** Event type sent when player clicks Ready (live) */
  readyEvent: string;
  /** Render the game-specific content during the ACTIVE phase */
  renderGame: () => ReactNode;
  /** Render breakdown for the CelebrationSequence */
  renderBreakdown?: () => ReactNode;
}

export default function LiveGameWrapper({
  cartridge,
  playerId,
  roster,
  engine,
  onDismiss,
  title,
  description,
  startEvent,
  readyEvent,
  renderGame,
  renderBreakdown,
}: LiveGameWrapperProps) {
  const phase = cartridge.phase as string;
  const isSolo = cartridge.mode === 'SOLO';
  const results = cartridge.results;
  const mySilver = results?.silverRewards[playerId] ?? 0;

  return (
    <CartridgeContainer>
      <CartridgeHeader
        label={title}
        score={phase === 'COMPLETED' ? mySilver : undefined}
        showScore={phase === 'COMPLETED'}
      />

      {/* WAITING_FOR_START (solo) — matches ArcadeGameWrapper start screen */}
      {phase === 'WAITING_FOR_START' && (
        <div className="p-6 space-y-4 text-center">
          <div className="space-y-2">
            <p className="text-sm font-bold text-skin-base">{title}</p>
            <p className="text-xs text-skin-dim leading-relaxed">{description}</p>
          </div>
          <button
            onClick={() => engine.sendGameAction(startEvent)}
            className="px-8 py-3 bg-skin-gold text-skin-inverted font-bold text-sm uppercase tracking-wider rounded-lg hover:brightness-110 active:scale-[0.97] transition-all btn-press shadow-lg"
          >
            Start
          </button>
        </div>
      )}

      {/* READY (live) — ready up + player list */}
      {phase === 'READY' && (
        <ReadyPhase
          cartridge={cartridge}
          playerId={playerId}
          roster={roster}
          readyEvent={readyEvent}
          engine={engine}
        />
      )}

      {/* COUNTDOWN — 3-2-1 */}
      {phase === 'COUNTDOWN' && (
        <CountdownPhase countdownStartedAt={cartridge.countdownStartedAt as number} />
      )}

      {/* ACTIVE — game-specific content, fully delegated to the game component */}
      {phase === 'ACTIVE' && renderGame()}

      {/* COMPLETED — CelebrationSequence */}
      {phase === 'COMPLETED' && results && (
        <CelebrationSequence
          title={`${title} Complete`}
          subtitle={!isSolo && results.shieldWinnerId
            ? `${roster[results.shieldWinnerId]?.personaName ?? 'Unknown'} earned the shield!`
            : undefined}
          silverEarned={mySilver}
          goldContribution={results.goldContribution}
          onDismiss={onDismiss}
          breakdown={renderBreakdown?.()}
        />
      )}
    </CartridgeContainer>
  );
}

// --- READY phase (live mode) ---

function ReadyPhase({
  cartridge,
  playerId,
  roster,
  readyEvent,
  engine,
}: {
  cartridge: LiveGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  readyEvent: string;
  engine: { sendGameAction: (type: string, payload?: Record<string, any>) => void };
}) {
  const readyPlayers = (cartridge.readyPlayers ?? []) as string[];
  const eligiblePlayers = (cartridge.eligiblePlayers ?? []) as string[];
  const isReady = readyPlayers.includes(playerId);

  // Approximate deadline from sync
  const readyDeadline = Date.now() + 15_000;

  return (
    <div className="p-4 space-y-4">
      <div className="text-center space-y-2">
        <p className="text-sm font-mono text-skin-dim uppercase tracking-widest">Get Ready</p>
        <p className="text-xs text-skin-dim/60">
          {readyPlayers.length} / {eligiblePlayers.length} players ready
        </p>
      </div>

      <CountdownBar deadline={readyDeadline} totalMs={15_000} />

      <button
        onClick={() => !isReady && engine.sendGameAction(readyEvent)}
        disabled={isReady}
        className={`w-full py-4 rounded-xl text-lg font-bold font-mono uppercase tracking-wider transition-all active:scale-[0.97] ${
          isReady
            ? 'bg-skin-green/20 border-2 border-skin-green/40 text-skin-green cursor-default'
            : 'bg-skin-gold/10 border-2 border-skin-gold/30 text-skin-gold hover:bg-skin-gold/20 hover:border-skin-gold/50'
        }`}
      >
        {isReady ? 'Ready!' : 'Ready Up'}
      </button>

      <div className="space-y-1.5">
        {eligiblePlayers.map((pid) => {
          const name = roster[pid]?.personaName ?? pid;
          const ready = readyPlayers.includes(pid);
          return (
            <div
              key={pid}
              className={`flex items-center justify-between p-2 rounded-lg border text-sm font-mono ${
                ready
                  ? 'bg-skin-green/5 border-skin-green/20'
                  : 'bg-white/[0.02] border-white/[0.06]'
              } ${pid === playerId ? 'ring-1 ring-skin-gold/30' : ''}`}
            >
              <span className="text-skin-base">{name.slice(0, 14)}</span>
              <span className={`text-xs ${ready ? 'text-skin-green' : 'text-skin-dim/40'}`}>
                {ready ? 'READY' : '...'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- COUNTDOWN phase ---

function CountdownPhase({ countdownStartedAt }: { countdownStartedAt: number }) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - countdownStartedAt;
      const remaining = Math.ceil((3000 - elapsed) / 1000);
      setCount(Math.max(0, remaining));
    };
    tick();
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [countdownStartedAt]);

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-[200px]">
      <p className="text-xs font-mono text-skin-dim uppercase tracking-widest mb-4">Get ready!</p>
      <div className="text-7xl font-bold font-display text-skin-gold animate-pulse">
        {count > 0 ? count : 'GO!'}
      </div>
    </div>
  );
}
