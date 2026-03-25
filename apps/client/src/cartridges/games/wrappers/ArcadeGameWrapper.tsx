import React, { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { ArcadePhases, Events } from '@pecking-order/shared-types';
import type { ArcadeGameProjection, ArcadeRendererProps, SocialPlayer } from '@pecking-order/shared-types';
import {
  CountdownBar,
  CartridgeContainer,
  CartridgeHeader,
  CelebrationSequence,
  RetryDecisionScreen,
} from '../shared';

interface ArcadeGameWrapperProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
  title: string;
  description: string;
  Renderer: React.ComponentType<ArcadeRendererProps>;
  renderBreakdown?: (result: Record<string, number>, silverReward: number) => ReactNode;
}

export default function ArcadeGameWrapper({
  cartridge,
  engine,
  onDismiss,
  title,
  description,
  Renderer,
  renderBreakdown,
}: ArcadeGameWrapperProps) {
  const { status, silverReward, goldContribution, seed, timeLimit, difficulty, gameType } = cartridge;

  const [gamePhase, setGamePhase] = useState<'NOT_STARTED' | 'PLAYING' | 'DEAD' | 'AWAITING_DECISION' | 'COMPLETED'>(
    status === ArcadePhases.COMPLETED ? 'COMPLETED'
      : status === ArcadePhases.AWAITING_DECISION ? 'AWAITING_DECISION'
      : 'NOT_STARTED'
  );
  const [gameDeadline, setGameDeadline] = useState<number | null>(null);
  const [finalResult, setFinalResult] = useState<Record<string, number>>(
    cartridge.result || {}
  );

  // Stable refs — keeps callbacks referentially stable across SYNC re-renders
  // so child Renderers' game loops never re-initialize mid-play
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const gameTypeRef = useRef(gameType);
  gameTypeRef.current = gameType;
  const timeLimitRef = useRef(timeLimit);
  timeLimitRef.current = timeLimit;

  const handleStart = useCallback(() => {
    engineRef.current.sendGameAction(Events.Game.start(gameTypeRef.current));
    setGamePhase('PLAYING');
    setGameDeadline(Date.now() + timeLimitRef.current);
  }, []);

  const handleResult = useCallback((result: Record<string, number>) => {
    setFinalResult(result);
    setGamePhase('DEAD');
    engineRef.current.sendGameAction(Events.Game.result(gameTypeRef.current), result);
  }, []);

  const handleSubmit = useCallback(() => {
    engineRef.current.sendGameAction(Events.Game.SUBMIT);
    setGamePhase('COMPLETED');
  }, []);

  const handleRetry = useCallback(() => {
    engineRef.current.sendGameAction(Events.Game.RETRY);
    setGamePhase('NOT_STARTED');
    setGameDeadline(null);
  }, []);

  // Transition from DEAD -> AWAITING_DECISION or COMPLETED when server confirms
  useEffect(() => {
    if (status === ArcadePhases.AWAITING_DECISION && gamePhase === 'DEAD') {
      const timer = setTimeout(() => setGamePhase('AWAITING_DECISION'), 1200);
      return () => clearTimeout(timer);
    }
    if (status === ArcadePhases.COMPLETED && gamePhase === 'DEAD') {
      const timer = setTimeout(() => setGamePhase('COMPLETED'), 1200);
      return () => clearTimeout(timer);
    }
    if (status === ArcadePhases.COMPLETED && gamePhase === 'NOT_STARTED') {
      setGamePhase('COMPLETED');
    }
    if (status === ArcadePhases.AWAITING_DECISION && gamePhase === 'NOT_STARTED') {
      setGamePhase('AWAITING_DECISION');
    }
  }, [status, gamePhase]);

  return (
    <CartridgeContainer>
      <CartridgeHeader
        label={title}
        score={gamePhase === 'COMPLETED' ? silverReward : undefined}
        showScore={gamePhase === 'COMPLETED'}
      />

      {gamePhase === 'PLAYING' && gameDeadline && (
        <div className="px-4 pt-2">
          <CountdownBar deadline={gameDeadline} totalMs={timeLimit} />
        </div>
      )}

      {/* NOT_STARTED: Start Screen */}
      {gamePhase === 'NOT_STARTED' && (
        <div className="p-6 space-y-4 text-center">
          <div className="space-y-2">
            <p className="text-sm font-bold text-skin-base">{title}</p>
            <p className="text-xs text-skin-dim leading-relaxed">{description}</p>
          </div>
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-skin-gold text-skin-inverted font-bold text-sm uppercase tracking-wider rounded-lg hover:brightness-110 active:scale-[0.97] transition-all btn-press shadow-lg"
          >
            Start
          </button>
        </div>
      )}

      {/* PLAYING: Renderer */}
      {gamePhase === 'PLAYING' && (
        <Renderer
          seed={seed}
          difficulty={difficulty}
          timeLimit={timeLimit}
          onResult={handleResult}
        />
      )}

      {/* DEAD: Brief game-over overlay */}
      {gamePhase === 'DEAD' && (
        <div className="p-6 text-center space-y-3 animate-fade-in">
          <p className="text-sm font-mono text-skin-dim animate-pulse">Calculating score...</p>
        </div>
      )}

      {/* AWAITING_DECISION: Retry or Submit */}
      {gamePhase === 'AWAITING_DECISION' && (
        <RetryDecisionScreen
          result={finalResult}
          silverReward={silverReward}
          goldReward={cartridge.goldReward}
          previousResult={cartridge.previousResult}
          previousSilverReward={cartridge.previousSilverReward}
          retryCount={cartridge.retryCount}
          onSubmit={handleSubmit}
          onRetry={handleRetry}
          renderBreakdown={renderBreakdown ? (r) => renderBreakdown(r, silverReward) : undefined}
        />
      )}

      {/* COMPLETED: Celebration */}
      {gamePhase === 'COMPLETED' && (
        <CelebrationSequence
          title={`${title} Complete`}
          silverEarned={silverReward}
          goldContribution={goldContribution}
          onDismiss={onDismiss}
          breakdown={renderBreakdown?.(finalResult, silverReward)}
        />
      )}
    </CartridgeContainer>
  );
}
