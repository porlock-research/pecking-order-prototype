import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArcadePhases, Events } from '@pecking-order/shared-types';
import type { SocialPlayer, TriviaProjection } from '@pecking-order/shared-types';
import {
  CountdownBar,
  DifficultyBadge,
  CartridgeContainer,
  CartridgeHeader,
  OptionGrid,
  ResultFeedback,
  CelebrationSequence,
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

// --- Round Result (trivia-specific layout composing shared pieces) ---

function RoundResult({
  result,
  selectedAnswer,
}: {
  result: NonNullable<TriviaProjection['lastRoundResult']>;
  selectedAnswer: number | null;
}) {
  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <DifficultyBadge category={result.category} difficulty={result.difficulty} />
      <p className="text-sm font-bold text-skin-base leading-relaxed">
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

// --- Trivia Score Breakdown (slot for CelebrationSequence) ---

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
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
      <div className="flex justify-between text-skin-dim">
        <span>Base Score</span>
        <span>{correctCount} &times; 2 = <span className="text-skin-base font-bold">{baseSilver} silver</span></span>
      </div>
      {speedBonuses > 0 && (
        <div className="flex justify-between text-skin-dim">
          <span>Speed Bonuses</span>
          <span className="text-skin-gold font-bold">+{speedBonuses} silver</span>
        </div>
      )}
      {isPerfect && (
        <div className="flex justify-between">
          <span className="text-skin-gold gold-glow">Perfect Bonus</span>
          <span className="text-skin-gold font-bold gold-glow">+{PERFECT_BONUS_AMT} silver</span>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export default function Trivia({ cartridge, playerId, roster, engine, onDismiss }: TriviaProps) {
  const { status, currentRound, totalRounds, currentQuestion, roundDeadline, lastRoundResult, score, correctCount, silverReward, goldContribution } = cartridge;

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showingResult, setShowingResult] = useState(false);
  const [displayedResult, setDisplayedResult] = useState<TriviaProjection['lastRoundResult']>(null);
  const prevRoundRef = useRef(currentRound);

  // Initialize immediately if already COMPLETED on mount (reconnect)
  const [completionReady, setCompletionReady] = useState(
    status === ArcadePhases.COMPLETED && !lastRoundResult,
  );

  // When lastRoundResult arrives mid-game (round advanced), show result briefly
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
  }, [currentRound]);

  // Completion: show last-round feedback briefly, then celebration
  useEffect(() => {
    if (status === ArcadePhases.COMPLETED) {
      if (lastRoundResult && selectedAnswer !== null) {
        const timer = setTimeout(() => setCompletionReady(true), 1500);
        return () => clearTimeout(timer);
      } else {
        setCompletionReady(true);
      }
    }
  }, [status]);

  // Auto-submit on timeout (answerIndex -1 = no answer)
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
  }, [roundDeadline, status, selectedAnswer]);

  const handleStart = () => engine.sendGameAction(Events.Game.start('TRIVIA'));

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null || showingResult) return;
    setSelectedAnswer(idx);
    engine.sendGameAction(Events.Game.event('TRIVIA', 'ANSWER'), { answerIndex: idx });
  };

  const isPerfect = correctCount === totalRounds;
  const baseSilver = correctCount * BASE_SILVER_PER_Q;
  const perfectBonus = isPerfect ? PERFECT_BONUS_AMT : 0;
  const speedBonuses = Math.max(0, score - baseSilver - perfectBonus);

  const roundInfo = status === ArcadePhases.NOT_STARTED
    ? undefined
    : status === ArcadePhases.COMPLETED
      ? `${totalRounds}/${totalRounds}`
      : `${currentRound}/${totalRounds}`;

  return (
    <CartridgeContainer>
      <CartridgeHeader
        label="Trivia"
        roundInfo={roundInfo}
        score={status !== ArcadePhases.NOT_STARTED ? score : undefined}
        showScore={status !== ArcadePhases.NOT_STARTED}
      />

      {/* LOADING: Fetching questions */}
      {status === ArcadePhases.NOT_STARTED && cartridge.ready === false && (
        <div className="p-6 text-center space-y-3">
          <span className="inline-block w-5 h-5 border-2 border-skin-gold border-t-transparent rounded-full spin-slow" />
          <p className="text-sm font-mono text-skin-dim animate-pulse">Loading questions...</p>
        </div>
      )}

      {/* PREGAME: Start Button */}
      {status === ArcadePhases.NOT_STARTED && cartridge.ready !== false && (
        <div className="p-6 space-y-4 text-center">
          <div className="space-y-2">
            <p className="text-sm font-bold text-skin-base">Daily Trivia Challenge</p>
            <p className="text-xs text-skin-dim leading-relaxed">
              {totalRounds} questions, 15 seconds each. Answer correctly and quickly for maximum silver.
              Get all {totalRounds} right for a perfect bonus!
            </p>
          </div>
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-skin-gold text-skin-inverted font-bold text-sm uppercase tracking-wider rounded-lg hover:brightness-110 active:scale-[0.97] transition-all btn-press shadow-lg"
          >
            Start Trivia
          </button>
        </div>
      )}

      {/* PLAYING: Show result overlay or current question */}
      {status === ArcadePhases.PLAYING && (
        <>
          {!showingResult && (
            <div className="px-4 pt-2">
              <CountdownBar deadline={roundDeadline} />
            </div>
          )}

          {showingResult && displayedResult && (
            <RoundResult result={displayedResult} selectedAnswer={selectedAnswer} />
          )}

          {!showingResult && currentQuestion && (
            <div className="p-4 space-y-4">
              <DifficultyBadge category={currentQuestion.category} difficulty={currentQuestion.difficulty} />
              <p className="text-sm font-bold text-skin-base leading-relaxed">
                {currentQuestion.question}
              </p>
              <OptionGrid
                options={currentQuestion.options}
                selectedAnswer={selectedAnswer}
                onSelect={handleAnswer}
              />
              {selectedAnswer !== null && (
                <p className="text-xs font-mono text-skin-dim text-center animate-fade-in">
                  Answer locked. The faster you answer, the more silver you earn.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* COMPLETED Phase 1: Last Round Feedback */}
      {status === ArcadePhases.COMPLETED && !completionReady && lastRoundResult && (
        <RoundResult result={lastRoundResult} selectedAnswer={selectedAnswer} />
      )}

      {/* COMPLETED Phase 2: Celebration Sequence */}
      {status === ArcadePhases.COMPLETED && completionReady && (
        <CelebrationSequence
          title="Trivia Complete"
          subtitle={isPerfect ? 'Perfect Score!' : undefined}
          silverEarned={silverReward}
          goldContribution={goldContribution}
          onDismiss={onDismiss}
          breakdown={
            <TriviaScoreBreakdown
              correctCount={correctCount}
              totalRounds={totalRounds}
              baseSilver={baseSilver}
              speedBonuses={speedBonuses}
              isPerfect={isPerfect}
            />
          }
        />
      )}
    </CartridgeContainer>
  );
}
