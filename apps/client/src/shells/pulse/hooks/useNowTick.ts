import { useEffect, useState } from 'react';

/**
 * useNowTick — re-renders the consumer every `intervalMs` (default 1s) and
 * returns the current `Date.now()`. Used by usePillStates / NowLine /
 * VoteFloatingChip so countdown copy ticks live without requiring store
 * mutations to drive the re-render.
 *
 * Cheap: a single setInterval per consumer. Pause via passing `enabled=false`
 * (covers prefers-reduced-motion + hidden-tab cases — callers can pair with
 * `document.visibilityState` if they want).
 */
export function useNowTick(intervalMs: number = 1000, enabled: boolean = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}
