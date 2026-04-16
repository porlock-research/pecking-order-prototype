import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameStore } from '../../../../store/useGameStore';
import { useRevealQueue } from '../useRevealQueue';

beforeEach(() => {
  useGameStore.setState({
    gameId: 'g1',
    playerId: 'p1',
    roster: {
      p1: { personaName: 'You', status: 'ALIVE' },
      p2: { personaName: 'Bob', status: 'ELIMINATED', eliminatedOnDay: 3 },
    } as any,
    winner: null,
    dayIndex: 3,
    revealsSeen: { elimination: {}, winner: false },
  } as any);
});

describe('useRevealQueue', () => {
  it('returns the next queued reveal', () => {
    const { result } = renderHook(() => useRevealQueue());
    expect(result.current.current).toEqual({ kind: 'elimination', dayIndex: 3 });
  });

  it('dismiss() marks as seen and advances to next', () => {
    const { result } = renderHook(() => useRevealQueue());
    act(() => result.current.dismiss());
    expect(useGameStore.getState().revealsSeen.elimination[3]).toBe(true);
    expect(result.current.current).toBeNull();
  });

  it('forcePlay({kind,dayIndex}) plays regardless of revealsSeen', () => {
    useGameStore.setState({ revealsSeen: { elimination: { 3: true }, winner: false } });
    const { result } = renderHook(() => useRevealQueue());
    expect(result.current.current).toBeNull();
    act(() => result.current.forcePlay({ kind: 'elimination', dayIndex: 3 }));
    expect(result.current.current).toEqual({ kind: 'elimination', dayIndex: 3 });
  });

  it('queues winner reveal when winner exists', () => {
    useGameStore.setState({
      revealsSeen: { elimination: { 3: true }, winner: false },
      winner: { playerId: 'p1' },
    } as any);
    const { result } = renderHook(() => useRevealQueue());
    expect(result.current.current).toEqual({ kind: 'winner' });
  });
});
