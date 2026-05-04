import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLockInCountdown, LOCK_IN_MS } from '../useLockInCountdown';

/**
 * Per impeccable.md principle 7: irreversible commit actions get a
 * 3-second tap-to-undo countdown BEFORE firing. This hook centralizes
 * the timer + state machine for the silver/nudge sites that previously
 * fired instantly.
 *
 * AvatarPicker is the design template (already shipped in voting cartridge);
 * see apps/client/src/cartridges/voting/shared/AvatarPicker.tsx LockInFooter.
 * Voting embeds the timer + UI together; this hook splits the timer out
 * so non-avatar surfaces (silver sheet, nudge toast) can drive their own UI.
 */

describe('useLockInCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useLockInCountdown({ onComplete: vi.fn() }));
    expect(result.current.state).toBe('idle');
  });

  it('start() transitions to locking', () => {
    const { result } = renderHook(() => useLockInCountdown({ onComplete: vi.fn() }));
    act(() => result.current.start());
    expect(result.current.state).toBe('locking');
  });

  it('cancel() during locking returns to idle and does NOT call onComplete', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useLockInCountdown({ onComplete }));

    act(() => result.current.start());
    act(() => result.current.cancel());

    expect(result.current.state).toBe('idle');

    // Advance past the duration; onComplete must not fire because we cancelled.
    act(() => vi.advanceTimersByTime(LOCK_IN_MS + 100));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete and returns to idle after the configured duration', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useLockInCountdown({ onComplete }));

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(LOCK_IN_MS));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('idle');
  });

  it('does NOT call onComplete if unmounted during locking (no leak)', () => {
    const onComplete = vi.fn();
    const { result, unmount } = renderHook(() => useLockInCountdown({ onComplete }));

    act(() => result.current.start());
    unmount();
    act(() => vi.advanceTimersByTime(LOCK_IN_MS + 100));

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('start() while already locking is a no-op (idempotent)', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useLockInCountdown({ onComplete }));

    act(() => result.current.start());
    // Advance partway then try to start again.
    act(() => vi.advanceTimersByTime(LOCK_IN_MS / 2));
    act(() => result.current.start());

    // Original timer should still complete at the original time, exactly once.
    act(() => vi.advanceTimersByTime(LOCK_IN_MS / 2));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('supports a custom duration', () => {
    const onComplete = vi.fn();
    const customMs = 1500;
    const { result } = renderHook(() =>
      useLockInCountdown({ onComplete, durationMs: customMs })
    );

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(customMs - 1));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('start → cancel → start again runs a fresh timer', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useLockInCountdown({ onComplete }));

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(LOCK_IN_MS / 2));
    act(() => result.current.cancel());

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(LOCK_IN_MS));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
