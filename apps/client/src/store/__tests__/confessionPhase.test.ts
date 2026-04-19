import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';

const DEFAULT_CONFESSION_PHASE = {
  active: false,
  myHandle: null,
  handleCount: 0,
  posts: [],
};

/**
 * T12 put `confessionPhase` under SYNC payload `context.confessionPhase`
 * (sibling of channels/chatLog), not `l3Context.*` as the plan's T15 scaffold
 * assumed. These tests verify the real hydration path.
 */
describe('useGameStore — confessionPhase hydration (T15)', () => {
  beforeEach(() => {
    useGameStore.setState({
      gameId: null,
      playerId: null,
      confessionPhase: DEFAULT_CONFESSION_PHASE,
    });
  });

  it('defaults to the inactive shape outside a live phase (never null)', () => {
    expect(useGameStore.getState().confessionPhase).toEqual(DEFAULT_CONFESSION_PHASE);
  });

  it('hydrates confessionPhase from SYNC context', () => {
    useGameStore.getState().sync({
      context: {
        gameId: 'g1',
        dayIndex: 3,
        confessionPhase: {
          active: true,
          myHandle: 'Confessor #3',
          handleCount: 4,
          posts: [{ handle: 'Confessor #1', text: 'x', ts: 1 }],
        },
      },
      state: 'activeSession',
    });
    expect(useGameStore.getState().confessionPhase).toEqual({
      active: true,
      myHandle: 'Confessor #3',
      handleCount: 4,
      posts: [{ handle: 'Confessor #1', text: 'x', ts: 1 }],
    });
  });

  it('defaults to the inactive shape when SYNC has no confessionPhase', () => {
    useGameStore.getState().sync({
      context: { gameId: 'g1', dayIndex: 1 },
      state: 'activeSession',
    });
    expect(useGameStore.getState().confessionPhase).toEqual(DEFAULT_CONFESSION_PHASE);
  });

  it('stableRef: identical posts arrays keep the same reference (prevents cascade re-renders)', () => {
    const first = {
      active: true,
      myHandle: 'Confessor #2',
      handleCount: 3,
      posts: [{ handle: 'Confessor #1', text: 'first', ts: 10 }],
    };
    useGameStore.getState().sync({ context: { confessionPhase: first }, state: 'activeSession' });
    const ref1 = useGameStore.getState().confessionPhase;

    // Send an equivalent-by-content payload (new object identity, same values).
    useGameStore.getState().sync({
      context: {
        confessionPhase: {
          active: true,
          myHandle: 'Confessor #2',
          handleCount: 3,
          posts: [{ handle: 'Confessor #1', text: 'first', ts: 10 }],
        },
      },
      state: 'activeSession',
    });
    const ref2 = useGameStore.getState().confessionPhase;
    expect(ref2).toBe(ref1);
  });

  it('stableRef: mutated post (new text) produces a NEW reference', () => {
    const first = {
      active: true,
      myHandle: 'Confessor #2',
      handleCount: 3,
      posts: [{ handle: 'Confessor #1', text: 'first', ts: 10 }],
    };
    useGameStore.getState().sync({ context: { confessionPhase: first }, state: 'activeSession' });
    const ref1 = useGameStore.getState().confessionPhase;

    // A NEW post arrives — posts.length changes.
    useGameStore.getState().sync({
      context: {
        confessionPhase: {
          active: true,
          myHandle: 'Confessor #2',
          handleCount: 3,
          posts: [
            { handle: 'Confessor #1', text: 'first', ts: 10 },
            { handle: 'Confessor #2', text: 'second', ts: 20 },
          ],
        },
      },
      state: 'activeSession',
    });
    const ref2 = useGameStore.getState().confessionPhase;
    expect(ref2).not.toBe(ref1);
    expect(ref2.posts).toHaveLength(2);
  });
});
