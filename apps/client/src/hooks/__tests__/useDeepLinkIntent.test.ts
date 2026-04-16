import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameStore } from '../../store/useGameStore';
import { useDeepLinkIntent } from '../useDeepLinkIntent';

beforeEach(() => {
  useGameStore.setState({
    gameId: 'g1', playerId: 'p1',
    pendingIntent: null, pendingIntentAttempts: 0, pendingIntentFirstReceivedAt: null,
    channels: { 'DM-p1-p3': { type: 'DM', memberIds: ['p1', 'p3'] } as any },
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date(1000));
});

describe('useDeepLinkIntent', () => {
  it('reads ?intent= from URL on mount, clears it, calls resolve', () => {
    const intent = { kind: 'dm' as const, channelId: 'DM-p1-p3' };
    const b64 = btoa(JSON.stringify(intent));
    history.replaceState(null, '', `/game/ABC?intent=${b64}`);

    const resolve = vi.fn().mockReturnValue(true);
    renderHook(() => useDeepLinkIntent(resolve));

    expect(window.location.search).toBe('');
    expect(resolve).toHaveBeenCalledWith(intent, 'push');
  });

  it('calls resolve multiple times when unresolved, bounded by MAX_ATTEMPTS', () => {
    const intent = { kind: 'dm' as const, channelId: 'missing-channel' };
    const b64 = btoa(JSON.stringify(intent));
    history.replaceState(null, '', `/game/ABC?intent=${b64}`);

    const resolve = vi.fn().mockReturnValue(false);
    renderHook(() => useDeepLinkIntent(resolve));

    // First call from ?intent= + retries from the effect
    expect(resolve).toHaveBeenCalled();
    expect(resolve.mock.calls.length).toBeLessThanOrEqual(1 + 3);
  });

  it('ignores malformed ?intent= silently', () => {
    history.replaceState(null, '', `/game/ABC?intent=not-base64!!!`);
    const resolve = vi.fn();
    renderHook(() => useDeepLinkIntent(resolve));
    expect(resolve).not.toHaveBeenCalled();
  });

  it('drops pendingIntent after MAX_ATTEMPTS unresolved retries', () => {
    const resolve = vi.fn().mockReturnValue(false);
    const { rerender } = renderHook(() => useDeepLinkIntent(resolve));
    act(() => {
      useGameStore.getState().setPendingIntent({ kind: 'dm', channelId: 'missing' });
    });
    // Force re-evaluation cycles
    for (let i = 0; i < 6; i++) rerender();
    expect(useGameStore.getState().pendingIntent).toBeNull();
  });

  it('drops pendingIntent after MAX_AGE_MS regardless of attempts', () => {
    const resolve = vi.fn().mockReturnValue(false);
    renderHook(() => useDeepLinkIntent(resolve));
    act(() => {
      useGameStore.getState().setPendingIntent({ kind: 'dm', channelId: 'missing' });
    });
    act(() => {
      vi.advanceTimersByTime(11_000);
      // Trigger another store update so the effect re-evaluates
      useGameStore.setState({ pendingIntentAttempts: 0 });
    });
    expect(useGameStore.getState().pendingIntent).toBeNull();
  });
});
