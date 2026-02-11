import React, { useState, useEffect } from 'react';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface TriviaProps {
  cartridge: {
    gameType: string;
    phase: 'WAITING' | 'QUESTION' | 'RESULT' | 'SCOREBOARD';
    currentRound: number;
    totalRounds: number;
    scores: Record<string, number>;
    currentQuestion: { question: string; options: string[] } | null;
    roundDeadline: number | null;
    lastRoundResults: {
      correctIndex: number;
      playerResults: Record<string, { correct: boolean; silver: number; speedBonus: number }>;
    } | null;
    silverRewards?: Record<string, number>;
    goldContribution?: number;
    correctCounts?: Record<string, number>;
  };
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function CountdownBar({ deadline }: { deadline: number | null }) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (!deadline) { setPct(100); return; }
    const total = 15_000;
    const tick = () => {
      const remaining = deadline - Date.now();
      setPct(Math.max(0, Math.min(100, (remaining / total) * 100)));
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [deadline]);

  return (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-100 ease-linear"
        style={{
          width: `${pct}%`,
          background: pct > 30
            ? 'linear-gradient(90deg, var(--po-gold), var(--po-gold-bright, #ffd700))'
            : 'linear-gradient(90deg, var(--po-danger, #ef4444), var(--po-pink, #f472b6))',
        }}
      />
    </div>
  );
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
    <div className="mx-4 my-2 rounded-xl bg-glass border border-white/[0.06] overflow-hidden slide-up-in shadow-card">

      {/* Header Bar */}
      <div className="px-4 py-3 bg-skin-gold/5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-skin-gold/10 border border-skin-gold/30 rounded-pill px-2.5 py-0.5 text-skin-gold uppercase tracking-widest">
            RT Trivia
          </span>
          <span className="text-xs font-mono text-skin-dim">
            Round {currentRound}/{totalRounds}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-skin-gold">
          <span className="text-skin-dim">Silver:</span>
          <span className="font-bold">{scores[playerId] || 0}</span>
        </div>
      </div>

      {/* Timer (only during active question, not during result) */}
      {phase === 'QUESTION' && (
        <div className="px-4 pt-2">
          <CountdownBar deadline={roundDeadline} />
        </div>
      )}

      {/* Question + Inline Result Phase */}
      {showQuestion && currentQuestion && (
        <div className="p-4 space-y-4">
          <p className="text-sm font-bold text-skin-base leading-relaxed">
            {currentQuestion.question}
          </p>

          <div className="grid grid-cols-1 gap-2">
            {currentQuestion.options.map((opt, idx) => {
              const isSelected = selectedAnswer === idx;
              const isCorrect = correctIdx === idx;

              // During result: highlight correct/wrong
              if (isShowingResult) {
                const isPlayerWrong = isSelected && !isCorrect;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-all
                      ${isCorrect
                        ? 'bg-skin-green/15 border-skin-green/40 text-skin-green ring-1 ring-skin-green/30'
                        : isPlayerWrong
                          ? 'bg-skin-danger/15 border-skin-danger/40 text-skin-danger'
                          : 'bg-white/[0.02] border-white/[0.04] text-skin-dim opacity-40'
                      }`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0
                      ${isCorrect
                        ? 'bg-skin-green text-skin-inverted'
                        : isPlayerWrong
                          ? 'bg-skin-danger text-skin-inverted'
                          : 'bg-white/[0.06] text-skin-dim'
                      }`}>
                      {isCorrect ? '\u2713' : isPlayerWrong ? '\u2717' : OPTION_LABELS[idx]}
                    </span>
                    <span>{opt}</span>
                  </div>
                );
              }

              // During question: interactive buttons
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={selectedAnswer !== null}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all text-sm
                    ${isSelected
                      ? 'bg-skin-gold/20 border-skin-gold/50 text-skin-gold'
                      : selectedAnswer !== null
                        ? 'bg-white/[0.02] border-white/[0.04] text-skin-dim opacity-50 cursor-default'
                        : 'bg-white/[0.03] border-white/[0.06] text-skin-base hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.98]'
                    }`}
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono shrink-0
                    ${isSelected ? 'bg-skin-gold text-skin-inverted' : 'bg-white/[0.06] text-skin-dim'}`}>
                    {OPTION_LABELS[idx]}
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Inline result feedback */}
          {isShowingResult && myResult && (
            <div className={`text-center py-2 rounded-lg animate-fade-in ${myResult.correct ? 'bg-skin-green/10' : 'bg-skin-danger/10'}`}>
              {myResult.correct ? (
                <div>
                  <span className="text-sm font-bold text-skin-green">Correct!</span>
                  <div className="flex items-center justify-center gap-2 mt-0.5">
                    <span className="text-xs font-mono text-skin-green">+{myResult.silver - myResult.speedBonus} base</span>
                    {myResult.speedBonus > 0 && (
                      <span className="text-xs font-mono text-skin-gold">+{myResult.speedBonus} speed</span>
                    )}
                    <span className="text-xs font-mono font-bold text-skin-green">= +{myResult.silver} silver</span>
                  </div>
                </div>
              ) : (
                <span className="text-sm font-bold text-skin-danger">Wrong answer</span>
              )}
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

          {/* Gold contribution */}
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

      {/* Waiting Phase */}
      {phase === 'WAITING' && (
        <div className="p-6 text-center">
          <span className="text-sm font-mono text-skin-dim animate-pulse">
            Starting trivia...
          </span>
        </div>
      )}
    </div>
  );
}
