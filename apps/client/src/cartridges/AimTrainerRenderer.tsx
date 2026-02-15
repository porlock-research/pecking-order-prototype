import { useState, useRef, useCallback, useEffect } from 'react';
import type { ArcadeRendererProps } from '@pecking-order/shared-types';

const GAME_DURATION = 30_000; // 30 seconds of gameplay
const TARGET_LIFETIME = 2000; // ms before target vanishes
const MAX_RADIUS = 30;
const MIN_RADIUS = 8;
const SHRINK_RATE = (MAX_RADIUS - MIN_RADIUS) / TARGET_LIFETIME;
const AREA_WIDTH = 320;
const AREA_HEIGHT = 280;
const SPAWN_INTERVAL = 800;

interface Target {
  id: number;
  x: number;
  y: number;
  spawnedAt: number;
  radius: number;
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

export default function AimTrainerRenderer({ seed, difficulty, onResult }: ArcadeRendererProps) {
  const rngRef = useRef(mulberry32(seed));
  const startTimeRef = useRef(performance.now());
  const resultSentRef = useRef(false);

  const [targets, setTargets] = useState<Target[]>([]);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [totalSpawned, setTotalSpawned] = useState(0);
  const [misses, setMisses] = useState(0);
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const nextIdRef = useRef(0);

  const sendFinalResult = useCallback((h: number, total: number, s: number) => {
    if (resultSentRef.current) return;
    resultSentRef.current = true;
    onResult({
      targetsHit: h,
      totalTargets: total,
      score: s,
      timeElapsed: Math.floor(performance.now() - startTimeRef.current),
    });
  }, [onResult]);

  // Spawn targets periodically
  useEffect(() => {
    if (done) return;
    const spawnRate = Math.max(400, SPAWN_INTERVAL - difficulty * 300);

    const interval = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      if (elapsed >= GAME_DURATION) {
        setDone(true);
        return;
      }

      const rng = rngRef.current;
      const padding = MAX_RADIUS + 5;
      const x = padding + rng() * (AREA_WIDTH - padding * 2);
      const y = padding + rng() * (AREA_HEIGHT - padding * 2);
      const id = nextIdRef.current++;

      setTargets(prev => [...prev, { id, x, y, spawnedAt: performance.now(), radius: MAX_RADIUS }]);
      setTotalSpawned(prev => prev + 1);
    }, spawnRate);

    return () => clearInterval(interval);
  }, [done, difficulty]);

  // Update targets (shrink + expire) and timer
  useEffect(() => {
    if (done) return;
    const tick = setInterval(() => {
      const now = performance.now();
      const elapsed = now - startTimeRef.current;
      setTimeLeft(Math.max(0, GAME_DURATION - elapsed));

      if (elapsed >= GAME_DURATION) {
        setDone(true);
        clearInterval(tick);
        return;
      }

      setTargets(prev => {
        const alive = prev.filter(t => now - t.spawnedAt < TARGET_LIFETIME);
        // Count expired as misses
        const expired = prev.length - alive.length;
        if (expired > 0) {
          setMisses(m => m + expired);
        }
        return alive.map(t => ({
          ...t,
          radius: MAX_RADIUS - SHRINK_RATE * (now - t.spawnedAt),
        }));
      });
    }, 50);

    return () => clearInterval(tick);
  }, [done]);

  // End game
  useEffect(() => {
    if (!done) return;
    // Use timeout to let final state settle
    const t = setTimeout(() => {
      sendFinalResult(hits, totalSpawned, score);
    }, 200);
    return () => clearTimeout(t);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleHit = useCallback((targetId: number) => {
    if (done) return;
    setTargets(prev => {
      const target = prev.find(t => t.id === targetId);
      if (!target) return prev;

      // Smaller target = more points (1-5 based on current radius)
      const sizeFraction = target.radius / MAX_RADIUS;
      const points = Math.max(1, Math.ceil(5 * (1 - sizeFraction) + 1));

      setScore(s => s + points);
      setHits(h => h + 1);

      return prev.filter(t => t.id !== targetId);
    });
  }, [done]);

  const handleMiss = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (done) return;
    // Only count as miss if clicking the background (not a target)
    if ((e.target as HTMLElement).dataset.target) return;
    setMisses(m => m + 1);
    setScore(s => Math.max(0, s - 1));
  }, [done]);

  const seconds = Math.ceil(timeLeft / 1000);

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* HUD */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className={`font-bold ${seconds <= 5 ? 'text-red-400' : 'text-skin-dim'}`}>
          {seconds}s
        </span>
        <div className="flex items-center gap-3">
          <span className="text-skin-dim">
            Hits: <span className="text-skin-base font-bold">{hits}</span>
          </span>
          <span className="text-skin-dim">
            Score: <span className="text-skin-gold font-bold">{score}</span>
          </span>
        </div>
      </div>

      {/* Play area */}
      <div
        className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden cursor-crosshair mx-auto"
        style={{ width: AREA_WIDTH, height: AREA_HEIGHT }}
        onClick={handleMiss}
      >
        {targets.map((target) => (
          <button
            key={target.id}
            data-target="true"
            onClick={(e) => { e.stopPropagation(); handleHit(target.id); }}
            className="absolute rounded-full transition-transform active:scale-75"
            style={{
              left: target.x - target.radius,
              top: target.y - target.radius,
              width: target.radius * 2,
              height: target.radius * 2,
              background: `radial-gradient(circle, rgba(255, 215, 0, 0.9) 0%, rgba(255, 215, 0, 0.3) 70%, transparent 100%)`,
              border: '2px solid rgba(255, 215, 0, 0.6)',
              cursor: 'pointer',
            }}
          />
        ))}

        {done && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <p className="text-sm font-mono text-skin-dim animate-pulse">Submitting...</p>
          </div>
        )}
      </div>

      <p className="text-[10px] font-mono text-skin-dim/50 text-center">
        Tap targets before they shrink away. Smaller = more points. Missing costs 1 point.
      </p>
    </div>
  );
}
