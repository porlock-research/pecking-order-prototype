import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Default 3-second lock-in window. Matches AvatarPicker's LOCK_IN_MS so
 * voting and silver/nudge feel like one design system.
 */
export const LOCK_IN_MS = 3000;

interface UseLockInCountdownOptions {
  /** Called when the timer completes without being cancelled. */
  onComplete: () => void;
  /** Override the lock-in duration (default 3000ms). */
  durationMs?: number;
}

interface UseLockInCountdownReturn {
  state: 'idle' | 'locking';
  /** Begin the countdown. No-op if already locking. */
  start: () => void;
  /** Cancel an in-flight countdown. No-op if idle. */
  cancel: () => void;
}

/**
 * Tap-to-undo countdown for irreversible commit actions (silver send, nudge,
 * etc.) per impeccable.md principle 7. The hook owns the timer and the
 * idle/locking state machine; UI components own the visual countdown
 * (progress bar, toast text, etc.) and trigger `start()` / `cancel()`.
 *
 * AvatarPicker is the design template for the integrated voting flow; this
 * hook splits the timer out so non-avatar surfaces can drive their own UI
 * without re-implementing the timer + cleanup contract.
 *
 * Cleanup contract:
 * - Cancel during locking → state returns to idle, onComplete is NOT called.
 * - Unmount during locking → onComplete is NOT called (no leak).
 * - start() while already locking → no-op (idempotent).
 */
export function useLockInCountdown({
  onComplete,
  durationMs = LOCK_IN_MS,
}: UseLockInCountdownOptions): UseLockInCountdownReturn {
  const [state, setState] = useState<'idle' | 'locking'>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Latest onComplete in a ref so the timer always calls the current handler
  // even if the consumer's closure changes between start() and completion.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const cancel = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setState('idle');
  }, []);

  const start = useCallback(() => {
    // Idempotent: ignore start() if a timer is already in-flight so a
    // double-tap on the trigger doesn't reset the countdown or stack timers.
    if (timeoutRef.current !== null) return;
    setState('locking');
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setState('idle');
      onCompleteRef.current();
    }, durationMs);
  }, [durationMs]);

  // Unmount cleanup — clear any in-flight timer so onComplete never fires
  // against a torn-down component.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return { state, start, cancel };
}
