import React, { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { ArcadePhases, Events, CARTRIDGE_INFO } from '@pecking-order/shared-types';
import type { ArcadeGameProjection, ArcadeRendererProps, SocialPlayer } from '@pecking-order/shared-types';
import {
  getGameInfo,
  pickStatusLine,
  GameShell,
  GameHeader,
  GameStartCard,
  GameCountdown,
  GameTimerBar,
  GameDeadBeat,
  GameRetryDecision,
  GameResultHero,
  GameLeaderboard,
} from '../shared';

type LocalPhase =
  | 'NOT_STARTED'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'DEAD'
  | 'AWAITING_DECISION'
  | 'COMPLETED';

interface ArcadeGameWrapperProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
  Renderer: React.ComponentType<ArcadeRendererProps>;
  renderBreakdown?: (result: Record<string, number>, silverReward: number) => ReactNode;
}

export default function ArcadeGameWrapper({
  cartridge,
  playerId,
  engine,
  onDismiss,
  Renderer,
  renderBreakdown,
}: ArcadeGameWrapperProps) {
  const { status, silverReward, goldContribution, seed, timeLimit, difficulty, gameType } = cartridge;

  const info = CARTRIDGE_INFO[gameType];
  const game = getGameInfo(gameType);
  const gameName = info?.displayName ?? gameType;
  const tagline = info?.tagline;
  const description = info?.description;

  const [gamePhase, setGamePhase] = useState<LocalPhase>(
    status === ArcadePhases.COMPLETED ? 'COMPLETED'
      : status === ArcadePhases.AWAITING_DECISION ? 'AWAITING_DECISION'
      : 'NOT_STARTED'
  );
  const [gameDeadline, setGameDeadline] = useState<number | null>(null);
  const [countdownStartedAt, setCountdownStartedAt] = useState<number | null>(null);
  const [finalResult, setFinalResult] = useState<Record<string, number>>(
    cartridge.result || {}
  );

  // Stable refs — keeps callbacks referentially stable across SYNC re-renders
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const gameTypeRef = useRef(gameType);
  gameTypeRef.current = gameType;
  const timeLimitRef = useRef(timeLimit);
  timeLimitRef.current = timeLimit;

  const handleStart = useCallback(() => {
    setCountdownStartedAt(Date.now());
    setGamePhase('COUNTDOWN');
  }, []);

  const handleCountdownComplete = useCallback(() => {
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
      const timer = setTimeout(() => setGamePhase('AWAITING_DECISION'), 1400);
      return () => clearTimeout(timer);
    }
    if (status === ArcadePhases.COMPLETED && gamePhase === 'DEAD') {
      const timer = setTimeout(() => setGamePhase('COMPLETED'), 1400);
      return () => clearTimeout(timer);
    }
    if (status === ArcadePhases.COMPLETED && gamePhase === 'NOT_STARTED') {
      setGamePhase('COMPLETED');
    }
    if (status === ArcadePhases.AWAITING_DECISION && gamePhase === 'NOT_STARTED') {
      setGamePhase('AWAITING_DECISION');
    }
  }, [status, gamePhase]);

  const headerStatus =
    gamePhase === 'COMPLETED' ? `+${silverReward} silver` : undefined;

  return (
    <GameShell
      accent={game.accent}
      header={
        gamePhase === 'COUNTDOWN' || gamePhase === 'PLAYING' || gamePhase === 'DEAD'
          ? undefined
          : (
              <GameHeader
                gameName={gameName}
                moodSubtitle={game.moodSubtitle ?? tagline}
                accent={game.accent}
                howItWorks={description}
                status={headerStatus}
              />
            )
      }
      footer={
        gamePhase === 'PLAYING' && gameDeadline ? (
          <GameTimerBar deadline={gameDeadline} totalMs={timeLimit} accent={game.accent} />
        ) : undefined
      }
    >
      {gamePhase === 'NOT_STARTED' && (
        <GameStartCard
          gameName={gameName}
          tagline={game.moodSubtitle ?? tagline}
          accent={game.accent}
          onStart={handleStart}
        />
      )}

      {gamePhase === 'COUNTDOWN' && countdownStartedAt && (
        <GameCountdown
          gameName={gameName}
          accent={game.accent}
          startedAt={countdownStartedAt}
          totalMs={3000}
          onComplete={handleCountdownComplete}
        />
      )}

      {gamePhase === 'PLAYING' && (
        <Renderer
          seed={seed}
          difficulty={difficulty}
          timeLimit={timeLimit}
          onResult={handleResult}
        />
      )}

      {gamePhase === 'DEAD' && (
        <GameDeadBeat line={game.deadBeat} accent={game.accent} />
      )}

      {gamePhase === 'AWAITING_DECISION' && (
        <GameRetryDecision
          accent={game.accent}
          status={pickStatusLine(game, silverReward, cartridge.previousSilverReward ?? null)}
          silverReward={silverReward}
          previousSilverReward={cartridge.previousSilverReward ?? null}
          retryCount={cartridge.retryCount}
          breakdown={renderBreakdown ? renderBreakdown(finalResult, silverReward) : undefined}
          onSubmit={handleSubmit}
          onRetry={handleRetry}
        />
      )}

      {gamePhase === 'COMPLETED' && (
        <>
          <GameResultHero
            accent={game.accent}
            gameName={gameName}
            silverEarned={silverReward}
            goldContribution={goldContribution}
            breakdown={renderBreakdown?.(finalResult, silverReward)}
            onDismiss={onDismiss}
          />
          {cartridge.allPlayerResults && (
            <GameLeaderboard
              allPlayerResults={cartridge.allPlayerResults}
              currentPlayerId={playerId}
              gameType={gameType}
              accent={game.accent}
            />
          )}
        </>
      )}
    </GameShell>
  );
}
