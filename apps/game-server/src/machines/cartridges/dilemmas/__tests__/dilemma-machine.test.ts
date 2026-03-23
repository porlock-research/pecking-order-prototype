/**
 * Dilemma Machine Factory — unit tests
 *
 * Covers: Silver Gambit, Spotlight, Gift or Grief
 * Pattern: shared scenario files consumed via loops + standalone behavioral edge cases
 */
import { describe, it, expect } from 'vitest';
import { createActor, type AnyActorRef } from 'xstate';
import { Config, DilemmaEvents, Events } from '@pecking-order/shared-types';
import type { DilemmaCartridgeInput, DilemmaOutput } from '@pecking-order/shared-types';
import { silverGambitMachine } from '../silver-gambit';
import { spotlightMachine } from '../spotlight';
import { giftOrGriefMachine } from '../gift-or-grief';

import {
  buildRoster,
  SILVER_GAMBIT_SCENARIOS,
  SPOTLIGHT_SCENARIOS,
  GIFT_OR_GRIEF_SCENARIOS,
} from './scenarios';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(
  dilemmaType: DilemmaCartridgeInput['dilemmaType'],
  roster: Record<string, any>,
  dayIndex = 1,
): DilemmaCartridgeInput {
  return { dilemmaType, roster, dayIndex };
}

/** Assert machine is done and return its output. */
function doneOutput(actor: AnyActorRef): DilemmaOutput {
  const snap = actor.getSnapshot();
  expect(snap.status).toBe('done');
  return snap.output as DilemmaOutput;
}

// ---------------------------------------------------------------------------
// Stub sendParent actions so machines can run standalone
// ---------------------------------------------------------------------------

const stubSilverGambit = silverGambitMachine.provide({
  actions: { emitResultFact: () => {} } as any,
});
const stubSpotlight = spotlightMachine.provide({
  actions: { emitResultFact: () => {} } as any,
});
const stubGiftOrGrief = giftOrGriefMachine.provide({
  actions: { emitResultFact: () => {} } as any,
});

// ---------------------------------------------------------------------------
// SILVER GAMBIT — scenario loop
// ---------------------------------------------------------------------------

describe('Silver Gambit', () => {
  for (const scenario of SILVER_GAMBIT_SCENARIOS) {
    it(scenario.name, () => {
      const roster = buildRoster(scenario.roster);
      const actor = createActor(stubSilverGambit, {
        input: makeInput('SILVER_GAMBIT', roster),
      });
      actor.start();

      for (const [senderId, decision] of Object.entries(scenario.decisions)) {
        actor.send({
          type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
          senderId,
          ...decision,
        } as any);
      }

      if (!scenario.allSubmit) {
        // Force-close when not all submit
        actor.send({ type: Events.Internal.END_DILEMMA } as any);
      }

      const output = doneOutput(actor);
      expect(output.dilemmaType).toBe('SILVER_GAMBIT');

      // Verify silver rewards
      for (const [pid, expected] of Object.entries(scenario.expected.silverRewards)) {
        expect(output.silverRewards[pid]).toBe(expected);
      }

      // Verify summary fields
      for (const [key, expected] of Object.entries(scenario.expected.summary)) {
        expect((output.summary as any)[key]).toEqual(expected);
      }

      actor.stop();
    });
  }

  // --- Behavioral edge cases ---

  it('rejects invalid action values', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' as const },
      p1: { silver: 45, status: 'ALIVE' as const },
    });
    const actor = createActor(stubSilverGambit, {
      input: makeInput('SILVER_GAMBIT', roster),
    });
    actor.start();

    actor.send({
      type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
      senderId: 'p0',
      action: 'STEAL', // invalid
    } as any);

    const snap = actor.getSnapshot();
    expect(snap.value).toBe('collecting');
    expect(Object.keys(snap.context.decisions)).toHaveLength(0);

    actor.stop();
  });

  it('rejects duplicate submissions from same player', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' as const },
      p1: { silver: 45, status: 'ALIVE' as const },
      p2: { silver: 40, status: 'ALIVE' as const },
    });
    const actor = createActor(stubSilverGambit, {
      input: makeInput('SILVER_GAMBIT', roster),
    });
    actor.start();

    actor.send({
      type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
      senderId: 'p0',
      action: 'DONATE',
    } as any);

    // Try to submit again — should be ignored
    actor.send({
      type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
      senderId: 'p0',
      action: 'KEEP',
    } as any);

    const snap = actor.getSnapshot();
    expect(snap.context.decisions['p0']).toEqual({ action: 'DONATE' });
    expect(Object.keys(snap.context.decisions)).toHaveLength(1);

    actor.stop();
  });
});

// ---------------------------------------------------------------------------
// SPOTLIGHT — scenario loop
// ---------------------------------------------------------------------------

describe('Spotlight', () => {
  for (const scenario of SPOTLIGHT_SCENARIOS) {
    it(scenario.name, () => {
      const roster = buildRoster(scenario.roster);
      const actor = createActor(stubSpotlight, {
        input: makeInput('SPOTLIGHT', roster),
      });
      actor.start();

      for (const [senderId, decision] of Object.entries(scenario.decisions)) {
        actor.send({
          type: DilemmaEvents.SPOTLIGHT.SUBMIT,
          senderId,
          ...decision,
        } as any);
      }

      if (!scenario.allSubmit) {
        // Force-close when not all submit
        actor.send({ type: Events.Internal.END_DILEMMA } as any);
      }

      const output = doneOutput(actor);
      expect(output.dilemmaType).toBe('SPOTLIGHT');

      // Verify silver rewards
      for (const [pid, expected] of Object.entries(scenario.expected.silverRewards)) {
        expect(output.silverRewards[pid]).toBe(expected);
      }

      // Verify summary fields
      for (const [key, expected] of Object.entries(scenario.expected.summary)) {
        expect((output.summary as any)[key]).toEqual(expected);
      }

      actor.stop();
    });
  }

  // --- Behavioral edge cases ---

  it('rejects self-pick', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' as const },
      p1: { silver: 45, status: 'ALIVE' as const },
      p2: { silver: 40, status: 'ALIVE' as const },
    });
    const actor = createActor(stubSpotlight, {
      input: makeInput('SPOTLIGHT', roster),
    });
    actor.start();

    actor.send({
      type: DilemmaEvents.SPOTLIGHT.SUBMIT,
      senderId: 'p0',
      targetId: 'p0',
    } as any);

    const snap = actor.getSnapshot();
    expect(snap.value).toBe('collecting');
    expect(Object.keys(snap.context.decisions)).toHaveLength(0);

    actor.stop();
  });

  it('rejects pick of eliminated player', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' as const },
      p1: { silver: 45, status: 'ALIVE' as const },
      p2: { silver: 40, status: 'ELIMINATED' as const },
    });
    const actor = createActor(stubSpotlight, {
      input: makeInput('SPOTLIGHT', roster),
    });
    actor.start();

    actor.send({
      type: DilemmaEvents.SPOTLIGHT.SUBMIT,
      senderId: 'p0',
      targetId: 'p2',
    } as any);

    const snap = actor.getSnapshot();
    expect(snap.value).toBe('collecting');
    expect(Object.keys(snap.context.decisions)).toHaveLength(0);

    actor.stop();
  });
});

// ---------------------------------------------------------------------------
// GIFT OR GRIEF — scenario loop
// ---------------------------------------------------------------------------

describe('Gift or Grief', () => {
  for (const scenario of GIFT_OR_GRIEF_SCENARIOS) {
    it(scenario.name, () => {
      const roster = buildRoster(scenario.roster);
      const actor = createActor(stubGiftOrGrief, {
        input: makeInput('GIFT_OR_GRIEF', roster),
      });
      actor.start();

      for (const [senderId, decision] of Object.entries(scenario.decisions)) {
        actor.send({
          type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT,
          senderId,
          ...decision,
        } as any);
      }

      if (!scenario.allSubmit) {
        // Force-close when not all submit
        actor.send({ type: Events.Internal.END_DILEMMA } as any);
      }

      const output = doneOutput(actor);
      expect(output.dilemmaType).toBe('GIFT_OR_GRIEF');

      // Verify silver rewards
      for (const [pid, expected] of Object.entries(scenario.expected.silverRewards)) {
        expect(output.silverRewards[pid]).toBe(expected);
      }

      // Verify summary fields — use arrayContaining for array fields
      for (const [key, expected] of Object.entries(scenario.expected.summary)) {
        if (Array.isArray(expected)) {
          expect((output.summary as any)[key]).toHaveLength(expected.length);
          if (expected.length > 0) {
            expect((output.summary as any)[key]).toEqual(expect.arrayContaining(expected));
          }
        } else {
          expect((output.summary as any)[key]).toEqual(expected);
        }
      }

      actor.stop();
    });
  }
});

// ---------------------------------------------------------------------------
// Cross-cutting lifecycle tests
// ---------------------------------------------------------------------------

describe('Dilemma machine lifecycle', () => {
  it('reaches done state after INTERNAL.END_DILEMMA with partial submissions', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' as const },
      p1: { silver: 45, status: 'ALIVE' as const },
      p2: { silver: 40, status: 'ALIVE' as const },
      p3: { silver: 35, status: 'ALIVE' as const },
    });
    const actor = createActor(stubSilverGambit, {
      input: makeInput('SILVER_GAMBIT', roster),
    });
    actor.start();

    // Only 2 of 4 submit
    actor.send({
      type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
      senderId: 'p0',
      action: 'DONATE',
    } as any);
    actor.send({
      type: DilemmaEvents.SILVER_GAMBIT.SUBMIT,
      senderId: 'p1',
      action: 'KEEP',
    } as any);

    // Force-close
    actor.send({ type: Events.Internal.END_DILEMMA } as any);

    const output = doneOutput(actor);
    expect(output.dilemmaType).toBe('SILVER_GAMBIT');
    expect((output.summary as any).allDonated).toBe(false);
    expect((output.summary as any).keeperCount).toBe(1);
    expect((output.summary as any).donorCount).toBe(1);

    actor.stop();
  });

  it('eliminated players excluded from eligible voters', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' as const },
      p1: { silver: 45, status: 'ALIVE' as const },
      p2: { silver: 40, status: 'ALIVE' as const },
      p3: { silver: 35, status: 'ELIMINATED' as const },
      p4: { silver: 30, status: 'ELIMINATED' as const },
    });
    const actor = createActor(stubSpotlight, {
      input: makeInput('SPOTLIGHT', roster),
    });
    actor.start();

    const snap = actor.getSnapshot();
    expect(snap.context.eligiblePlayers).toHaveLength(3);
    expect(snap.context.eligiblePlayers).toEqual(['p0', 'p1', 'p2']);

    // Eliminated player submission is rejected
    actor.send({
      type: DilemmaEvents.SPOTLIGHT.SUBMIT,
      senderId: 'p3',
      targetId: 'p0',
    } as any);
    actor.send({
      type: DilemmaEvents.SPOTLIGHT.SUBMIT,
      senderId: 'p4',
      targetId: 'p0',
    } as any);

    const snap2 = actor.getSnapshot();
    expect(Object.keys(snap2.context.decisions)).toHaveLength(0);

    actor.stop();
  });

  it('context exposes phase, dilemmaType, decisions, eligiblePlayers for SYNC', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' as const },
      p1: { silver: 45, status: 'ALIVE' as const },
      p2: { silver: 40, status: 'ALIVE' as const },
    });
    const actor = createActor(stubGiftOrGrief, {
      input: makeInput('GIFT_OR_GRIEF', roster),
    });
    actor.start();

    const snap = actor.getSnapshot();
    expect(snap.context.phase).toBe('COLLECTING');
    expect(snap.context.dilemmaType).toBe('GIFT_OR_GRIEF');
    expect(snap.context.eligiblePlayers).toEqual(['p0', 'p1', 'p2']);
    expect(snap.context.decisions).toEqual({});
    expect(snap.context.results).toBeNull();

    // Submit one decision
    actor.send({
      type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT,
      senderId: 'p0',
      targetId: 'p1',
    } as any);

    const snap2 = actor.getSnapshot();
    expect(snap2.context.decisions).toHaveProperty('p0');
    expect(snap2.context.phase).toBe('COLLECTING');

    // Complete
    actor.send({
      type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT,
      senderId: 'p1',
      targetId: 'p2',
    } as any);
    actor.send({
      type: DilemmaEvents.GIFT_OR_GRIEF.SUBMIT,
      senderId: 'p2',
      targetId: 'p0',
    } as any);

    const snap3 = actor.getSnapshot();
    expect(snap3.status).toBe('done');
    expect(snap3.context.phase).toBe('REVEAL');
    expect(snap3.context.results).not.toBeNull();

    actor.stop();
  });

  it('INTERNAL.END_DILEMMA with zero submissions still produces valid output', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' as const },
      p1: { silver: 45, status: 'ALIVE' as const },
      p2: { silver: 40, status: 'ALIVE' as const },
    });
    const actor = createActor(stubGiftOrGrief, {
      input: makeInput('GIFT_OR_GRIEF', roster),
    });
    actor.start();

    actor.send({ type: Events.Internal.END_DILEMMA } as any);

    const output = doneOutput(actor);
    expect(output.dilemmaType).toBe('GIFT_OR_GRIEF');
    expect(output.silverRewards).toEqual({});
    expect((output.summary as any).giftedIds).toEqual([]);
    expect((output.summary as any).grievedIds).toEqual([]);

    actor.stop();
  });
});
