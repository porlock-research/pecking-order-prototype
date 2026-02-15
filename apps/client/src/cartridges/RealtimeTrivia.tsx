import React, { useState, useEffect } from 'react';
import type { SocialPlayer, RealtimeTriviaProjection } from '@pecking-order/shared-types';
import {
  CountdownBar,
  DifficultyBadge,
  CartridgeContainer,
  CartridgeHeader,
  OptionGrid,
  ResultFeedback,
} from './game-shared';

interface TriviaProps {
  cartridge: RealtimeTriviaProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function RealtimeTrivia({ cartridge, playerId, roster, engine }: TriviaProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const { phase, currentRound, totalRounds, scores, currentQuestion, roundDeadline, lastRoundResults, silverRewards, goldContribution, correctCounts } = cartridge;

  // Reset selection only when round advances (not on phase change within same round)
  useEffect(() => {
    setSelectedAnswer(null);
  }, [currentRound]);

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null || phase !== 'QUESTION') return;
    setSelectedAnswer(idx);
    engine.sendGameAction('GAME.REALTIME_TRIVIA.ANSWER', { answerIndex: idx });
  };

  const isShowingResult = phase === 'RESULT' && lastRoundResults != null;
  const myResult = lastRoundResults?.playerResults?.[playerId];
  const correctIdx = lastRoundResults?.correctIndex;
  const showQuestion = phase === 'QUESTION' || (isShowingResult && currentQuestion);

  const sortedScores = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([id, score]) => ({ id, score, name: roster[id]?.personaName || id }));

  return (
    <CartridgeContainer>
      <CartridgeHeader
        label="RT Trivia"
        roundInfo={`Round ${currentRound}/${totalRounds}`}
        score={scores[playerId] || 0}
      />

      {/* Timer (only during active question, not during result) */}
      {phase === 'QUESTION' && (
        <div className="px-4 pt-2">
          <CountdownBar deadline={roundDeadline} />
        </div>
      )}

      {/* Question + Inline Result Phase */}
      {showQuestion && currentQuestion && (
        <div className="p-4 space-y-4">
          <DifficultyBadge category={currentQuestion.category} difficulty={currentQuestion.difficulty} />
          <p className="text-sm font-bold text-skin-base leading-relaxed">
            {currentQuestion.question}
          </p>

          <OptionGrid
            options={currentQuestion.options}
            selectedAnswer={selectedAnswer}
            onSelect={!isShowingResult ? handleAnswer : undefined}
            correctIndex={isShowingResult ? correctIdx : undefined}
            disabled={isShowingResult}
          />

          {/* Inline result feedback */}
          {isShowingResult && myResult && (
            <div className="animate-fade-in">
              <ResultFeedback correct={myResult.correct} silver={myResult.silver} speedBonus={myResult.speedBonus} />
            </div>
          )}

          {/* Pre-answer hint */}
          {phase === 'QUESTION' && selectedAnswer !== null && !isShowingResult && (
            <p className="text-xs font-mono text-skin-dim text-center animate-fade-in">
              Answer locked. The faster you answer, the more silver you earn.
            </p>
          )}
        </div>
      )}

      {/* Scoreboard Phase (Final) */}
      {phase === 'SCOREBOARD' && (
        <div className="p-4 space-y-4 animate-fade-in">
          <p className="text-center text-sm font-bold text-skin-gold uppercase tracking-wider font-display">
            Final Scoreboard
          </p>

          {(goldContribution ?? 0) > 0 && (
            <div className="text-center text-xs font-mono text-skin-gold/70 border border-skin-gold/10 rounded-lg py-2 bg-skin-gold/5">
              +{goldContribution} gold added to the pot
            </div>
          )}

          <div className="space-y-1.5">
            {sortedScores.map((entry, rank) => {
              const reward = silverRewards?.[entry.id] ?? 0;
              const isMe = entry.id === playerId;
              const playerPerfect = (correctCounts?.[entry.id] || 0) === totalRounds;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm
                    ${isMe ? 'bg-skin-gold/10 border-skin-gold/30' : 'bg-white/[0.02] border-white/[0.04]'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono
                      ${rank === 0 ? 'bg-skin-gold text-skin-inverted' : 'bg-white/[0.06] text-skin-dim'}`}>
                      {rank + 1}
                    </span>
                    <span className="font-medium text-skin-base">
                      {entry.name}
                      {isMe && <span className="ml-1.5 text-[9px] text-skin-gold">(you)</span>}
                      {playerPerfect && <span className="ml-1.5 text-[9px] text-skin-green">PERFECT</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-skin-green">
                      +{reward} silver
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Waiting / Loading Phase */}
      {phase === 'WAITING' && (
        <div className="p-6 text-center space-y-3">
          {cartridge.ready === false ? (
            <>
              <span className="inline-block w-5 h-5 border-2 border-skin-gold border-t-transparent rounded-full spin-slow" />
              <p className="text-sm font-mono text-skin-dim animate-pulse">Loading questions...</p>
            </>
          ) : (
            <span className="text-sm font-mono text-skin-dim animate-pulse">
              Starting trivia...
            </span>
          )}
        </div>
      )}
    </CartridgeContainer>
  );
}
