import { useState, useRef, useCallback, useEffect } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';

const PADS = [
  { id: 0, color: '#ef4444', activeColor: '#f87171', label: 'Red' },
  { id: 1, color: '#3b82f6', activeColor: '#60a5fa', label: 'Blue' },
  { id: 2, color: '#22c55e', activeColor: '#4ade80', label: 'Green' },
  { id: 3, color: '#eab308', activeColor: '#facc15', label: 'Yellow' },
];

const FLASH_DURATION = 500;
const FLASH_GAP = 200;
const INPUT_TIMEOUT = 3000;

type Phase = 'SHOWING' | 'INPUT' | 'CORRECT' | 'WRONG' | 'DONE';

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function SimonSaysRenderer({ seed, onResult }: ArcadeRendererProps) {
  const rngRef = useRef(mulberry32(seed));
  const startTimeRef = useRef(performance.now());
  const resultSentRef = useRef(false);
  const inputTimerRef = useRef<ReturnType<typeof setTimeout>>(0 as any);

  const [sequence, setSequence] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('SHOWING');
  const [activePad, setActivePad] = useState<number | null>(null);
  const [inputIndex, setInputIndex] = useState(0);
  const [round, setRound] = useState(0);

  const sendFinalResult = useCallback((rounds: number) => {
    if (resultSentRef.current) return;
    resultSentRef.current = true;
    onResult({
      roundsCompleted: rounds,
      longestSequence: rounds + 1, // sequence length = round + 1 (starts at 1)
      timeElapsed: Math.floor(performance.now() - startTimeRef.current),
    });
  }, [onResult]);

  const playSequence = useCallback((seq: number[]) => {
    setPhase('SHOWING');
    setActivePad(null);

    let i = 0;
    const show = () => {
      if (i >= seq.length) {
        setActivePad(null);
        setTimeout(() => {
          setPhase('INPUT');
          setInputIndex(0);
        }, FLASH_GAP);
        return;
      }
      setActivePad(seq[i]);
      setTimeout(() => {
        setActivePad(null);
        i++;
        setTimeout(show, FLASH_GAP);
      }, FLASH_DURATION);
    };

    setTimeout(show, 400);
  }, []);

  // Start first round
  useEffect(() => {
    const firstPad = Math.floor(rngRef.current() * 4);
    const initialSeq = [firstPad];
    setSequence(initialSeq);
    playSequence(initialSeq);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Input timeout
  useEffect(() => {
    if (phase !== 'INPUT') return;
    inputTimerRef.current = setTimeout(() => {
      // Timeout = wrong
      setPhase('WRONG');
      setTimeout(() => {
        setPhase('DONE');
        sendFinalResult(round);
      }, 1200);
    }, INPUT_TIMEOUT);
    return () => clearTimeout(inputTimerRef.current);
  }, [phase, inputIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePadPress = useCallback((padId: number) => {
    if (phase !== 'INPUT') return;
    clearTimeout(inputTimerRef.current);

    // Flash the pad briefly
    setActivePad(padId);
    setTimeout(() => setActivePad(null), 150);

    if (padId !== sequence[inputIndex]) {
      // Wrong!
      setPhase('WRONG');
      setTimeout(() => {
        setPhase('DONE');
        sendFinalResult(round);
      }, 1200);
      return;
    }

    const nextIndex = inputIndex + 1;
    if (nextIndex >= sequence.length) {
      // Completed this round!
      const newRound = round + 1;
      setRound(newRound);
      setPhase('CORRECT');

      setTimeout(() => {
        const nextPad = Math.floor(rngRef.current() * 4);
        const newSeq = [...sequence, nextPad];
        setSequence(newSeq);
        playSequence(newSeq);
      }, 800);
    } else {
      setInputIndex(nextIndex);
    }
  }, [phase, sequence, inputIndex, round, playSequence, sendFinalResult]);

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-skin-dim">
          Round <span className="text-skin-base font-bold">{round + 1}</span>
          <span className="text-skin-dim/50 ml-1">({sequence.length} in sequence)</span>
        </span>
        {phase === 'INPUT' && (
          <span className="text-skin-gold">
            {inputIndex}/{sequence.length}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="text-center text-xs font-mono h-5">
        {phase === 'SHOWING' && <span className="text-skin-dim animate-pulse">Watch the pattern...</span>}
        {phase === 'INPUT' && <span className="text-skin-gold">Your turn! Repeat the pattern.</span>}
        {phase === 'CORRECT' && <span className="text-green-400 animate-fade-in">Correct!</span>}
        {phase === 'WRONG' && <span className="text-red-400 animate-fade-in">Wrong!</span>}
        {phase === 'DONE' && <span className="text-skin-dim animate-pulse">Submitting...</span>}
      </div>

      {/* Pads */}
      <div className="grid grid-cols-2 gap-3 max-w-[240px] mx-auto">
        {PADS.map((pad) => {
          const isActive = activePad === pad.id;
          const isClickable = phase === 'INPUT';

          return (
            <button
              key={pad.id}
              onClick={() => handlePadPress(pad.id)}
              disabled={!isClickable}
              className="aspect-square rounded-2xl transition-all duration-100 active:scale-95 border-2"
              style={{
                backgroundColor: isActive ? pad.activeColor : `${pad.color}33`,
                borderColor: isActive ? pad.activeColor : `${pad.color}66`,
                boxShadow: isActive ? `0 0 20px ${pad.color}66` : 'none',
                opacity: phase === 'SHOWING' && !isActive ? 0.4 : 1,
                cursor: isClickable ? 'pointer' : 'default',
              }}
            />
          );
        })}
      </div>

      <p className="text-[10px] font-mono text-skin-dim/50 text-center">
        Watch the pattern, then repeat it. Sequence grows each round.
      </p>
    </div>
  );
}
