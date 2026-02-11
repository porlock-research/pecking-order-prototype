import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface TriviaCartridge {
  gameType: 'TRIVIA';
  status: 'NOT_STARTED' | 'PLAYING' | 'COMPLETED';
  currentRound: number;
  totalRounds: number;
  currentQuestion: { question: string; options: string[] } | null;
  roundDeadline: number | null;
  lastRoundResult: {
    question: string;
    options: string[];
    correctIndex: number;
    correct: boolean;
    silver: number;
    speedBonus: number;
  } | null;
  score: number;
  correctCount: number;
  silverReward: number;
  goldContribution: number;
}

interface TriviaProps {
  cartridge: TriviaCartridge;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const RESULT_DISPLAY_MS = 2_000;
const BASE_SILVER_PER_Q = 2;
const PERFECT_BONUS_AMT = 5;

// --- Framer Motion Variants ---

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.35, delayChildren: 0.1 } },
};

const slideUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const popIn = {
  hidden: { opacity: 0, scale: 0.5 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 18 } },
};

// --- Animated Counter (ease-out cubic count-up) ---

function AnimatedCounter({ target, duration = 1500, onComplete }: { target: number; duration?: number; onComplete?: () => void }) {
  const [current, setCurrent] = useState(0);
  const startRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (target <= 0) {
      setCurrent(0);
      onComplete?.();
      return;
    }
    startRef.current = performance.now();
    doneRef.current = false;

    const step = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrent(Math.round(eased * target));
      if (t < 1) {
        requestAnimationFrame(step);
      } else if (!doneRef.current) {
        doneRef.current = true;
        onComplete?.();
      }
    };
    requestAnimationFrame(step);
  }, [target, duration, onComplete]);

  return <>{current}</>;
}

// --- Countdown Bar ---

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

// --- Result Feedback (shared between PLAYING and COMPLETED Phase 1) ---

function RoundResult({
  result,
  selectedAnswer,
}: {
  result: NonNullable<TriviaCartridge['lastRoundResult']>;
  selectedAnswer: number | null;
}) {
  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <p className="text-sm font-bold text-skin-base leading-relaxed">
        {result.question}
      </p>
      <div className="grid grid-cols-1 gap-2">
        {result.options.map((opt, idx) => {
          const isCorrect = result.correctIndex === idx;
          const isPlayerWrong = selectedAnswer === idx && !isCorrect;
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
        })}
      </div>
      <div className={`text-center py-2 rounded-lg ${result.correct ? 'bg-skin-green/10' : 'bg-skin-danger/10'}`}>
        {result.correct ? (
          <div>
            <span className="text-sm font-bold text-skin-green">Correct!</span>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              <span className="text-xs font-mono text-skin-green">+{result.silver - result.speedBonus} base</span>
              {result.speedBonus > 0 && (
                <span className="text-xs font-mono text-skin-gold">+{result.speedBonus} speed</span>
              )}
              <span className="text-xs font-mono font-bold text-skin-green">= +{result.silver} silver</span>
            </div>
          </div>
        ) : (
          <span className="text-sm font-bold text-skin-danger">Wrong answer</span>
        )}
      </div>
    </div>
  );
}

// --- Main Component ---

export default function Trivia({ cartridge, playerId, roster, engine }: TriviaProps) {
  const { status, currentRound, totalRounds, currentQuestion, roundDeadline, lastRoundResult, score, correctCount, silverReward, goldContribution } = cartridge;

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showingResult, setShowingResult] = useState(false);
  const [displayedResult, setDisplayedResult] = useState<TriviaCartridge['lastRoundResult']>(null);
  const prevRoundRef = useRef(currentRound);

  // Completion: true when celebration sequence should show
  // Initialize immediately if already COMPLETED on mount (reconnect)
  const [completionReady, setCompletionReady] = useState(
    status === 'COMPLETED' && !lastRoundResult,
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
    if (status === 'COMPLETED') {
      if (lastRoundResult && selectedAnswer !== null) {
        // Player just finished last question — show result, then celebrate
        const timer = setTimeout(() => setCompletionReady(true), 1500);
        return () => clearTimeout(timer);
      } else {
        // Reconnect or no result to show — celebrate immediately
        setCompletionReady(true);
      }
    }
  }, [status]);

  // Auto-submit on timeout (answerIndex -1 = no answer)
  useEffect(() => {
    if (status !== 'PLAYING' || !roundDeadline || selectedAnswer !== null) return;
    const remaining = roundDeadline - Date.now();
    if (remaining <= 0) {
      engine.sendGameAction('GAME.TRIVIA.ANSWER', { answerIndex: -1 });
      return;
    }
    const timer = setTimeout(() => {
      engine.sendGameAction('GAME.TRIVIA.ANSWER', { answerIndex: -1 });
    }, remaining + 200);
    return () => clearTimeout(timer);
  }, [roundDeadline, status, selectedAnswer]);

  const handleStart = () => engine.sendGameAction('GAME.TRIVIA.START');

  const handleAnswer = (idx: number) => {
    if (selectedAnswer !== null || showingResult) return;
    setSelectedAnswer(idx);
    engine.sendGameAction('GAME.TRIVIA.ANSWER', { answerIndex: idx });
  };

  const isPerfect = correctCount === totalRounds;
  const baseSilver = correctCount * BASE_SILVER_PER_Q;
  const perfectBonus = isPerfect ? PERFECT_BONUS_AMT : 0;
  const speedBonuses = Math.max(0, score - baseSilver - perfectBonus);

  const fireConfetti = useCallback(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#ffd700', '#c0c0c0', '#f472b6'],
    });
  }, []);

  return (
    <div className="mx-4 my-2 rounded-xl bg-glass border border-white/[0.06] overflow-hidden slide-up-in shadow-card">

      {/* Header Bar */}
      <div className="px-4 py-3 bg-skin-gold/5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-skin-gold/10 border border-skin-gold/30 rounded-pill px-2.5 py-0.5 text-skin-gold uppercase tracking-widest">
            Trivia
          </span>
          {status !== 'NOT_STARTED' && (
            <span className="text-xs font-mono text-skin-dim">
              {status === 'COMPLETED' ? `${totalRounds}/${totalRounds}` : `${currentRound}/${totalRounds}`}
            </span>
          )}
        </div>
        {status !== 'NOT_STARTED' && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-skin-gold">
            <span className="text-skin-dim">Silver:</span>
            <span className="font-bold">{score}</span>
          </div>
        )}
      </div>

      {/* PREGAME: Start Button */}
      {status === 'NOT_STARTED' && (
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
      {status === 'PLAYING' && (
        <>
          {/* Timer (only when not showing result) */}
          {!showingResult && (
            <div className="px-4 pt-2">
              <CountdownBar deadline={roundDeadline} />
            </div>
          )}

          {/* Result feedback (briefly shown after answering) */}
          {showingResult && displayedResult && (
            <RoundResult result={displayedResult} selectedAnswer={selectedAnswer} />
          )}

          {/* Active question */}
          {!showingResult && currentQuestion && (
            <div className="p-4 space-y-4">
              <p className="text-sm font-bold text-skin-base leading-relaxed">
                {currentQuestion.question}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = selectedAnswer === idx;
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
              {selectedAnswer !== null && (
                <p className="text-xs font-mono text-skin-dim text-center animate-fade-in">
                  Answer locked. The faster you answer, the more silver you earn.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* COMPLETED Phase 1: Last Round Feedback (1.5s then fades) */}
      {status === 'COMPLETED' && !completionReady && lastRoundResult && (
        <RoundResult result={lastRoundResult} selectedAnswer={selectedAnswer} />
      )}

      {/* COMPLETED Phase 2: Celebration Sequence */}
      {status === 'COMPLETED' && completionReady && (
        <motion.div
          className="p-5 space-y-5"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {/* Header */}
          <motion.div variants={popIn} className="text-center">
            <p className="text-lg font-bold text-skin-gold uppercase tracking-wider font-display text-glow">
              Trivia Complete
            </p>
            {isPerfect && (
              <p className="text-xs font-bold text-skin-green uppercase tracking-widest mt-1">
                Perfect Score!
              </p>
            )}
          </motion.div>

          {/* Score Breakdown */}
          <motion.div variants={slideUp}>
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
          </motion.div>

          {/* Silver Total — animated count-up */}
          <motion.div variants={slideUp} className="text-center py-2">
            <p className="text-xs font-mono text-skin-dim uppercase tracking-widest mb-1">Silver Earned</p>
            <p className="text-4xl font-bold font-mono text-skin-gold text-glow">
              +<AnimatedCounter target={silverReward} duration={1500} onComplete={fireConfetti} /> silver
            </p>
            <p className="text-xs text-skin-dim mt-1">
              {correctCount}/{totalRounds} correct
            </p>
          </motion.div>

          {/* Gold Contribution */}
          {goldContribution > 0 && (
            <motion.div variants={slideUp} className="text-center">
              <div className="inline-block px-6 py-3 rounded-lg border border-skin-gold/20 bg-skin-gold/5">
                <p className="text-2xl font-bold font-mono text-skin-gold gold-glow">
                  +{goldContribution} GOLD
                </p>
                <p className="text-xs text-skin-gold/70 mt-0.5">added to the pot</p>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
