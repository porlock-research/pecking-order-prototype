import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { createArcadeMachine } from '../arcade-machine';
import { ArcadePhases, Events } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';

const baseMachine = createArcadeMachine({
  gameType: 'TEST_GAME',
  defaultTimeLimit: 30_000,
  computeRewards: (result) => ({
    silver: result.correctAnswers || 0,
    gold: Math.floor((result.correctAnswers || 0) / 5),
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

function makeRoster(count: number): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  for (let i = 0; i < count; i++) {
    roster[`p${i}`] = {
      id: `p${i}`,
      personaName: `Player ${i}`,
      avatarUrl: '',
      status: 'ALIVE',
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  }
  return roster;
}

const baseInput = { roster: makeRoster(2), dayIndex: 1, gameType: 'TEST_GAME' as const };

function createTestActor() {
  return createActor(testMachine, { input: baseInput });
}

function startAndCompleteRun(actor: any, playerId: string, correctAnswers: number) {
  actor.send({ type: Events.Game.start('TEST_GAME'), senderId: playerId } as any);
  actor.send({ type: Events.Game.result('TEST_GAME'), senderId: playerId, correctAnswers, timeElapsed: 10_000 } as any);
}

describe('arcade retry', () => {
  describe('RESULT transitions to AWAITING_DECISION', () => {
    it('player enters AWAITING_DECISION after completing a run', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);

      const snap = actor.getSnapshot();
      const player = snap.context.players.p0;
      expect(player.status).toBe(ArcadePhases.AWAITING_DECISION);
      expect(player.result).toMatchObject({ correctAnswers: 5 });
      expect(player.silverReward).toBeGreaterThan(0);
      expect(player.retryCount).toBe(0);
    });

    it('machine stays in active state (PLAYER_COMPLETED not raised)', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);

      const snap = actor.getSnapshot();
      expect(snap.context.players.p0.status).toBe(ArcadePhases.AWAITING_DECISION);
      expect(snap.value).toBe('active');
    });

    it('does NOT add gold to machine goldContribution on RESULT', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 10);

      const snap = actor.getSnapshot();
      expect(snap.context.goldContribution).toBe(0);
      expect(snap.context.players.p0.goldReward).toBeGreaterThan(0);
    });
  });

  describe('GAME.SUBMIT finalizes', () => {
    it('transitions to COMPLETED and adds gold on submit', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      expect(snap.context.players.p0.status).toBe(ArcadePhases.COMPLETED);
      expect(snap.context.goldContribution).toBeGreaterThan(0);
    });

    it('all players submit → machine completes', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);
      startAndCompleteRun(actor, 'p1', 3);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p1' } as any);

      const snap = actor.getSnapshot();
      expect(snap.status).toBe('done');
    });

    it('ignores SUBMIT if player is not AWAITING_DECISION', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      expect(snap.context.players.p0.status).toBe(ArcadePhases.NOT_STARTED);
    });
  });

  describe('GAME.RETRY resets and loops', () => {
    it('transitions back to PLAYING with incremented retryCount', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);
      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      const player = snap.context.players.p0;
      expect(player.status).toBe(ArcadePhases.PLAYING);
      expect(player.retryCount).toBe(1);
      expect(player.result).toBeNull();
      expect(player.silverReward).toBe(0);
    });

    it('preserves previous result for comparison', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);
      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      const player = snap.context.players.p0;
      expect(player.previousResult).toMatchObject({ correctAnswers: 5 });
      expect(player.previousSilverReward).toBeGreaterThan(0);
    });

    it('can complete a second run and submit', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 3);
      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

      startAndCompleteRun(actor, 'p0', 8);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      expect(snap.context.players.p0.status).toBe(ArcadePhases.COMPLETED);
      expect(snap.context.players.p0.result).toMatchObject({ correctAnswers: 8 });
    });

    it('multiple retries work correctly', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 1);
      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);
      startAndCompleteRun(actor, 'p0', 2);
      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);
      startAndCompleteRun(actor, 'p0', 3);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      expect(snap.context.players.p0.retryCount).toBe(2);
      expect(snap.context.players.p0.result).toMatchObject({ correctAnswers: 3 });
      expect(snap.context.players.p0.previousResult).toMatchObject({ correctAnswers: 2 });
    });

    it('ignores RETRY if player is not AWAITING_DECISION', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      expect(snap.context.players.p0.status).toBe(ArcadePhases.NOT_STARTED);
    });
  });

  describe('deadline handling (INTERNAL.END_GAME)', () => {
    it('auto-submits AWAITING_DECISION players', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);
      startAndCompleteRun(actor, 'p1', 3);
      actor.send({ type: Events.Internal.END_GAME } as any);

      const snap = actor.getSnapshot();
      expect(snap.status).toBe('done');
      const output = snap.output as any;
      expect(output.summary.players.p0.silverReward).toBeGreaterThan(0);
      expect(output.summary.players.p1.silverReward).toBeGreaterThan(0);
    });

    it('uses previousResult for mid-retry players', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 7);
      const silverAfterFirstRun = actor.getSnapshot().context.players.p0.silverReward;
      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);
      actor.send({ type: Events.Game.start('TEST_GAME'), senderId: 'p0' } as any);

      startAndCompleteRun(actor, 'p1', 3);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p1' } as any);

      actor.send({ type: Events.Internal.END_GAME } as any);

      const snap = actor.getSnapshot();
      expect(snap.status).toBe('done');
      const output = snap.output as any;
      expect(output.summary.players.p0.silverReward).toBe(silverAfterFirstRun);
    });

    it('gives zero to first-run PLAYING players (no previousResult)', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: Events.Game.start('TEST_GAME'), senderId: 'p0' } as any);

      startAndCompleteRun(actor, 'p1', 5);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p1' } as any);

      actor.send({ type: Events.Internal.END_GAME } as any);

      const snap = actor.getSnapshot();
      expect(snap.status).toBe('done');
      const output = snap.output as any;
      expect(output.summary.players.p0.silverReward).toBe(0);
    });
  });

  describe('ALL_COMPLETE check', () => {
    it('does NOT trigger when some players are AWAITING_DECISION', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);
      startAndCompleteRun(actor, 'p1', 3);

      const snap = actor.getSnapshot();
      expect(snap.value).toBe('active');
      expect(snap.status).toBe('active');
    });
  });
});
