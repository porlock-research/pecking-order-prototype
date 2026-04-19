import { useState, useCallback, useRef, useEffect } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';

const GRID_SIZE = 10;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const BOMB_COUNT = 20;

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

function generateBombs(seed: number): Set<number> {
  const rng = mulberry32(seed);
  const bombs = new Set<number>();
  while (bombs.size < BOMB_COUNT) {
    bombs.add(Math.floor(rng() * TOTAL_CELLS));
  }
  return bombs;
}

type CellState = 'hidden' | 'safe' | 'bomb';

export default function GridPushRenderer({ seed, onResult }: ArcadeRendererProps) {
  const [bombs] = useState(() => generateBombs(seed));
  const [cells, setCells] = useState<CellState[]>(() => Array(TOTAL_CELLS).fill('hidden'));
  const [currentRun, setCurrentRun] = useState(0);
  const [currentRunLength, setCurrentRunLength] = useState(0);
  const [bankedTotal, setBankedTotal] = useState(0);
  const [longestRun, setLongestRun] = useState(0);
  const [totalFlips, setTotalFlips] = useState(0);
  const [busted, setBusted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const resultSentRef = useRef(false);
  const startTimeRef = useRef(performance.now());

  const sendFinalResult = useCallback((banked: number, longest: number, flips: number) => {
    if (resultSentRef.current) return;
    resultSentRef.current = true;
    onResult({
      bankedTotal: banked,
      longestRun: longest,
      totalFlips: flips,
      timeElapsed: Math.floor(performance.now() - startTimeRef.current),
    });
  }, [onResult]);

  const handleFlip = useCallback((index: number) => {
    if (gameOver || busted || cells[index] !== 'hidden') return;

    const isBomb = bombs.has(index);
    const newCells = [...cells];
    newCells[index] = isBomb ? 'bomb' : 'safe';
    setCells(newCells);

    const newTotalFlips = totalFlips + 1;
    setTotalFlips(newTotalFlips);

    if (isBomb) {
      // Bust — lose current run
      setBusted(true);
      setCurrentRun(0);
      setCurrentRunLength(0);

      // Brief delay then allow continuing (or end if all non-bomb tiles flipped)
      setTimeout(() => {
        setBusted(false);
        // Check if all safe tiles have been revealed
        const safeRevealed = newCells.filter(c => c === 'safe').length;
        if (safeRevealed >= TOTAL_CELLS - BOMB_COUNT) {
          setGameOver(true);
          sendFinalResult(bankedTotal, longestRun, newTotalFlips);
        }
      }, 800);
    } else {
      // Safe — add to current run (score = run position: 1st flip = 1, 2nd = 2, etc.)
      const newRunLength = currentRunLength + 1;
      const runScore = currentRun + newRunLength;
      setCurrentRunLength(newRunLength);
      setCurrentRun(runScore);
      setLongestRun(prev => Math.max(prev, newRunLength));

      // Check if all safe tiles revealed
      const safeRevealed = newCells.filter(c => c === 'safe').length;
      if (safeRevealed >= TOTAL_CELLS - BOMB_COUNT) {
        // Auto-bank and end
        const finalBanked = bankedTotal + runScore;
        setBankedTotal(finalBanked);
        setCurrentRun(0);
        setCurrentRunLength(0);
        setGameOver(true);
        sendFinalResult(finalBanked, Math.max(longestRun, newRunLength), newTotalFlips);
      }
    }
  }, [gameOver, busted, cells, bombs, totalFlips, currentRun, currentRunLength, bankedTotal, longestRun, sendFinalResult]);

  const handleBank = useCallback(() => {
    if (gameOver || busted || currentRun === 0) return;
    setBankedTotal(prev => prev + currentRun);
    setCurrentRun(0);
    setCurrentRunLength(0);
  }, [gameOver, busted, currentRun]);

  const handleCashOut = useCallback(() => {
    if (gameOver) return;
    const finalBanked = bankedTotal + currentRun;
    setBankedTotal(finalBanked);
    setCurrentRun(0);
    setCurrentRunLength(0);
    setGameOver(true);
    sendFinalResult(finalBanked, longestRun, totalFlips);
  }, [gameOver, bankedTotal, currentRun, longestRun, totalFlips, sendFinalResult]);

  // Auto-end on time limit (safety net — wrapper also has countdown)
  useEffect(() => {
    // Time limit handled by arcade wrapper's countdown; this is just cleanup
    return () => {};
  }, []);

  const hiddenCount = cells.filter(c => c === 'hidden').length;
  const safeRemaining = TOTAL_CELLS - BOMB_COUNT - cells.filter(c => c === 'safe').length;

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Score bar */}
      <div className="flex items-center justify-between text-xs ">
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--po-text-dim)' }}>
            Banked: <span className="text-[var(--po-gold)] font-bold">{bankedTotal}</span>
          </span>
          {currentRun > 0 && (
            <span className="text-[var(--po-green)] animate-pulse">
              Run: +{currentRun}
            </span>
          )}
        </div>
        <span style={{ color: 'var(--po-text-dim)' }}>
          {safeRemaining} safe / {hiddenCount} hidden
        </span>
      </div>

      {/* Grid */}
      <div
        className="grid gap-0.5 mx-auto"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          maxWidth: '320px',
        }}
      >
        {cells.map((state, i) => (
          <button
            key={i}
            onClick={() => handleFlip(i)}
            disabled={state !== 'hidden' || busted || gameOver}
            className={`
              aspect-square rounded-sm text-[10px] font-bold transition-all duration-150
              ${state === 'hidden'
                ? 'bg-[color-mix(in_oklch,var(--po-text)_8%,transparent)] border border-[color-mix(in_oklch,var(--po-text)_10%,transparent)] hover:bg-[var(--po-gold)]/10 hover:border-[var(--po-gold)]/30 active:scale-90 cursor-pointer'
                : state === 'safe'
                  ? 'bg-[var(--po-green)]/20 border border-[var(--po-green)]/30'
                  : 'bg-red-500/20 border border-red-500/40 animate-shake'
              }
              ${busted || gameOver ? 'pointer-events-none' : ''}
            `}
          >
            {state === 'safe' && <span style={{ color: 'var(--po-green)' }}>&#10003;</span>}
            {state === 'bomb' && <span className="text-red-400">&#10008;</span>}
          </button>
        ))}
      </div>

      {/* Bust overlay */}
      {busted && (
        <div className="text-center py-2 animate-fade-in">
          <p className="text-sm font-bold text-red-400">BOOM! Run lost.</p>
          <p className="text-[10px] text-[var(--po-text-dim)] mt-0.5">Resuming...</p>
        </div>
      )}

      {/* Action buttons */}
      {!gameOver && !busted && (
        <div className="flex gap-2">
          <button
            onClick={handleBank}
            disabled={currentRun === 0}
            className={`
              flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all
              ${currentRun > 0
                ? 'bg-[var(--po-gold)]/20 border border-[var(--po-gold)]/40 text-[var(--po-gold)] hover:bg-[var(--po-gold)]/30 active:scale-[0.97]'
                : 'bg-[var(--po-bg-glass)] border border-[var(--po-border)] text-[var(--po-text-dim)] cursor-not-allowed'
              }
            `}
          >
            Bank {currentRun > 0 ? `+${currentRun}` : ''}
          </button>
          <button
            onClick={handleCashOut}
            className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg bg-[color-mix(in_oklch,var(--po-text)_8%,transparent)] border border-[color-mix(in_oklch,var(--po-text)_10%,transparent)] text-[var(--po-text-dim)] hover:bg-[color-mix(in_oklch,var(--po-text)_12%,transparent)] hover:text-[var(--po-text)] transition-all active:scale-[0.97]"
          >
            Cash Out
          </button>
        </div>
      )}

      <p className="text-[10px]  text-[var(--po-text-dim)]/50 text-center">
        Flip tiles to score. Bank to lock in points. Hit a bomb = lose current run.
      </p>
    </div>
  );
}
