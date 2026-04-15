import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';

describe('focusedCartridge store slice', () => {
  beforeEach(() => {
    useGameStore.setState({ focusedCartridge: null });
  });

  it('defaults to null', () => {
    expect(useGameStore.getState().focusedCartridge).toBeNull();
  });

  it('focusCartridge sets the slice', () => {
    useGameStore.getState().focusCartridge('voting-1-EXECUTIONER', 'voting', 'manual');
    expect(useGameStore.getState().focusedCartridge).toEqual({
      cartridgeId: 'voting-1-EXECUTIONER',
      cartridgeKind: 'voting',
      origin: 'manual',
    });
  });

  it('unfocusCartridge clears the slice', () => {
    useGameStore.getState().focusCartridge('game-1-TRIVIA', 'game', 'push');
    useGameStore.getState().unfocusCartridge();
    expect(useGameStore.getState().focusedCartridge).toBeNull();
  });

  it('focusing a different cartridge replaces the slice (no queue)', () => {
    useGameStore.getState().focusCartridge('voting-1-EXECUTIONER', 'voting', 'manual');
    useGameStore.getState().focusCartridge('game-1-TRIVIA', 'game', 'push');
    expect(useGameStore.getState().focusedCartridge?.cartridgeId).toBe('game-1-TRIVIA');
    expect(useGameStore.getState().focusedCartridge?.origin).toBe('push');
  });
});
