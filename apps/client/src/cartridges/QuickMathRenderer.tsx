import { useState, useRef, useCallback, useEffect } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';

const TIME_PER_QUESTION = 5000;
const TOTAL_QUESTIONS = 15;

type Op = '+' | '-' | '×' | '÷';

interface Question {
  a: number;
  b: number;
  op: Op;
  answer: number;
  options: number[];
}

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateQuestion(rng: () => number, difficulty: number): Question {
  // Difficulty 0-1 controls which operations and number ranges
  const ops: Op[] = difficulty < 0.3 ? ['+', '-'] : difficulty < 0.6 ? ['+', '-', '×'] : ['+', '-', '×', '÷'];
  const op = ops[Math.floor(rng() * ops.length)];

  let a: number, b: number, answer: number;
  const maxNum = Math.floor(10 + difficulty * 40);

  switch (op) {
    case '+':
      a = Math.floor(rng() * maxNum) + 1;
      b = Math.floor(rng() * maxNum) + 1;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(rng() * maxNum) + 2;
      b = Math.floor(rng() * a) + 1; // ensure positive result
      answer = a - b;
      break;
    case '×':
      a = Math.floor(rng() * Math.min(12, maxNum)) + 2;
      b = Math.floor(rng() * Math.min(12, maxNum)) + 2;
      answer = a * b;
      break;
    case '÷':
      b = Math.floor(rng() * 10) + 2;
      answer = Math.floor(rng() * 10) + 1;
      a = b * answer; // ensure clean division
      break;
    default:
      a = 1; b = 1; answer = 2;
  }

  // Generate wrong options near the answer
  const opts = new Set<number>([answer]);
  while (opts.size < 4) {
    const offset = Math.floor(rng() * 10) - 5;
    const wrong = answer + (offset === 0 ? 1 : offset);
    if (wrong >= 0) opts.add(wrong);
  }
  const options = Array.from(opts);
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return { a, b, op, answer, options };
}

export default function QuickMathRenderer({ seed, difficulty, onResult }: ArcadeRendererProps) {
  const rngRef = useRef(mulberry32(seed));
  const startTimeRef = useRef(performance.now());
  const resultSentRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(0 as any);

  const [question, setQuestion] = useState<Question>(() => generateQuestion(rngRef.current, difficulty));
  const [round, setRound] = useState(1);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [done, setDone] = useState(false);

  const sendFinalResult = useCallback((c: number, r: number, s: number) => {
    if (resultSentRef.current) return;
    resultSentRef.current = true;
    onResult({
      correctAnswers: c,
      totalRounds: r,
      streak: s,
      timeElapsed: Math.floor(performance.now() - startTimeRef.current),
    });
  }, [onResult]);

  const advance = useCallback((newCorrect: number, newRound: number, newBestStreak: number) => {
    if (newRound > TOTAL_QUESTIONS) {
      setDone(true);
      sendFinalResult(newCorrect, TOTAL_QUESTIONS, newBestStreak);
    } else {
      setQuestion(generateQuestion(rngRef.current, difficulty));
      setFeedback(null);
    }
  }, [difficulty, sendFinalResult]);

  // Auto-advance on timeout
  useEffect(() => {
    if (done || feedback) return;
    timerRef.current = setTimeout(() => {
      handleAnswer(-1);
    }, TIME_PER_QUESTION);
    return () => clearTimeout(timerRef.current);
  }, [round, done, feedback]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswer = useCallback((answer: number) => {
    if (done || feedback) return;
    clearTimeout(timerRef.current);

    const isCorrect = answer === question.answer;
    const newCorrect = isCorrect ? correct + 1 : correct;
    const newStreak = isCorrect ? streak + 1 : 0;
    const newBestStreak = Math.max(bestStreak, newStreak);
    const newRound = round + 1;

    setCorrect(newCorrect);
    setStreak(newStreak);
    setBestStreak(newBestStreak);
    setRound(newRound);
    setFeedback(isCorrect ? 'correct' : 'wrong');

    setTimeout(() => advance(newCorrect, newRound, newBestStreak), 500);
  }, [done, feedback, question, correct, streak, bestStreak, round, advance]);

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-skin-dim">
          <span className="text-skin-base font-bold">{Math.min(round, TOTAL_QUESTIONS)}</span>/{TOTAL_QUESTIONS}
        </span>
        <div className="flex items-center gap-3">
          {streak > 1 && (
            <span className="text-skin-gold animate-pulse">{streak}x</span>
          )}
          <span className="text-skin-dim">
            Correct: <span className="text-skin-gold font-bold">{correct}</span>
          </span>
        </div>
      </div>

      {!done ? (
        <>
          {/* Question */}
          <div className={`text-center py-8 rounded-xl border transition-colors duration-200
            ${feedback === 'correct' ? 'border-green-500/40 bg-green-500/5' : ''}
            ${feedback === 'wrong' ? 'border-red-500/40 bg-red-500/5' : ''}
            ${!feedback ? 'border-white/[0.08] bg-white/[0.04]' : ''}
          `}>
            <p className="text-4xl font-bold font-mono text-skin-base">
              {question.a} {question.op} {question.b} = ?
            </p>
            {feedback === 'wrong' && (
              <p className="text-xs text-red-400 mt-2">= {question.answer}</p>
            )}
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-2">
            {question.options.map((opt, i) => {
              const isCorrectAnswer = opt === question.answer;
              const showResult = !!feedback;

              let cls = 'bg-white/[0.06] border border-white/[0.08] text-skin-base hover:bg-white/[0.1] hover:border-white/[0.2]';
              if (showResult && isCorrectAnswer) {
                cls = 'bg-green-500/20 border-2 border-green-500 text-green-400';
              }

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt)}
                  disabled={!!feedback}
                  className={`py-3.5 rounded-lg font-mono font-bold text-xl transition-all active:scale-95 ${cls}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="text-center py-4 animate-fade-in">
          <p className="text-sm font-mono text-skin-dim animate-pulse">Submitting...</p>
        </div>
      )}

      <p className="text-[10px] font-mono text-skin-dim/50 text-center">
        Solve as many as you can. 5 seconds per question.
      </p>
    </div>
  );
}
