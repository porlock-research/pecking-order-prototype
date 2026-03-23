import { describe, it, expect } from 'vitest';
import { createActor, fromPromise } from 'xstate';
import { triviaMachine } from '../trivia';
import { ArcadePhases, Events, TriviaEvents } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';

/** Flush microtask queue so fromPromise resolves */
const flush = () => new Promise((r) => setTimeout(r, 0));

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

// Provide a mock fetchQuestions that resolves immediately with test questions
// and stub sendParent actions
const testMachine = triviaMachine.provide({
  actors: {
    fetchQuestions: fromPromise(async () => {
      // Return a large enough pool for retries (30+ questions)
      return Array.from({ length: 30 }, (_, i) => ({
        id: `q${i}`,
        question: `Question ${i}?`,
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        category: 'test',
        difficulty: 'easy' as const,
      }));
    }),
  } as any,
  actions: {
    emitRoundSync: () => {},
    reportResults: () => {},
    emitPlayerGameResult: () => {},
  } as any,
});

const baseInput = { roster: makeRoster(2), dayIndex: 1, gameType: 'TRIVIA' as const };

function createTestActor() {
  return createActor(testMachine, { input: baseInput });
}

/** Complete all rounds for a player by answering correctly (answerIndex: 0) */
function completeAllRounds(actor: any, playerId: string) {
  actor.send({ type: TriviaEvents.START, senderId: playerId } as any);

  const snap = actor.getSnapshot();
  const totalRounds = snap.context.players[playerId]?.totalRounds || 5;

  for (let i = 0; i < totalRounds; i++) {
    actor.send({
      type: TriviaEvents.ANSWER,
      senderId: playerId,
      answerIndex: 0,  // correct answer
    } as any);
  }
}

describe('trivia retry', () => {
  it('player enters AWAITING_DECISION after completing all rounds', async () => {
    const actor = createTestActor();
    actor.start();
    await flush();

    completeAllRounds(actor, 'p0');

    const snap = actor.getSnapshot();
    expect(snap.context.players.p0.status).toBe(ArcadePhases.AWAITING_DECISION);
  });

  it('RETRY resets rounds and assigns fresh questions', async () => {
    const actor = createTestActor();
    actor.start();
    await flush();

    completeAllRounds(actor, 'p0');

    actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

    const snap = actor.getSnapshot();
    const player = snap.context.players.p0;
    expect(player.status).toBe(ArcadePhases.PLAYING);
    expect(player.currentRound).toBe(1);
    expect(player.score).toBe(0);
    expect(player.correctCount).toBe(0);
    expect(player.retryCount).toBe(1);
    expect(player.previousResult).toBeDefined();
    expect(player.usedQuestionIds.length).toBeGreaterThan(0);
  });

  it('SUBMIT after completing trivia finalizes results', async () => {
    const actor = createTestActor();
    actor.start();
    await flush();

    completeAllRounds(actor, 'p0');
    actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);

    const snap = actor.getSnapshot();
    expect(snap.context.players.p0.status).toBe(ArcadePhases.COMPLETED);
  });

  it('previousResult contains score and correctCount', async () => {
    const actor = createTestActor();
    actor.start();
    await flush();

    completeAllRounds(actor, 'p0');
    const silverBeforeRetry = actor.getSnapshot().context.players.p0.silverReward;

    actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

    const snap = actor.getSnapshot();
    expect(snap.context.players.p0.previousResult).toMatchObject({
      score: expect.any(Number),
      correctCount: expect.any(Number),
    });
    expect(snap.context.players.p0.previousSilverReward).toBe(silverBeforeRetry);
  });

  it('gold is deferred to submit (not accumulated per-round)', async () => {
    const actor = createTestActor();
    actor.start();
    await flush();

    completeAllRounds(actor, 'p0');

    const snap = actor.getSnapshot();
    expect(snap.context.goldContribution).toBe(0);
    expect(snap.context.players.p0.goldReward).toBeGreaterThan(0);

    actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);

    const snapAfterSubmit = actor.getSnapshot();
    expect(snapAfterSubmit.context.goldContribution).toBeGreaterThan(0);
  });

  it('deadline uses previousResult for mid-retry players', async () => {
    const actor = createTestActor();
    actor.start();
    await flush();

    completeAllRounds(actor, 'p0');
    actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

    completeAllRounds(actor, 'p1');
    actor.send({ type: Events.Game.SUBMIT, senderId: 'p1' } as any);

    actor.send({ type: Events.Internal.END_GAME } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');
    const output = snap.output as any;
    expect(output.summary.players.p0.silverReward).toBeGreaterThan(0);
  });
});
