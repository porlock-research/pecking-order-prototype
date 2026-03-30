/**
 * Prompt Machine — early termination tests
 *
 * Verifies that INTERNAL.END_ACTIVITY during active collection phases
 * produces meaningful results from partial submissions, not empty results.
 * Covers the fix for GH #112.
 */
import { describe, it, expect } from 'vitest';
import { createActor, type AnyActorRef } from 'xstate';
import { ActivityEvents, Config, Events, PromptTypes, type PromptType } from '@pecking-order/shared-types';
import { confessionMachine } from '../confession-machine';
import { guessWhoMachine } from '../guess-who-machine';
import { hotTakeMachine } from '../hot-take-machine';
import { playerPickMachine } from '../player-pick-machine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoster(ids: string[]) {
  const roster: Record<string, any> = {};
  for (const id of ids) {
    roster[id] = { personaName: id, status: 'ALIVE', silver: 50 };
  }
  return roster;
}

function makeInput(promptType: PromptType = 'CONFESSION', promptText = 'Test prompt', roster = makeRoster(['p1', 'p2', 'p3', 'p4'])) {
  return { promptType, promptText, roster, dayIndex: 1 };
}

// Stub sendParent to avoid "no parent" errors
const stubConfession = confessionMachine.provide({ actions: { emitPromptResultFact: () => {} } as any });
const stubGuessWho = guessWhoMachine.provide({ actions: { emitPromptResultFact: () => {} } as any });
const stubHotTake = hotTakeMachine.provide({ actions: { emitPromptResultFact: () => {} } as any });
const stubPlayerPick = playerPickMachine.provide({ actions: { emitPromptResultFact: () => {} } as any });

// ---------------------------------------------------------------------------
// CONFESSION — early END_ACTIVITY during collecting
// ---------------------------------------------------------------------------

describe('Confession — early END_ACTIVITY', () => {
  it('produces results with submitted confessions when timer expires in collecting', () => {
    const actor = createActor(stubConfession, { input: makeInput() });
    actor.start();

    // 2 of 4 players submit
    actor.send({ type: ActivityEvents.CONFESSION.SUBMIT, senderId: 'p1', text: 'I ate the last cookie' } as any);
    actor.send({ type: ActivityEvents.CONFESSION.SUBMIT, senderId: 'p3', text: 'I blame p2 for everything' } as any);

    expect(actor.getSnapshot().value).toBe('collecting');

    // Timer fires before all submit
    actor.send({ type: 'INTERNAL.END_ACTIVITY' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    // Results should include the 2 confessions, not be empty
    const { results } = snap.context;
    expect(results).not.toBeNull();
    expect(results.anonymousConfessions).toHaveLength(2);
    expect(results.indexToAuthor).toBeDefined();
    // Both submitters should get silver for submitting
    expect(results.silverRewards['p1']).toBe(Config.prompt.confession.silverSubmit);
    expect(results.silverRewards['p3']).toBe(Config.prompt.confession.silverSubmit);
    // Non-submitters should not appear in rewards
    expect(results.silverRewards['p2']).toBeUndefined();

    // Output should carry silver rewards
    const output = snap.output as any;
    expect(output.silverRewards['p1']).toBe(Config.prompt.confession.silverSubmit);

    actor.stop();
  });

  it('produces empty but valid results when no one submits before timer', () => {
    const actor = createActor(stubConfession, { input: makeInput() });
    actor.start();

    actor.send({ type: 'INTERNAL.END_ACTIVITY' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const { results } = snap.context;
    expect(results).not.toBeNull();
    expect(results.anonymousConfessions).toHaveLength(0);
    expect(results.silverRewards).toEqual({});

    actor.stop();
  });

  it('still works normally when all players submit (no timer needed)', () => {
    const actor = createActor(stubConfession, { input: makeInput() });
    actor.start();

    actor.send({ type: ActivityEvents.CONFESSION.SUBMIT, senderId: 'p1', text: 'A' } as any);
    actor.send({ type: ActivityEvents.CONFESSION.SUBMIT, senderId: 'p2', text: 'B' } as any);
    actor.send({ type: ActivityEvents.CONFESSION.SUBMIT, senderId: 'p3', text: 'C' } as any);
    // Last one triggers auto-transition to voting
    actor.send({ type: ActivityEvents.CONFESSION.SUBMIT, senderId: 'p4', text: 'D' } as any);

    expect(actor.getSnapshot().value).toBe('voting');

    // All vote
    actor.send({ type: ActivityEvents.CONFESSION.VOTE, senderId: 'p1', confessionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.CONFESSION.VOTE, senderId: 'p2', confessionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.CONFESSION.VOTE, senderId: 'p3', confessionIndex: 1 } as any);
    actor.send({ type: ActivityEvents.CONFESSION.VOTE, senderId: 'p4', confessionIndex: 0 } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');
    expect(snap.context.results.anonymousConfessions).toHaveLength(4);
    expect(snap.context.results.winnerIndex).not.toBeNull();

    actor.stop();
  });

  it('rejects duplicate submissions', () => {
    const actor = createActor(stubConfession, { input: makeInput() });
    actor.start();

    actor.send({ type: ActivityEvents.CONFESSION.SUBMIT, senderId: 'p1', text: 'First' } as any);
    actor.send({ type: ActivityEvents.CONFESSION.SUBMIT, senderId: 'p1', text: 'Duplicate' } as any);

    const snap = actor.getSnapshot();
    expect(Object.keys(snap.context.confessions)).toHaveLength(1);
    expect(snap.context.confessions['p1']).toBe('First');

    actor.stop();
  });
});

// ---------------------------------------------------------------------------
// GUESS_WHO — early END_ACTIVITY during answering
// ---------------------------------------------------------------------------

describe('Guess Who — early END_ACTIVITY', () => {
  it('produces results with submitted answers when timer expires in answering', () => {
    const actor = createActor(stubGuessWho, { input: makeInput('GUESS_WHO') });
    actor.start();

    // 3 of 4 answer
    actor.send({ type: ActivityEvents.GUESSWHO.ANSWER, senderId: 'p1', text: 'My answer 1' } as any);
    actor.send({ type: ActivityEvents.GUESSWHO.ANSWER, senderId: 'p2', text: 'My answer 2' } as any);
    actor.send({ type: ActivityEvents.GUESSWHO.ANSWER, senderId: 'p3', text: 'My answer 3' } as any);

    expect(actor.getSnapshot().value).toBe('answering');

    actor.send({ type: 'INTERNAL.END_ACTIVITY' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const { results } = snap.context;
    expect(results).not.toBeNull();
    expect(results.anonymousAnswers).toHaveLength(3);
    // Participation rewards for answering
    for (const pid of ['p1', 'p2', 'p3']) {
      expect(results.silverRewards[pid]).toBeGreaterThanOrEqual(Config.prompt.silverParticipation);
    }
    expect(results.silverRewards['p4']).toBeUndefined();

    actor.stop();
  });

  it('produces empty but valid results when no one answers before timer', () => {
    const actor = createActor(stubGuessWho, { input: makeInput('GUESS_WHO') });
    actor.start();

    actor.send({ type: 'INTERNAL.END_ACTIVITY' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');

    const { results } = snap.context;
    expect(results).not.toBeNull();
    expect(results.anonymousAnswers).toHaveLength(0);
    expect(results.silverRewards).toEqual({});

    actor.stop();
  });
});

// ---------------------------------------------------------------------------
// Single-phase machines — verify partial results work on END_ACTIVITY
// ---------------------------------------------------------------------------

describe('Single-phase prompts — partial results on END_ACTIVITY', () => {
  it('HOT_TAKE: partial stances produce valid results', () => {
    const actor = createActor(stubHotTake, { input: makeInput('HOT_TAKE') });
    actor.start();

    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', stance: 'AGREE' } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p2', stance: 'DISAGREE' } as any);

    actor.send({ type: 'INTERNAL.END_ACTIVITY' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');
    expect(snap.context.results.silverRewards['p1']).toBeDefined();
    expect(snap.context.results.silverRewards['p2']).toBeDefined();
    expect(snap.context.results.silverRewards['p3']).toBeUndefined();

    actor.stop();
  });

  it('PLAYER_PICK: partial responses produce valid results', () => {
    const actor = createActor(stubPlayerPick, { input: makeInput('PLAYER_PICK') });
    actor.start();

    actor.send({ type: ActivityEvents.PROMPT.SUBMIT, senderId: 'p1', targetId: 'p2' } as any);
    actor.send({ type: ActivityEvents.PROMPT.SUBMIT, senderId: 'p2', targetId: 'p1' } as any);

    actor.send({ type: 'INTERNAL.END_ACTIVITY' } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');
    // Mutual pick detected
    expect(snap.context.results!.mutualPicks).toHaveLength(1);
    expect(snap.context.results!.silverRewards['p1']).toBeDefined();
    expect(snap.context.results!.silverRewards['p2']).toBeDefined();

    actor.stop();
  });
});
