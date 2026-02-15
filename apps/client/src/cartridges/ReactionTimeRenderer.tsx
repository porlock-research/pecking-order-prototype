import { useState, useRef, useCallback, useEffect } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';

const TOTAL_ROUNDS = 5;
const MIN_DELAY = 1000;
const MAX_DELAY = 4000;

type Phase = 'WAITING' | 'READY' | 'GO' | 'TOO_EARLY' | 'RESULT' | 'DONE';

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function ReactionTimeRenderer({ seed, onResult }: ArcadeRendererProps) {
  const rngRef = useRef(mulberry32(seed));
  const startTimeRef = useRef(performance.now());
  const resultSentRef = useRef(false);
  const goTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(0 as any);

  const [phase, setPhase] = useState<Phase>('WAITING');
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [lastTime, setLastTime] = useState(0);

  const startRound = useCallback(() => {
    setPhase('READY');
    const delay = MIN_DELAY + rngRef.current() * (MAX_DELAY - MIN_DELAY);
    timerRef.current = setTimeout(() => {
      goTimeRef.current = performance.now();
      setPhase('GO');
    }, delay);
  }, []);

  // Start first round on mount
  useEffect(() => {
    const t = setTimeout(() => startRound(), 500);
    return () => {
      clearTimeout(t);
      clearTimeout(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendFinalResult = useCallback((allTimes: number[]) => {
    if (resultSentRef.current) return;
    resultSentRef.current = true;
    const avg = allTimes.length > 0
      ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length)
      : 9999;
    const best = allTimes.length > 0 ? Math.min(...allTimes) : 9999;
    onResult({
      avgReactionMs: avg,
      roundsCompleted: allTimes.length,
      bestReactionMs: best,
      timeElapsed: Math.floor(performance.now() - startTimeRef.current),
    });
  }, [onResult]);

  const handleTap = useCallback(() => {
    if (phase === 'READY') {
      // Too early!
      clearTimeout(timerRef.current);
      setPhase('TOO_EARLY');
      setTimeout(() => startRound(), 1500);
      return;
    }

    if (phase === 'GO') {
      const reactionMs = Math.round(performance.now() - goTimeRef.current);
      const newTimes = [...times, reactionMs];
      setTimes(newTimes);
      setLastTime(reactionMs);
      const newRound = round + 1;
      setRound(newRound);

      if (newRound >= TOTAL_ROUNDS) {
        setPhase('DONE');
        sendFinalResult(newTimes);
      } else {
        setPhase('RESULT');
        setTimeout(() => startRound(), 1200);
      }
    }
  }, [phase, times, round, startRound, sendFinalResult]);

  const avgSoFar = times.length > 0
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : null;

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-skin-dim">
          Round <span className="text-skin-base font-bold">{Math.min(round + 1, TOTAL_ROUNDS)}</span>/{TOTAL_ROUNDS}
        </span>
        {avgSoFar !== null && (
          <span className="text-skin-dim">
            Avg: <span className="text-skin-gold font-bold">{avgSoFar}ms</span>
          </span>
        )}
      </div>

      {/* Main tap area */}
      <button
        onClick={handleTap}
        disabled={phase === 'TOO_EARLY' || phase === 'RESULT' || phase === 'DONE' || phase === 'WAITING'}
        className={`
          w-full rounded-xl text-center transition-all duration-200 select-none
          ${phase === 'READY' ? 'bg-red-500/20 border-2 border-red-500/40 cursor-pointer py-16' : ''}
          ${phase === 'GO' ? 'bg-green-500/30 border-2 border-green-500/60 cursor-pointer py-16 animate-pulse' : ''}
          ${phase === 'TOO_EARLY' ? 'bg-red-500/10 border border-red-500/20 py-12' : ''}
          ${phase === 'RESULT' ? 'bg-white/[0.04] border border-white/[0.08] py-12' : ''}
          ${phase === 'WAITING' || phase === 'DONE' ? 'bg-white/[0.04] border border-white/[0.08] py-12' : ''}
        `}
      >
        {phase === 'WAITING' && (
          <p className="text-sm font-mono text-skin-dim animate-pulse">Get ready...</p>
        )}
        {phase === 'READY' && (
          <div>
            <p className="text-2xl font-bold text-red-400">WAIT...</p>
            <p className="text-xs text-red-400/60 mt-1">Don't tap yet!</p>
          </div>
        )}
        {phase === 'GO' && (
          <div>
            <p className="text-2xl font-bold text-green-400">TAP NOW!</p>
            <p className="text-xs text-green-400/60 mt-1">As fast as you can!</p>
          </div>
        )}
        {phase === 'TOO_EARLY' && (
          <div>
            <p className="text-lg font-bold text-red-400">Too early!</p>
            <p className="text-xs text-skin-dim mt-1">Wait for green...</p>
          </div>
        )}
        {phase === 'RESULT' && (
          <div>
            <p className="text-3xl font-bold font-mono text-skin-gold">{lastTime}ms</p>
            <p className="text-xs text-skin-dim mt-1">
              {lastTime < 200 ? 'Lightning!' : lastTime < 300 ? 'Great!' : lastTime < 400 ? 'Good' : 'Keep trying'}
            </p>
          </div>
        )}
        {phase === 'DONE' && (
          <p className="text-sm font-mono text-skin-dim animate-pulse">Submitting...</p>
        )}
      </button>

      {/* Round history */}
      {times.length > 0 && (
        <div className="flex justify-center gap-2">
          {times.map((t, i) => (
            <span
              key={i}
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full
                ${t < 250 ? 'bg-green-500/20 text-green-400' : t < 400 ? 'bg-skin-gold/20 text-skin-gold' : 'bg-white/[0.06] text-skin-dim'}
              `}
            >
              {t}ms
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px] font-mono text-skin-dim/50 text-center">
        Wait for green, then tap as fast as possible.
      </p>
    </div>
  );
}
