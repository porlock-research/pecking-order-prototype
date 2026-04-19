import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { hotTakeMachine } from '../hot-take-machine';
import { ActivityEvents, Events } from '@pecking-order/shared-types';

// Stub sendParent to avoid "no parent" errors when creating the actor standalone.
const stubHotTake = hotTakeMachine.provide({
  actions: { emitPromptResultFact: () => {} } as any,
});

function makeInput(options?: string[], promptId?: string) {
  return {
    promptType: 'HOT_TAKE' as const,
    promptText: options ? 'Test claim.' : 'Legacy claim.',
    dayIndex: 1,
    roster: {
      p1: { personaName: 'P1', status: 'ALIVE', silver: 50 } as any,
      p2: { personaName: 'P2', status: 'ALIVE', silver: 50 } as any,
      p3: { personaName: 'P3', status: 'ALIVE', silver: 50 } as any,
      p4: { personaName: 'P4', status: 'ALIVE', silver: 50 } as any,
    },
    ...(options ? { options } : {}),
    ...(promptId ? { promptId } : {}),
  };
}

describe('hot-take-machine — generalized N-option tally', () => {
  it('3 players pick three different options → all are minority tied for min', () => {
    const actor = createActor(stubHotTake, {
      input: makeInput(['A', 'B', 'C'], 'test-3'),
    });
    actor.start();

    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p2', optionIndex: 1 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p3', optionIndex: 2 } as any);
    actor.send({ type: Events.Internal.END_ACTIVITY } as any);

    const { results } = actor.getSnapshot().context;
    expect(results.tally).toEqual([1, 1, 1]);
    expect(results.hasRealMinority).toBe(false);
    expect(results.silverRewards.p1).toBe(5);
    expect(results.silverRewards.p2).toBe(5);
    expect(results.silverRewards.p3).toBe(5);

    actor.stop();
  });

  it('4 players, 3 pick A and 1 picks B → B is the minority and earns +10', () => {
    const actor = createActor(stubHotTake, {
      input: makeInput(['A', 'B', 'C'], 'test-ab'),
    });
    actor.start();

    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p2', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p3', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p4', optionIndex: 1 } as any);

    const { results } = actor.getSnapshot().context;
    expect(results.tally).toEqual([3, 1, 0]);
    expect(results.hasRealMinority).toBe(true);
    expect(results.minorityIndices).toEqual([1]);
    expect(results.silverRewards.p1).toBe(5);
    expect(results.silverRewards.p4).toBe(15);

    actor.stop();
  });

  it('all players pick the same option → no real minority, no bonus', () => {
    const actor = createActor(stubHotTake, {
      input: makeInput(['A', 'B'], 'test-same'),
    });
    actor.start();

    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p2', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p3', optionIndex: 0 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p4', optionIndex: 0 } as any);

    const { results } = actor.getSnapshot().context;
    expect(results.hasRealMinority).toBe(false);
    expect(results.minorityIndices).toEqual([]);
    expect(Object.values(results.silverRewards)).toEqual([5, 5, 5, 5]);

    actor.stop();
  });

  it('rejects out-of-range optionIndex', () => {
    const actor = createActor(stubHotTake, {
      input: makeInput(['A', 'B', 'C'], 'test-range'),
    });
    actor.start();

    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', optionIndex: 7 } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', optionIndex: -1 } as any);
    actor.send({ type: Events.Internal.END_ACTIVITY } as any);

    const { results } = actor.getSnapshot().context;
    expect(results.tally).toEqual([0, 0, 0]);

    actor.stop();
  });

  it('accepts legacy {stance: AGREE|DISAGREE} when options is the legacy default', () => {
    const actor = createActor(stubHotTake, {
      input: makeInput(), // no options → fallback ['AGREE','DISAGREE']
    });
    actor.start();

    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p1', stance: 'AGREE' } as any);
    actor.send({ type: ActivityEvents.HOTTAKE.RESPOND, senderId: 'p2', stance: 'DISAGREE' } as any);
    actor.send({ type: Events.Internal.END_ACTIVITY } as any);

    const { results } = actor.getSnapshot().context;
    expect(results.tally).toEqual([1, 1]);
    expect(results.options).toEqual(['AGREE', 'DISAGREE']);

    actor.stop();
  });
});
