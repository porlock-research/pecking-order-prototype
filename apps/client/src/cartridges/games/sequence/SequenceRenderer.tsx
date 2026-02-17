import { useState, useCallback, useRef, useEffect } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';

const STARTING_LENGTH = 3;
const DISPLAY_TIME_BASE = 2000; // ms for 3 numbers
const DISPLAY_TIME_PER_EXTRA = 400; // extra ms per additional number

// --- Seeded PRNG (Mulberry32) ---

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Phase = 'SHOWING' | 'ASKING' | 'CORRECT' | 'WRONG' | 'DONE';

export default function SequenceRenderer({ seed, difficulty, onResult }: ArcadeRendererProps) {
  const rngRef = useRef(mulberry32(seed));
  const startTimeRef = useRef(performance.now());
  const resultSentRef = useRef(false);

  const [round, setRound] = useState(1);
  const [sequence, setSequence] = useState<number[]>([]);
  const [askIndex, setAskIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('SHOWING');
  const [score, setScore] = useState(0);
  const [correctRounds, setCorrectRounds] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  const generateSequence = useCallback((length: number) => {
    const rng = rngRef.current;
    // Range scales with difficulty: base 1-9, at max difficulty 1-50
    const maxNum = Math.floor(9 + difficulty * 41);
    return Array.from({ length }, () => Math.floor(rng() * maxNum) + 1);
  }, [difficulty]);

  const sendFinalResult = useCallback((cr: number, sc: number) => {
    if (resultSentRef.current) return;
    resultSentRef.current = true;
    onResult({
      correctRounds: cr,
      score: sc,
      timeElapsed: Math.floor(performance.now() - startTimeRef.current),
    });
  }, [onResult]);

  // Start first round
  useEffect(() => {
    const seq = generateSequence(STARTING_LENGTH);
    setSequence(seq);
    setPhase('SHOWING');

    const displayTime = DISPLAY_TIME_BASE + (STARTING_LENGTH - STARTING_LENGTH) * DISPLAY_TIME_PER_EXTRA;
    const timer = setTimeout(() => {
      const rng = rngRef.current;
      setAskIndex(Math.floor(rng() * seq.length));
      setPhase('ASKING');
    }, displayTime);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startNextRound = useCallback((newRound: number, newScore: number, newCorrectRounds: number) => {
    const length = STARTING_LENGTH + newRound - 1;
    const seq = generateSequence(length);
    setSequence(seq);
    setRound(newRound);
    setScore(newScore);
    setCorrectRounds(newCorrectRounds);
    setSelectedAnswer(null);
    setPhase('SHOWING');

    const displayTime = DISPLAY_TIME_BASE + (length - STARTING_LENGTH) * DISPLAY_TIME_PER_EXTRA;
    setTimeout(() => {
      const rng = rngRef.current;
      setAskIndex(Math.floor(rng() * seq.length));
      setPhase('ASKING');
    }, displayTime);
  }, [generateSequence]);

  const handleAnswer = useCallback((answer: number) => {
    if (phase !== 'ASKING') return;
    setSelectedAnswer(answer);

    const correct = answer === sequence[askIndex];
    if (correct) {
      const roundScore = sequence.length; // points = sequence length
      setPhase('CORRECT');
      setTimeout(() => {
        startNextRound(round + 1, score + roundScore, correctRounds + 1);
      }, 1000);
    } else {
      setPhase('WRONG');
      setTimeout(() => {
        setPhase('DONE');
        sendFinalResult(correctRounds, score);
      }, 1500);
    }
  }, [phase, sequence, askIndex, round, score, correctRounds, startNextRound, sendFinalResult]);

  const handleStop = useCallback(() => {
    if (phase !== 'ASKING') return;
    setPhase('DONE');
    sendFinalResult(correctRounds, score);
  }, [phase, correctRounds, score, sendFinalResult]);

  // Generate answer options (4 choices including the correct one)
  const answerOptions = (() => {
    if (phase !== 'ASKING' && phase !== 'CORRECT' && phase !== 'WRONG') return [];
    const correct = sequence[askIndex];
    const opts = new Set<number>([correct]);
    const rng = mulberry32(seed + round * 1000 + askIndex);
    while (opts.size < 4) {
      const maxNum = Math.floor(9 + difficulty * 41);
      opts.add(Math.floor(rng() * maxNum) + 1);
    }
    // Shuffle deterministically
    const arr = Array.from(opts);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  })();

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Round / Score header */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-skin-dim">
          Round <span className="text-skin-base font-bold">{round}</span>
          <span className="text-skin-dim/50 ml-1">({STARTING_LENGTH + round - 1} numbers)</span>
        </span>
        <span className="text-skin-dim">
          Score: <span className="text-skin-gold font-bold">{score}</span>
        </span>
      </div>

      {/* SHOWING: Display the sequence */}
      {phase === 'SHOWING' && (
        <div className="text-center space-y-3 py-4">
          <p className="text-xs font-mono text-skin-dim uppercase tracking-widest animate-pulse">
            Memorize!
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            {sequence.map((num, i) => (
              <div
                key={i}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-skin-gold/10 border border-skin-gold/30 text-skin-gold font-bold font-mono text-lg animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {num}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ASKING: Which number was at position X? */}
      {(phase === 'ASKING' || phase === 'CORRECT' || phase === 'WRONG') && (
        <div className="text-center space-y-4 py-2">
          <div className="space-y-1">
            <p className="text-sm font-bold text-skin-base">
              What was number <span className="text-skin-gold">#{askIndex + 1}</span>?
            </p>
            <div className="flex justify-center gap-1.5">
              {sequence.map((_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-mono font-bold
                    ${i === askIndex
                      ? 'bg-skin-gold/20 border-2 border-skin-gold text-skin-gold'
                      : 'bg-white/[0.04] border border-white/[0.06] text-skin-dim'
                    }`}
                >
                  {i === askIndex ? '?' : '\u00B7'}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
            {answerOptions.map((opt) => {
              const isSelected = selectedAnswer === opt;
              const isCorrectAnswer = opt === sequence[askIndex];
              const showResult = phase === 'CORRECT' || phase === 'WRONG';

              let btnClass = 'bg-white/[0.06] border border-white/[0.08] text-skin-base hover:bg-skin-gold/10 hover:border-skin-gold/30';
              if (showResult && isCorrectAnswer) {
                btnClass = 'bg-skin-green/20 border-2 border-skin-green text-skin-green';
              } else if (showResult && isSelected && !isCorrectAnswer) {
                btnClass = 'bg-red-500/20 border-2 border-red-500 text-red-400';
              }

              return (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  disabled={phase !== 'ASKING'}
                  className={`py-3 rounded-lg font-mono font-bold text-lg transition-all active:scale-95 ${btnClass}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {phase === 'ASKING' && correctRounds > 0 && (
            <button
              onClick={handleStop}
              className="text-[10px] font-mono text-skin-dim/50 underline hover:text-skin-dim transition-colors"
            >
              Stop and keep {score} points
            </button>
          )}

          {phase === 'CORRECT' && (
            <p className="text-sm font-bold text-skin-green animate-fade-in">Correct! +{sequence.length} pts</p>
          )}

          {phase === 'WRONG' && (
            <p className="text-sm font-bold text-red-400 animate-fade-in">
              Wrong! It was {sequence[askIndex]}.
            </p>
          )}
        </div>
      )}

      {/* DONE */}
      {phase === 'DONE' && (
        <div className="text-center py-4 animate-fade-in">
          <p className="text-sm font-mono text-skin-dim animate-pulse">Submitting score...</p>
        </div>
      )}

      <p className="text-[10px] font-mono text-skin-dim/50 text-center">
        Memorize the sequence, then recall the highlighted position.
      </p>
    </div>
  );
}
