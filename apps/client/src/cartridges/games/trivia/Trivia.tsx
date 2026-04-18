import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArcadePhases, Events, CARTRIDGE_INFO } from '@pecking-order/shared-types';
import type { SocialPlayer, TriviaProjection } from '@pecking-order/shared-types';
import {
  getGameInfo,
  pickStatusLine,
  GameShell,
  GameHeader,
  GameStartCard,
  GameTimerBar,
  GameRetryDecision,
  GameResultHero,
  DifficultyBadge,
  OptionGrid,
  ResultFeedback,
} from '../shared';

interface TriviaProps {
  cartridge: TriviaProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

const RESULT_DISPLAY_MS = 2_000;
const BASE_SILVER_PER_Q = 2;
const PERFECT_BONUS_AMT = 5;

function RoundResult({
  result,
  selectedAnswer,
}: {
  result: NonNullable<TriviaProjection['lastRoundResult']>;
  selectedAnswer: number | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <DifficultyBadge category={result.category} difficulty={result.difficulty} />
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
        {result.question}
      </p>
      <OptionGrid
        options={result.options}
        selectedAnswer={selectedAnswer}
        correctIndex={result.correctIndex}
      />
      <ResultFeedback correct={result.correct} silver={result.silver} speedBonus={result.speedBonus} />
    </div>
  );
}

function TriviaScoreBreakdown({
  correctCount,
  totalRounds,
  baseSilver,
  speedBonuses,
  isPerfect,
}: {
  correctCount: number;
  totalRounds: number;
  baseSilver: number;
  speedBonuses: number;
  isPerfect: boolean;
}) {
  const row: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontFamily: 'var(--po-font-body)',
    fontSize: 13,
    color: 'var(--po-text-dim)',
  };
  return (
    <div
      style={{
        background: 'var(--po-bg-glass)',
        border: '1px solid var(--po-border)',
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={row}>
        <span>Base score</span>
        <span style={{ color: 'var(--po-text)', fontVariantNumeric: 'tabular-nums' }}>
          {correctCount} × 2 = {baseSilver} silver
        </span>
      </div>
      {speedBonuses > 0 && (
        <div style={row}>
          <span>Speed bonuses</span>
          <span style={{ color: 'var(--po-gold)', fontVariantNumeric: 'tabular-nums' }}>
            +{speedBonuses} silver
          </span>
        </div>
      )}
      {isPerfect && (
        <div style={row}>
          <span style={{ color: 'var(--po-violet)' }}>Perfect bonus</span>
          <span style={{ color: 'var(--po-violet)', fontVariantNumeric: 'tabular-nums' }}>
            +{PERFECT_BONUS_AMT} silver
          </span>
        </div>
      )}
    </div>
  );
}

export default function Trivia({ cartridge, playerId, engine, onDismiss }: TriviaProps) {
  const {
    status,
    currentRound,
    totalRounds,
    currentQuestion,
    roundDeadline,
    lastRoundResult,
    score,
    correctCount,
    silverReward,
    goldContribution,
    retryCount,
    previousResult,
    previousSilverReward,
  } = cartridge;

  const info = CARTRIDGE_INFO.TRIVIA;
  const game = getGameInfo('TRIVIA');

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showingResult, setShowingResult] = useState(false);
  const [displayedResult, setDisplayedResult] = useState<TriviaProjection['lastRoundResult']>(null);
  const prevRoundRef = useRef(currentRound);

  const [completionReady, setCompletionReady] = useState(
    status === ArcadePhases.COMPLETED && !lastRoundResult,
  );
  const [decisionReady, setDecisionReady] = useState(
    status === ArcadePhases.AWAITING_DECISION && !lastRoundResult,
  );

  useEffect(() => {
    if (lastRoundResult && currentRound !== prevRoundRef.current) {
      setDisplayedResult(lastRoundResult);
      setShowingResult(true);
      const timer = setTimeout(() => {
        setShowingResult(false);
        setDisplayedResult(null);
        setSelectedAnswer(null);
      }, RESULT_DISPLAY_MS);
      prevRoundRef.current = currentRound;
      return () => clearTimeout(timer);
    }
  }, [currentRound, lastRoundResult]);

  useEffect(() => {
    if (status === ArcadePhases.AWAITING_DECISION) {
      if (lastRoundResult && selectedAnswer !== null) {
        const timer = setTimeout(() => setDecisionReady(true), 1500);
        return () => clearTimeout(timer);
      } else {
        setDecisionReady(true);
      }
    }
  }, [status, lastRoundResult, selectedAnswer]);

  useEffect(() => {
    if (status === ArcadePhases.COMPLETED) {
      setCompletionReady(true);
    }
  }, [status]);

  useEffect(() => {
    if (status !== ArcadePhases.PLAYING || !roundDeadline || selectedAnswer !== null) return;
    const remaining = roundDeadline - Date.now();
    if (remaining <= 0) {
      engine.sendGameAction(Events.Game.event('TRIVIA', 'ANSWER'), { answerIndex: -1 });
      return;
    }
    const timer = setTimeout(() => {
      engine.sendGameAction(Events.Game.event('TRIVIA', 'ANSWER'), { answerIndex: -1 });
    }, remaining + 200);
    return () => clearTimeout(timer);
  }, [roundDeadline, status, selectedAnswer, engine]);

  const handleStart = () => engine.sendGameAction(Events.Game.start('TRIVIA'));

  const handleSubmit = useCallback(() => {
    engine.sendGameAction(Events.Game.SUBMIT);
  }, [engine]);

  const handleRetry = useCallback(() => {
    setSelectedAnswer(null);
    setShowingResult(false);
    setDisplayedResult(null);
    setCompletionReady(false);
    setDecisionReady(false);
    prevRoundRef.current = 0;
    engine.sendGameAction(Events.Game.RETRY);
  }, [engine]);

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null || showingResult) return;
    setSelectedAnswer(idx);
    engine.sendGameAction(Events.Game.event('TRIVIA', 'ANSWER'), { answerIndex: idx });
  };

  const isPerfect = correctCount === totalRounds;
  const baseSilver = correctCount * BASE_SILVER_PER_Q;
  const perfectBonus = isPerfect ? PERFECT_BONUS_AMT : 0;
  const speedBonuses = Math.max(0, score - baseSilver - perfectBonus);

  const headerStatus = status === ArcadePhases.NOT_STARTED
    ? undefined
    : status === ArcadePhases.COMPLETED
      ? `+${silverReward} silver`
      : status === ArcadePhases.AWAITING_DECISION
        ? `${totalRounds}/${totalRounds}`
        : `${currentRound}/${totalRounds}`;

  const showHeader =
    status === ArcadePhases.NOT_STARTED ||
    status === ArcadePhases.PLAYING ||
    status === ArcadePhases.AWAITING_DECISION ||
    status === ArcadePhases.COMPLETED;

  return (
    <GameShell
      accent={game.accent}
      header={
        showHeader ? (
          <GameHeader
            gameName={info?.displayName ?? 'Trivia'}
            moodSubtitle={game.moodSubtitle ?? info?.tagline}
            accent={game.accent}
            howItWorks={info?.description}
            status={headerStatus}
          />
        ) : undefined
      }
      footer={
        status === ArcadePhases.PLAYING && !showingResult && roundDeadline ? (
          <GameTimerBar deadline={roundDeadline} accent={game.accent} />
        ) : undefined
      }
    >
      {/* Loading */}
      {status === ArcadePhases.NOT_STARTED && cartridge.ready === false && (
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
          Loading questions…
        </p>
      )}

      {/* Pre-game */}
      {status === ArcadePhases.NOT_STARTED && cartridge.ready !== false && (
        <GameStartCard
          gameName={info?.displayName ?? 'Trivia'}
          tagline={`${totalRounds} questions, 15 seconds each. All ${totalRounds} right earns a perfect bonus.`}
          accent={game.accent}
          onStart={handleStart}
          ctaLabel="Start trivia"
        />
      )}

      {/* Playing */}
      {status === ArcadePhases.PLAYING && (
        <>
          {showingResult && displayedResult && (
            <RoundResult result={displayedResult} selectedAnswer={selectedAnswer} />
          )}
          {!showingResult && currentQuestion && (
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
                onSelect={handleAnswer}
              />
              {selectedAnswer !== null && (
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
        </>
      )}

      {/* Awaiting decision: feedback then retry-decision */}
      {status === ArcadePhases.AWAITING_DECISION && !decisionReady && lastRoundResult && (
        <RoundResult result={lastRoundResult} selectedAnswer={selectedAnswer} />
      )}
      {status === ArcadePhases.AWAITING_DECISION && decisionReady && (
        <GameRetryDecision
          accent={game.accent}
          status={pickStatusLine(game, silverReward, previousSilverReward ?? null)}
          silverReward={silverReward}
          previousSilverReward={previousSilverReward ?? null}
          retryCount={retryCount}
          breakdown={
            <TriviaScoreBreakdown
              correctCount={correctCount}
              totalRounds={totalRounds}
              baseSilver={baseSilver}
              speedBonuses={speedBonuses}
              isPerfect={isPerfect}
            />
          }
          onSubmit={handleSubmit}
          onRetry={handleRetry}
        />
      )}

      {/* Completed */}
      {status === ArcadePhases.COMPLETED && completionReady && (
        <GameResultHero
          accent={game.accent}
          gameName={info?.displayName ?? 'Trivia'}
          subtitle={isPerfect ? 'Perfect score' : undefined}
          silverEarned={silverReward}
          goldContribution={goldContribution}
          breakdown={
            <TriviaScoreBreakdown
              correctCount={correctCount}
              totalRounds={totalRounds}
              baseSilver={baseSilver}
              speedBonuses={speedBonuses}
              isPerfect={isPerfect}
            />
          }
          onDismiss={onDismiss}
        />
      )}
    </GameShell>
  );
}
