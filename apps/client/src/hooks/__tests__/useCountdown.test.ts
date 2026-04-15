import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdownWithUrgency } from '../useCountdown';

describe('useCountdownWithUrgency', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns null label when target is null', () => {
    const { result } = renderHook(() => useCountdownWithUrgency(null));
    expect(result.current.label).toBeNull();
    expect(result.current.urgent).toBe(false);
  });

  it('returns non-urgent at >60s remaining', () => {
    vi.setSystemTime(new Date('2026-04-14T12:00:00Z'));
    const target = new Date('2026-04-14T12:02:00Z').getTime();
    const { result } = renderHook(() => useCountdownWithUrgency(target));
    expect(result.current.urgent).toBe(false);
    expect(result.current.label).toBe('02:00');
  });

  it('returns urgent at <60s remaining', () => {
    vi.setSystemTime(new Date('2026-04-14T12:00:00Z'));
    const target = new Date('2026-04-14T12:00:30Z').getTime();
    const { result } = renderHook(() => useCountdownWithUrgency(target));
    expect(result.current.urgent).toBe(true);
    expect(result.current.label).toBe('00:30');
  });

  it('becomes urgent as time passes', () => {
    vi.setSystemTime(new Date('2026-04-14T12:00:00Z'));
    const target = new Date('2026-04-14T12:01:05Z').getTime();
    const { result, rerender } = renderHook(() => useCountdownWithUrgency(target));
    expect(result.current.urgent).toBe(false);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    rerender();
    expect(result.current.urgent).toBe(true);
  });
});
