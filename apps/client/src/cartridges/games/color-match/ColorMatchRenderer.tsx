import { useState, useRef, useCallback, useEffect } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';

const TOTAL_ROUNDS = 20;
const TIME_PER_ROUND = 3000;

const COLORS = [
  { name: 'RED', hex: '#ef4444' },
  { name: 'BLUE', hex: '#3b82f6' },
  { name: 'GREEN', hex: '#22c55e' },
  { name: 'YELLOW', hex: '#eab308' },
  { name: 'PURPLE', hex: '#a855f7' },
  { name: 'ORANGE', hex: '#f97316' },
];

interface RoundData {
  word: string;    // text displayed (a color name)
  inkColor: string; // actual CSS color it's painted in
  inkName: string;  // name of the ink color (correct answer)
  options: string[]; // 4 color names to choose from
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

function generateRound(rng: () => number): RoundData {
  // Pick a word (what the text says)
  const wordIdx = Math.floor(rng() * COLORS.length);
  // Pick a DIFFERENT ink color
  let inkIdx = Math.floor(rng() * COLORS.length);
  while (inkIdx === wordIdx) {
    inkIdx = Math.floor(rng() * COLORS.length);
  }

  const word = COLORS[wordIdx].name;
  const inkColor = COLORS[inkIdx].hex;
  const inkName = COLORS[inkIdx].name;

  // Build 4 options including the correct answer
  const opts = new Set<string>([inkName]);
  // Always include the word (the trap answer)
  opts.add(word);
  while (opts.size < 4) {
    opts.add(COLORS[Math.floor(rng() * COLORS.length)].name);
  }
  // Shuffle
  const options = Array.from(opts);
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return { word, inkColor, inkName, options };
}

export default function ColorMatchRenderer({ seed, onResult }: ArcadeRendererProps) {
  const rngRef = useRef(mulberry32(seed));
  const startTimeRef = useRef(performance.now());
  const resultSentRef = useRef(false);
  const roundTimerRef = useRef<ReturnType<typeof setTimeout>>(0 as any);

  const [roundData, setRoundData] = useState<RoundData>(() => generateRound(rngRef.current));
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

  // Auto-advance if player doesn't answer in time
  useEffect(() => {
    if (done || feedback) return;
    roundTimerRef.current = setTimeout(() => {
      handleAnswer('__TIMEOUT__');
    }, TIME_PER_ROUND);
    return () => clearTimeout(roundTimerRef.current);
  }, [round, done, feedback]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswer = useCallback((answer: string) => {
    if (done || feedback) return;
    clearTimeout(roundTimerRef.current);

    const isCorrect = answer === roundData.inkName;
    const newCorrect = isCorrect ? correct + 1 : correct;
    const newStreak = isCorrect ? streak + 1 : 0;
    const newBestStreak = Math.max(bestStreak, newStreak);

    setCorrect(newCorrect);
    setStreak(newStreak);
    setBestStreak(newBestStreak);
    setFeedback(isCorrect ? 'correct' : 'wrong');

    setTimeout(() => {
      if (round >= TOTAL_ROUNDS) {
        setDone(true);
        sendFinalResult(newCorrect, round, newBestStreak);
      } else {
        setRound(r => r + 1);
        setRoundData(generateRound(rngRef.current));
        setFeedback(null);
      }
    }, 600);
  }, [done, feedback, roundData, correct, streak, bestStreak, round, sendFinalResult]);

  const colorHex = (name: string) => COLORS.find(c => c.name === name)?.hex ?? '#fff';

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-skin-dim">
          Round <span className="text-skin-base font-bold">{round}</span>/{TOTAL_ROUNDS}
        </span>
        <div className="flex items-center gap-3">
          {streak > 1 && (
            <span className="text-skin-gold animate-pulse">{streak}x streak</span>
          )}
          <span className="text-skin-dim">
            Correct: <span className="text-skin-gold font-bold">{correct}</span>
          </span>
        </div>
      </div>

      {!done ? (
        <>
          {/* The word display */}
          <div className={`text-center py-6 rounded-xl bg-white/[0.04] border transition-colors duration-200
            ${feedback === 'correct' ? 'border-green-500/40 bg-green-500/5' : ''}
            ${feedback === 'wrong' ? 'border-red-500/40 bg-red-500/5' : ''}
            ${!feedback ? 'border-white/[0.08]' : ''}
          `}>
            <p className="text-xs font-mono text-skin-dim/50 uppercase tracking-widest mb-2">
              What COLOR is this word?
            </p>
            <p
              className="text-4xl font-black font-display tracking-wider"
              style={{ color: roundData.inkColor }}
            >
              {roundData.word}
            </p>
          </div>

          {/* Answer buttons */}
          <div className="grid grid-cols-2 gap-2">
            {roundData.options.map((opt) => (
              <button
                key={opt}
                onClick={() => handleAnswer(opt)}
                disabled={!!feedback}
                className="py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95
                  bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.1]"
                style={{ color: colorHex(opt) }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-4 animate-fade-in">
          <p className="text-sm font-mono text-skin-dim animate-pulse">Submitting...</p>
        </div>
      )}

      <p className="text-[10px] font-mono text-skin-dim/50 text-center">
        Tap the COLOR the word is painted in, not what it says.
      </p>
    </div>
  );
}
