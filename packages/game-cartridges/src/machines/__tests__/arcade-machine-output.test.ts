/**
 * Arcade Machine Output — verifies summary.players includes ALL participants
 * (both completed and timed-out) so recordCompletedGame can build a full leaderboard.
 *
 * Bug: GH #57 — arcade output used summary.playerResults instead of summary.players,
 * causing the L2 merge to miss completed players in completedPhases.silverRewards.
 */
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { createArcadeMachine } from '../arcade-machine';
import { Events } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';

const baseMachine = createArcadeMachine({
  gameType: 'TEST_GAME',
  defaultTimeLimit: 30_000,
  computeRewards: (result) => ({
    silver: result.correctAnswers || 0,
    gold: 0,
  }),
});

// Stub sendParent actions so the machine can run standalone
const testMachine = baseMachine.provide({
  actions: {
    emitSync: () => {},
    reportResults: () => {},
    emitPlayerGameResult: () => {},
  } as any,
});

function makeRoster(count: number, alive?: number): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  const aliveCount = alive ?? count;
  for (let i = 0; i < count; i++) {
    roster[`p${i}`] = {
      id: `p${i}`,
      personaName: `Player ${i}`,
      avatarUrl: '',
      status: i < aliveCount ? 'ALIVE' : 'ELIMINATED',
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  }
  return roster;
}

const baseInput = {
  roster: makeRoster(4),
  dayIndex: 1,
  timeLimit: 30_000,
  gameType: 'QUICK_MATH' as const,
};

describe('Arcade machine output (GH #57)', () => {
  it('output.summary.players includes all participants when all complete', () => {
    const actor = createActor(testMachine, { input: baseInput });
    actor.start();

    for (let i = 0; i < 4; i++) {
      actor.send({ type: Events.Game.start('TEST_GAME'), senderId: `p${i}` } as any);
      actor.send({
        type: Events.Game.result('TEST_GAME'),
        senderId: `p${i}`,
        correctAnswers: (i + 1) * 5,
        timeElapsed: 10_000,
      } as any);
    }
    // Submit all players to finalize (retry flow: RESULT → AWAITING_DECISION → SUBMIT → COMPLETED)
    for (let i = 0; i < 4; i++) {
      actor.send({ type: Events.Game.SUBMIT, senderId: `p${i}` } as any);
    }

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;

    // summary.players must exist (not summary.playerResults)
    expect(output.summary.players).toBeDefined();
    expect(output.summary.playerResults).toBeUndefined();

    // All 4 players in summary.players
    expect(Object.keys(output.summary.players)).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      const p = output.summary.players[`p${i}`];
      expect(p).toBeDefined();
      expect(p.silverReward).toBeGreaterThanOrEqual(0);
    }

    // Verify reward values
    expect(output.summary.players.p0.silverReward).toBe(5);
    expect(output.summary.players.p3.silverReward).toBe(20);

    actor.stop();
  });

  it('output.summary.players includes timed-out players too', () => {
    const actor = createActor(testMachine, { input: baseInput });
    actor.start();

    // Only p0 and p1 complete (RESULT only, no SUBMIT — still AWAITING_DECISION)
    actor.send({ type: Events.Game.start('TEST_GAME'), senderId: 'p0' } as any);
    actor.send({ type: Events.Game.result('TEST_GAME'), senderId: 'p0', correctAnswers: 10, timeElapsed: 8_000 } as any);
    actor.send({ type: Events.Game.start('TEST_GAME'), senderId: 'p1' } as any);
    actor.send({ type: Events.Game.result('TEST_GAME'), senderId: 'p1', correctAnswers: 5, timeElapsed: 12_000 } as any);

    // Force end — p0/p1 auto-submitted from AWAITING_DECISION, p2/p3 time out
    actor.send({ type: 'INTERNAL.END_GAME' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;

    // All 4 alive players in summary.players
    expect(Object.keys(output.summary.players)).toHaveLength(4);

    // Auto-submitted players have their earned rewards
    expect(output.summary.players.p0.silverReward).toBe(10);
    expect(output.summary.players.p1.silverReward).toBe(5);

    // Non-started players in silverRewards (economy — not yet credited)
    expect(output.silverRewards).toHaveProperty('p2');
    expect(output.silverRewards).toHaveProperty('p3');

    // Auto-submitted (AWAITING_DECISION → COMPLETED) NOT in silverRewards
    expect(output.silverRewards).not.toHaveProperty('p0');
    expect(output.silverRewards).not.toHaveProperty('p1');

    actor.stop();
  });

  it('eliminated players are excluded from output', () => {
    const roster = makeRoster(4, 3); // p3 eliminated
    const actor = createActor(testMachine, { input: { ...baseInput, roster } });
    actor.start();

    for (let i = 0; i < 3; i++) {
      actor.send({ type: Events.Game.start('TEST_GAME'), senderId: `p${i}` } as any);
      actor.send({
        type: Events.Game.result('TEST_GAME'),
        senderId: `p${i}`,
        correctAnswers: 10,
        timeElapsed: 10_000,
      } as any);
    }
    // Submit all players to finalize (retry flow: RESULT → AWAITING_DECISION → SUBMIT → COMPLETED)
    for (let i = 0; i < 3; i++) {
      actor.send({ type: Events.Game.SUBMIT, senderId: `p${i}` } as any);
    }

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const output = snap.output as any;

    expect(Object.keys(output.summary.players)).toHaveLength(3);
    expect(output.summary.players).not.toHaveProperty('p3');

    actor.stop();
  });
});
