import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';

describe('pickingMode', () => {
  beforeEach(() => {
    useGameStore.getState().cancelPicking();
  });

  it('startPicking with no args starts new-dm mode', () => {
    useGameStore.getState().startPicking();
    const pm = useGameStore.getState().pickingMode;
    expect(pm).not.toBeNull();
    expect(pm?.kind).toBe('new-dm');
    expect(pm?.selected).toEqual([]);
  });

  it('startAddMember mode carries channelId', () => {
    useGameStore.getState().startAddMember('dm_abc');
    const pm = useGameStore.getState().pickingMode;
    expect(pm?.kind).toBe('add-member');
    expect((pm as any)?.channelId).toBe('dm_abc');
    expect(pm?.selected).toEqual([]);
  });

  it('togglePicked accumulates selected ids', () => {
    useGameStore.getState().startPicking();
    useGameStore.getState().togglePicked('p2');
    useGameStore.getState().togglePicked('p3');
    expect(useGameStore.getState().pickingMode?.selected).toEqual(['p2', 'p3']);
  });

  it('togglePicked removes already-selected id', () => {
    useGameStore.getState().startPicking();
    useGameStore.getState().togglePicked('p2');
    useGameStore.getState().togglePicked('p2');
    expect(useGameStore.getState().pickingMode?.selected).toEqual([]);
  });

  it('cancelPicking returns to null', () => {
    useGameStore.getState().startPicking();
    useGameStore.getState().cancelPicking();
    expect(useGameStore.getState().pickingMode).toBeNull();
  });

  it('togglePicked is no-op when pickingMode is null', () => {
    expect(useGameStore.getState().pickingMode).toBeNull();
    useGameStore.getState().togglePicked('p2');
    expect(useGameStore.getState().pickingMode).toBeNull();
  });

  it('togglePicked in add-member mode preserves channelId', () => {
    useGameStore.getState().startAddMember('dm_xyz');
    useGameStore.getState().togglePicked('p4');
    const pm = useGameStore.getState().pickingMode;
    expect(pm?.kind).toBe('add-member');
    expect((pm as any)?.channelId).toBe('dm_xyz');
    expect(pm?.selected).toEqual(['p4']);
  });
});
