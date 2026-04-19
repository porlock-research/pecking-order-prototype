import React, { useState, useEffect } from 'react';
import { RealtimeTriviaPhases, Events, CARTRIDGE_INFO } from '@pecking-order/shared-types';
import type { SocialPlayer, RealtimeTriviaProjection } from '@pecking-order/shared-types';
import {
  getGameInfo,
  GameShell,
  GameHeader,
  GameTimerBar,
  GameLeaderboard,
  DifficultyBadge,
  OptionGrid,
  ResultFeedback,
} from '../shared';

interface TriviaProps {
  cartridge: RealtimeTriviaProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function RealtimeTrivia({ cartridge, playerId, engine }: TriviaProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const {
    phase,
    currentRound,
    totalRounds,
    scores,
    currentQuestion,
    roundDeadline,
    lastRoundResults,
    silverRewards,
    goldContribution,
    correctCounts,
  } = cartridge;

  useEffect(() => {
    setSelectedAnswer(null);
  }, [currentRound]);

  const info = CARTRIDGE_INFO.REALTIME_TRIVIA;
  const game = getGameInfo('REALTIME_TRIVIA');

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null || phase !== RealtimeTriviaPhases.QUESTION) return;
    setSelectedAnswer(idx);
    engine.sendGameAction(Events.Game.event('REALTIME_TRIVIA', 'ANSWER'), { answerIndex: idx });
  };

  const isShowingResult = phase === RealtimeTriviaPhases.RESULT && lastRoundResults != null;
  const myResult = lastRoundResults?.playerResults?.[playerId];
  const correctIdx = lastRoundResults?.correctIndex;
  const showQuestion = phase === RealtimeTriviaPhases.QUESTION || (isShowingResult && currentQuestion);

  const headerStatus =
    phase === RealtimeTriviaPhases.SCOREBOARD
      ? `+${silverRewards?.[playerId] ?? 0} silver`
      : `Round ${currentRound}/${totalRounds}`;

  // Build leaderboard payload from final scoreboard data
  const leaderboardEntries = phase === RealtimeTriviaPhases.SCOREBOARD
    ? Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .map(([id, score]) => ({
          playerId: id,
          silverReward: silverRewards?.[id] ?? 0,
          result: { score, correctCount: correctCounts?.[id] ?? 0 },
        }))
    : [];

  return (
    <GameShell
      accent={game.accent}
      header={
        <GameHeader
          gameName={info?.displayName ?? 'Live Trivia'}
          moodSubtitle={game.moodSubtitle ?? info?.tagline}
          accent={game.accent}
          howItWorks={info?.description}
          status={headerStatus}
        />
      }
      footer={
        phase === RealtimeTriviaPhases.QUESTION && roundDeadline ? (
          <GameTimerBar deadline={roundDeadline} accent={game.accent} />
        ) : undefined
      }
    >
      {showQuestion && currentQuestion && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <DifficultyBadge category={currentQuestion.category} difficulty={currentQuestion.difficulty} />
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--po-font-display)',
              fontSize: 'clamp(17px, 4.5vw, 20px)',
              fontWeight: 600,
              lineHeight: 1.3,
              letterSpacing: -0.2,
              color: 'var(--po-text)',
            }}
          >
            {currentQuestion.question}
          </p>
          <OptionGrid
            options={currentQuestion.options}
            selectedAnswer={selectedAnswer}
            onSelect={!isShowingResult ? handleAnswer : undefined}
            correctIndex={isShowingResult ? correctIdx : undefined}
            disabled={isShowingResult}
          />
          {isShowingResult && myResult && (
            <ResultFeedback correct={myResult.correct} silver={myResult.silver} speedBonus={myResult.speedBonus} />
          )}
          {phase === RealtimeTriviaPhases.QUESTION && selectedAnswer !== null && !isShowingResult && (
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--po-font-body)',
                fontSize: 12,
                color: 'var(--po-text-dim)',
                textAlign: 'center',
              }}
            >
              Locked. Faster answers earn more silver.
            </p>
          )}
        </div>
      )}

      {phase === RealtimeTriviaPhases.SCOREBOARD && (
        <>
          {(goldContribution ?? 0) > 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '8px 12px',
                borderRadius: 12,
                background: 'color-mix(in oklch, var(--po-gold) 10%, transparent)',
                border: '1px solid color-mix(in oklch, var(--po-gold) 24%, transparent)',
                fontFamily: 'var(--po-font-display)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--po-gold)',
                letterSpacing: 0.04,
              }}
            >
              +{goldContribution} gold added to the pot
            </div>
          )}
          <GameLeaderboard
            allPlayerResults={leaderboardEntries}
            currentPlayerId={playerId}
            gameType="REALTIME_TRIVIA"
            accent={game.accent}
          />
        </>
      )}

      {phase === RealtimeTriviaPhases.WAITING && (
        <p
          style={{
            margin: 0,
            padding: '32px 16px',
            textAlign: 'center',
            fontFamily: 'var(--po-font-display)',
            fontSize: 14,
            color: 'var(--po-text-dim)',
          }}
        >
          {cartridge.ready === false ? 'Loading questions…' : 'Starting trivia…'}
        </p>
      )}
    </GameShell>
  );
}
