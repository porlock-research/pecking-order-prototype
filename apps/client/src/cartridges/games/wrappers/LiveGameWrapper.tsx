import React, { type ReactNode } from 'react';
import { LiveGamePhases, Config, CARTRIDGE_INFO } from '@pecking-order/shared-types';
import type { LiveGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import {
  getGameInfo,
  GameShell,
  GameHeader,
  GameStartCard,
  GameCountdown,
  GameReadyRoster,
  GameResultHero,
  GameLeaderboard,
} from '../shared';

interface LiveGameWrapperProps {
  cartridge: LiveGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
  /** Event type sent when player clicks Start (solo) */
  startEvent: string;
  /** Event type sent when player clicks Ready (live) */
  readyEvent: string;
  /** Render the game-specific content during the ACTIVE phase */
  renderGame: () => ReactNode;
  /** Render breakdown for the result hero */
  renderBreakdown?: () => ReactNode;
  /** Optional bespoke peak-frame hero shown above the silver count
   *  in the COMPLETED state. Same slot as ArcadeGameWrapper.renderHero. */
  renderHero?: () => ReactNode;
}

export default function LiveGameWrapper({
  cartridge,
  playerId,
  roster,
  engine,
  onDismiss,
  startEvent,
  readyEvent,
  renderGame,
  renderBreakdown,
  renderHero,
}: LiveGameWrapperProps) {
  const phase = cartridge.phase as string;
  const isSolo = cartridge.mode === 'SOLO';
  const results = cartridge.results;
  const mySilver = results?.silverRewards[playerId] ?? 0;
  const gameType = cartridge.gameType as string;

  const info = CARTRIDGE_INFO[gameType];
  const game = getGameInfo(gameType);
  const gameName = info?.displayName ?? gameType;
  const tagline = info?.tagline;
  const description = info?.description;

  const headerStatus =
    phase === LiveGamePhases.COMPLETED ? `+${mySilver} silver` : undefined;

  const showHeader =
    phase === LiveGamePhases.WAITING_FOR_START ||
    phase === LiveGamePhases.READY ||
    phase === LiveGamePhases.COMPLETED;

  return (
    <GameShell
      accent={game.accent}
      header={
        showHeader ? (
          <GameHeader
            gameName={gameName}
            moodSubtitle={game.moodSubtitle ?? tagline}
            accent={game.accent}
            howItWorks={description}
            status={headerStatus}
          />
        ) : undefined
      }
    >
      {phase === LiveGamePhases.WAITING_FOR_START && (
        <GameStartCard
          gameName={gameName}
          tagline={game.moodSubtitle ?? tagline}
          accent={game.accent}
          onStart={() => engine.sendGameAction(startEvent)}
        />
      )}

      {phase === LiveGamePhases.READY && (
        <GameReadyRoster
          accent={game.accent}
          eligibleIds={(cartridge.eligiblePlayers ?? []) as string[]}
          readyIds={(cartridge.readyPlayers ?? []) as string[]}
          selfId={playerId}
          roster={roster}
          deadline={Date.now() + Config.game.touchScreen.readyTimeoutMs}
          totalMs={Config.game.touchScreen.readyTimeoutMs}
          onReady={() => engine.sendGameAction(readyEvent)}
        />
      )}

      {phase === LiveGamePhases.COUNTDOWN && (
        <GameCountdown
          gameName={gameName}
          accent={game.accent}
          startedAt={cartridge.countdownStartedAt as number}
          totalMs={Config.game.touchScreen.countdownMs}
        />
      )}

      {phase === LiveGamePhases.ACTIVE && renderGame()}

      {phase === LiveGamePhases.COMPLETED && results && (
        <>
          <GameResultHero
            accent={game.accent}
            gameName={gameName}
            subtitle={!isSolo && results.shieldWinnerId
              ? `${roster[results.shieldWinnerId]?.personaName ?? 'Unknown'} earned the shield`
              : undefined}
            silverEarned={mySilver}
            goldContribution={results.goldContribution}
            bespokeHero={renderHero?.()}
            breakdown={renderBreakdown?.()}
            onDismiss={onDismiss}
          />
          {Array.isArray((results as any).leaderboard) && (
            <GameLeaderboard
              allPlayerResults={(results as any).leaderboard}
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
