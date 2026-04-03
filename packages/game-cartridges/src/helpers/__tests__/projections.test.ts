import { describe, it, expect } from 'vitest';
import { projectGameCartridge } from '../projections';

describe('projectGameCartridge — all-player results', () => {
  it('includes allPlayerResults for async games when player is COMPLETED', () => {
    const gameCtx = {
      gameType: 'GAP_RUN',
      players: {
        p1: { status: 'COMPLETED', result: { distance: 100 }, silverReward: 10, goldContribution: 2 },
        p2: { status: 'COMPLETED', result: { distance: 80 }, silverReward: 5, goldContribution: 2 },
        p3: { status: 'COMPLETED', result: { distance: 120 }, silverReward: 15, goldContribution: 2 },
      },
      goldContribution: 6,
      seed: 42,
      timeLimit: 30000,
      difficulty: 'NORMAL',
      ready: true,
    };

    const projected = projectGameCartridge(gameCtx, 'p1');

    expect(projected.allPlayerResults).toBeDefined();
    expect(projected.allPlayerResults).toHaveLength(3);
    // Sorted by silverReward descending
    expect(projected.allPlayerResults[0].playerId).toBe('p3');
    expect(projected.allPlayerResults[0].silverReward).toBe(15);
    expect(projected.allPlayerResults[1].playerId).toBe('p1');
    expect(projected.allPlayerResults[2].playerId).toBe('p2');
  });

  it('does NOT include allPlayerResults while player is still PLAYING', () => {
    const gameCtx = {
      gameType: 'GAP_RUN',
      players: {
        p1: { status: 'PLAYING', result: null, silverReward: 0 },
        p2: { status: 'COMPLETED', result: { distance: 80 }, silverReward: 5, goldContribution: 2 },
      },
      seed: 42,
      timeLimit: 30000,
      difficulty: 'NORMAL',
      ready: true,
    };

    const projected = projectGameCartridge(gameCtx, 'p1');
    expect(projected.allPlayerResults).toBeUndefined();
  });

  it('includes allPlayerResults when player status is AWAITING_DECISION', () => {
    const gameCtx = {
      gameType: 'STACKER',
      players: {
        p1: { status: 'AWAITING_DECISION', result: { height: 10 }, silverReward: 8 },
        p2: { status: 'COMPLETED', result: { height: 5 }, silverReward: 3 },
      },
      seed: 42,
      timeLimit: 30000,
      difficulty: 'NORMAL',
      ready: true,
    };

    const projected = projectGameCartridge(gameCtx, 'p1');
    expect(projected.allPlayerResults).toBeDefined();
    expect(projected.allPlayerResults).toHaveLength(2);
  });

  it('does not break existing sync decision projection', () => {
    // Sync decision games have decisions + submitted, no players record
    const gameCtx = {
      gameType: 'BET_BET_BET',
      phase: 'REVEAL',
      decisions: { p1: 'BET_HIGH', p2: 'BET_LOW' },
      submitted: { p1: true, p2: true },
      eligiblePlayers: ['p1', 'p2'],
      results: { silverRewards: { p1: 10, p2: 5 } },
    };

    const projected = projectGameCartridge(gameCtx, 'p1');
    // Should NOT have allPlayerResults (this is a sync decision, not async)
    expect(projected.allPlayerResults).toBeUndefined();
    expect(projected.decisions).toBeDefined();
  });
});
