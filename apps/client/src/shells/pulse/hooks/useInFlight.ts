import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Double-submit guard. Returns `pending` (for visual dim) and `run` (the
 * re-entrancy-safe dispatch). First call within the cooldown window goes
 * through; subsequent calls in the same window are dropped silently. We do
 * not have WS acks to gate on, so the timeout is the re-enable signal.
 *
 * Usage: `run(() => engine.sendX(...))` inside a send handler.
 */
export function useInFlight(cooldownMs = 600) {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const run = useCallback((fn: () => void) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      fn();
    } finally {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        pendingRef.current = false;
        setPending(false);
      }, cooldownMs);
    }
  }, [cooldownMs]);

  return { pending, run };
}
