import { describe, it, expect } from 'vitest';
import { createActor, type AnyActorRef } from 'xstate';
import { VoteEvents } from '@pecking-order/shared-types';
import type { VoteResult } from '@pecking-order/shared-types';

import { bubbleMachine } from '../bubble-machine';
import { majorityMachine } from '../majority-machine';
import { executionerMachine } from '../executioner-machine';
import { podiumSacrificeMachine } from '../podium-sacrifice-machine';
import { shieldMachine } from '../shield-machine';
import { finalsMachine } from '../finals-machine';
import { trustPairsMachine } from '../trust-pairs-machine';
import { secondToLastMachine } from '../second-to-last-machine';

import {
  buildRoster,
  BUBBLE_SCENARIOS,
  MAJORITY_SCENARIOS,
  EXECUTIONER_SCENARIOS,
  PODIUM_SACRIFICE_SCENARIOS,
  SHIELD_SCENARIOS,
  TRUST_PAIRS_SCENARIOS,
  SECOND_TO_LAST_SCENARIOS,
  FINALS_SCENARIOS,
} from './scenarios';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(roster: Record<string, any>, dayIndex = 1) {
  return { voteType: 'MAJORITY' as any, roster, dayIndex };
}

/** Assert machine is done and return its output. */
function doneOutput(actor: AnyActorRef): VoteResult {
  const snap = actor.getSnapshot();
  expect(snap.status).toBe('done');
  return snap.output as VoteResult;
}

// ---------------------------------------------------------------------------
// Stub sendParent actions so machines don't error without a parent actor
// ---------------------------------------------------------------------------

const stubBubble = bubbleMachine.provide({
  actions: { emitVoteCastFact: () => {}, reportResults: () => {} } as any,
});

const stubMajority = majorityMachine.provide({
  actions: { emitVoteCastFact: () => {}, reportResults: () => {} } as any,
});

const stubExecutioner = executionerMachine.provide({
  actions: { emitVoteCastFact: () => {}, reportResults: () => {} } as any,
});

const stubPodiumSacrifice = podiumSacrificeMachine.provide({
  actions: { emitVoteCastFact: () => {}, reportResults: () => {} } as any,
});

const stubShield = shieldMachine.provide({
  actions: { emitVoteCastFact: () => {}, reportResults: () => {} } as any,
});

const stubFinals = finalsMachine.provide({
  actions: { emitVoteCastFact: () => {}, reportResults: () => {}, syncWinnerId: () => {} } as any,
});

const stubTrustPairs = trustPairsMachine.provide({
  actions: { emitTrustFact: () => {}, emitEliminateFact: () => {}, reportResults: () => {} } as any,
});

const stubSecondToLast = secondToLastMachine.provide({
  actions: { reportResults: () => {} } as any,
});

// ---------------------------------------------------------------------------
// BUBBLE MACHINE
// ---------------------------------------------------------------------------

describe('Bubble Machine', () => {
  for (const scenario of BUBBLE_SCENARIOS) {
    it(scenario.name, () => {
      const roster = buildRoster(scenario.roster);
      const actor = createActor(stubBubble, { input: makeInput(roster) });
      actor.start();

      for (const [voterId, targetId] of Object.entries(scenario.votes ?? {})) {
        actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: voterId, targetId });
      }
      actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

      const result = doneOutput(actor);
      expect(result.eliminatedId).toBe(scenario.expected.eliminatedId);
      expect(result.mechanism).toBe('BUBBLE');
      if (scenario.expected.immune) {
        expect(result.summary.immunePlayerIds).toEqual(
          expect.arrayContaining(scenario.expected.immune),
        );
      }
    });
  }

  // Behavioral test: immune players cannot be voted for
  it('immune players (top 3 silver) excluded from targets', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ALIVE' },
      p2: { silver: 40, status: 'ALIVE' },
      p3: { silver: 35, status: 'ALIVE' },
      p4: { silver: 30, status: 'ALIVE' },
      p5: { silver: 25, status: 'ALIVE' },
    });
    const actor = createActor(stubBubble, { input: makeInput(roster) });
    actor.start();

    // Try voting for immune player p0 — should be ignored
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p3', targetId: 'p0' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const snap = actor.getSnapshot();
    expect(snap.context.votes).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// MAJORITY MACHINE
// ---------------------------------------------------------------------------

describe('Majority Machine', () => {
  for (const scenario of MAJORITY_SCENARIOS) {
    it(scenario.name, () => {
      const roster = buildRoster(scenario.roster);
      const actor = createActor(stubMajority, { input: makeInput(roster) });
      actor.start();

      for (const [voterId, targetId] of Object.entries(scenario.votes ?? {})) {
        actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: voterId, targetId });
      }
      actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

      const result = doneOutput(actor);
      expect(result.eliminatedId).toBe(scenario.expected.eliminatedId);
      expect(result.mechanism).toBe('MAJORITY');
    });
  }

  // Behavioral: ineligible voter is rejected
  it('ineligible voter is rejected — fallback eliminates lowest silver', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ALIVE' },
      p2: { silver: 40, status: 'ALIVE' },
      p3: { silver: 35, status: 'ALIVE' },
      p4: { silver: 30, status: 'ELIMINATED' },
    });
    const actor = createActor(stubMajority, { input: makeInput(roster) });
    actor.start();

    // p4 (eliminated) tries to vote — should be ignored
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p4', targetId: 'p0' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // No valid votes → fallback: lowest silver among alive (p3=35)
    expect(result.eliminatedId).toBe('p3');
  });

  // Behavioral: last vote overrides previous
  it('last vote from same voter overrides previous vote', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ALIVE' },
      p2: { silver: 40, status: 'ALIVE' },
      p3: { silver: 35, status: 'ALIVE' },
      p4: { silver: 30, status: 'ALIVE' },
    });
    const actor = createActor(stubMajority, { input: makeInput(roster) });
    actor.start();

    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p0', targetId: 'p1' });
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p0', targetId: 'p2' }); // override
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const snap = actor.getSnapshot();
    expect(snap.context.votes['p0']).toBe('p2');
  });
});

// ---------------------------------------------------------------------------
// EXECUTIONER MACHINE
// ---------------------------------------------------------------------------

describe('Executioner Machine', () => {
  for (const scenario of EXECUTIONER_SCENARIOS) {
    it(scenario.name, () => {
      const roster = buildRoster(scenario.roster);
      const actor = createActor(stubExecutioner, { input: makeInput(roster) });
      actor.start();

      // Phase 1: election votes
      for (const [voterId, targetId] of Object.entries(scenario.phase1Votes ?? {})) {
        actor.send({ type: VoteEvents.EXECUTIONER.ELECT, senderId: voterId, targetId });
      }
      actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

      // If no executioner was elected, machine goes straight to completed
      if (scenario.expected.executionerId === null) {
        const result = doneOutput(actor);
        expect(result.eliminatedId).toBe(scenario.expected.eliminatedId);
        expect(result.mechanism).toBe('EXECUTIONER');
        if (scenario.expected.reason) {
          expect(result.summary.reason).toBe(scenario.expected.reason);
        }
        return;
      }

      // Verify executioner was elected correctly
      const snap = actor.getSnapshot();
      expect(snap.value).toBe('executionerPicking');
      expect(snap.context.executionerId).toBe(scenario.expected.executionerId);

      // Phase 2: executioner picks
      if (scenario.phase2Action) {
        actor.send({
          type: VoteEvents.EXECUTIONER.PICK,
          senderId: scenario.phase2Action.actorId,
          targetId: scenario.phase2Action.targetId,
        });

        const result = doneOutput(actor);
        expect(result.eliminatedId).toBe(scenario.expected.eliminatedId);
        expect(result.mechanism).toBe('EXECUTIONER');
      }
    });
  }

  // Behavioral: executioner can't pick immune players (top 3 silver)
  it("executioner can't pick immune players (top 3 silver)", () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ALIVE' },
      p2: { silver: 40, status: 'ALIVE' },
      p3: { silver: 35, status: 'ALIVE' },
      p4: { silver: 30, status: 'ALIVE' },
      p5: { silver: 25, status: 'ALIVE' },
    });
    const actor = createActor(stubExecutioner, { input: makeInput(roster) });
    actor.start();

    // Elect p3
    actor.send({ type: VoteEvents.EXECUTIONER.ELECT, senderId: 'p0', targetId: 'p3' });
    actor.send({ type: VoteEvents.EXECUTIONER.ELECT, senderId: 'p1', targetId: 'p3' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const snap = actor.getSnapshot();
    // eligible pick targets should exclude top3 (p0,p1,p2) and executioner (p3)
    expect(snap.context.eligibleTargets).not.toContain('p0');
    expect(snap.context.eligibleTargets).not.toContain('p1');
    expect(snap.context.eligibleTargets).not.toContain('p2');
    expect(snap.context.eligibleTargets).not.toContain('p3');
    expect(snap.context.eligibleTargets).toContain('p4');
    expect(snap.context.eligibleTargets).toContain('p5');
  });

  // Behavioral: non-executioner can't pick
  it("non-executioner can't pick", () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ALIVE' },
      p2: { silver: 40, status: 'ALIVE' },
      p3: { silver: 35, status: 'ALIVE' },
      p4: { silver: 30, status: 'ALIVE' },
      p5: { silver: 25, status: 'ALIVE' },
    });
    const actor = createActor(stubExecutioner, { input: makeInput(roster) });
    actor.start();

    actor.send({ type: VoteEvents.EXECUTIONER.ELECT, senderId: 'p0', targetId: 'p3' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    expect(actor.getSnapshot().value).toBe('executionerPicking');

    // p0 (not executioner) tries to pick — guard rejects
    actor.send({ type: VoteEvents.EXECUTIONER.PICK, senderId: 'p0', targetId: 'p5' });
    expect(actor.getSnapshot().value).toBe('executionerPicking'); // still waiting

    // p3 (executioner) picks — accepted
    actor.send({ type: VoteEvents.EXECUTIONER.PICK, senderId: 'p3', targetId: 'p5' });
    expect(actor.getSnapshot().status).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// PODIUM SACRIFICE MACHINE
// ---------------------------------------------------------------------------

describe('Podium Sacrifice Machine', () => {
  for (const scenario of PODIUM_SACRIFICE_SCENARIOS) {
    it(scenario.name, () => {
      const roster = buildRoster(scenario.roster);
      const actor = createActor(stubPodiumSacrifice, { input: makeInput(roster) });
      actor.start();

      for (const [voterId, targetId] of Object.entries(scenario.votes ?? {})) {
        actor.send({ type: VoteEvents.PODIUM_SACRIFICE.CAST, senderId: voterId, targetId });
      }
      actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

      const result = doneOutput(actor);
      expect(result.eliminatedId).toBe(scenario.expected.eliminatedId);
      expect(result.mechanism).toBe('PODIUM_SACRIFICE');
    });
  }

  // Behavioral: podium correctly identified as top 3 silver
  it('podium is correctly top 3 silver holders', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ALIVE' },
      p2: { silver: 40, status: 'ALIVE' },
      p3: { silver: 35, status: 'ALIVE' },
      p4: { silver: 30, status: 'ALIVE' },
      p5: { silver: 25, status: 'ALIVE' },
    });
    const actor = createActor(stubPodiumSacrifice, { input: makeInput(roster) });
    actor.start();

    const snap = actor.getSnapshot();
    expect(snap.context.podiumPlayerIds).toEqual(expect.arrayContaining(['p0', 'p1', 'p2']));
    expect(snap.context.podiumPlayerIds).toHaveLength(3);
    // Voters should be p3, p4, p5
    expect(snap.context.eligibleVoters).toEqual(expect.arrayContaining(['p3', 'p4', 'p5']));
    expect(snap.context.eligibleVoters).not.toContain('p0');
  });

  // Behavioral: non-podium player cannot be voted for
  it('non-podium player cannot be voted for', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ALIVE' },
      p2: { silver: 40, status: 'ALIVE' },
      p3: { silver: 35, status: 'ALIVE' },
      p4: { silver: 30, status: 'ALIVE' },
      p5: { silver: 25, status: 'ALIVE' },
    });
    const actor = createActor(stubPodiumSacrifice, { input: makeInput(roster) });
    actor.start();

    // Try voting for p4 (not on podium) — should be ignored
    actor.send({ type: VoteEvents.PODIUM_SACRIFICE.CAST, senderId: 'p3', targetId: 'p4' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    expect(actor.getSnapshot().context.votes).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// SHIELD MACHINE
// ---------------------------------------------------------------------------

describe('Shield Machine', () => {
  // Shield uses random tiebreaks — deterministic scenarios checked exactly,
  // random scenarios checked for membership in the valid set.

  for (const scenario of SHIELD_SCENARIOS) {
    it(scenario.name, () => {
      const roster = buildRoster(scenario.roster);
      const actor = createActor(stubShield, { input: makeInput(roster) });
      actor.start();

      for (const [voterId, targetId] of Object.entries(scenario.votes ?? {})) {
        actor.send({ type: VoteEvents.SHIELD.SAVE, senderId: voterId, targetId });
      }
      actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

      const result = doneOutput(actor);
      expect(result.mechanism).toBe('SHIELD');

      if (scenario.expected.reason === 'random_tiebreak') {
        // For random tiebreak scenarios, check the eliminated player is from valid pool
        const aliveIds = Object.entries(scenario.roster)
          .filter(([, p]) => p.status === 'ALIVE')
          .map(([id]) => id);

        // Compute save counts to determine valid elimination candidates
        const saveCounts: Record<string, number> = {};
        for (const id of aliveIds) saveCounts[id] = 0;
        for (const targetId of Object.values(scenario.votes ?? {})) {
          saveCounts[targetId] = (saveCounts[targetId] || 0) + 1;
        }
        const minSaves = Math.min(...Object.values(saveCounts));
        const tied = Object.entries(saveCounts)
          .filter(([, count]) => count === minSaves)
          .map(([id]) => id);

        expect(tied).toContain(result.eliminatedId);
      } else {
        expect(result.eliminatedId).toBe(scenario.expected.eliminatedId);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// FINALS MACHINE
// ---------------------------------------------------------------------------

describe('Finals Machine', () => {
  for (const scenario of FINALS_SCENARIOS) {
    it(scenario.name, () => {
      const roster = buildRoster(scenario.roster);
      const actor = createActor(stubFinals, { input: makeInput(roster) });
      actor.start();

      for (const [voterId, targetId] of Object.entries(scenario.votes ?? {})) {
        actor.send({ type: VoteEvents.FINALS.CAST, senderId: voterId, targetId });
      }
      actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

      const result = doneOutput(actor);
      expect(result.mechanism).toBe('FINALS');
      expect((result as any).winnerId).toBe(scenario.expected.winnerId);
      // Finals eliminatedId = first loser (non-winner alive player)
      expect(result.eliminatedId).toBe(scenario.expected.eliminatedId);
      if (scenario.expected.reason) {
        expect(result.summary.tieBreaker).toBe(scenario.expected.reason);
      }
    });
  }

  // Behavioral: alive players cannot vote (only eliminated can)
  it('alive players cannot vote (only eliminated can)', () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ALIVE' },
      p2: { silver: 40, status: 'ALIVE' },
      p3: { silver: 35, status: 'ELIMINATED' },
      p4: { silver: 30, status: 'ELIMINATED' },
    });
    const actor = createActor(stubFinals, { input: makeInput(roster) });
    actor.start();

    // p0 (alive) tries to vote — should be rejected
    actor.send({ type: VoteEvents.FINALS.CAST, senderId: 'p0', targetId: 'p1' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    // Vote should not be recorded
    const snap = actor.getSnapshot();
    expect(snap.context.votes).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// TRUST PAIRS MACHINE
// ---------------------------------------------------------------------------

describe('Trust Pairs Machine', () => {
  for (const scenario of TRUST_PAIRS_SCENARIOS) {
    it(scenario.name, () => {
      const roster = buildRoster(scenario.roster);
      const actor = createActor(stubTrustPairs, { input: makeInput(roster) });
      actor.start();

      // Phase 1: trust picks
      for (const [voterId, targetId] of Object.entries(scenario.trustPicks ?? {})) {
        actor.send({ type: VoteEvents.TRUST_PAIRS.TRUST, senderId: voterId, targetId });
      }

      // Phase 2: elimination picks
      for (const [voterId, targetId] of Object.entries(scenario.eliminatePicks ?? {})) {
        actor.send({ type: VoteEvents.TRUST_PAIRS.ELIMINATE, senderId: voterId, targetId });
      }

      actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

      const result = doneOutput(actor);
      expect(result.eliminatedId).toBe(scenario.expected.eliminatedId);
      expect(result.mechanism).toBe('TRUST_PAIRS');
      if (scenario.expected.immune) {
        expect(result.summary.immunePlayerIds).toEqual(
          expect.arrayContaining(scenario.expected.immune),
        );
        expect(result.summary.immunePlayerIds).toHaveLength(scenario.expected.immune.length);
      }
    });
  }

  // Behavioral: can't trust self
  it("can't trust self", () => {
    const roster = buildRoster({
      p0: { silver: 50, status: 'ALIVE' },
      p1: { silver: 45, status: 'ALIVE' },
      p2: { silver: 40, status: 'ALIVE' },
      p3: { silver: 35, status: 'ALIVE' },
      p4: { silver: 30, status: 'ALIVE' },
    });
    const actor = createActor(stubTrustPairs, { input: makeInput(roster) });
    actor.start();

    actor.send({ type: VoteEvents.TRUST_PAIRS.TRUST, senderId: 'p0', targetId: 'p0' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const snap = actor.getSnapshot();
    expect(snap.context.trustPicks).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// SECOND TO LAST MACHINE
// ---------------------------------------------------------------------------

describe('Second To Last Machine', () => {
  for (const scenario of SECOND_TO_LAST_SCENARIOS) {
    it(scenario.name, () => {
      const roster = buildRoster(scenario.roster);
      const actor = createActor(stubSecondToLast, { input: makeInput(roster) });
      actor.start();

      const result = doneOutput(actor);
      expect(result.eliminatedId).toBe(scenario.expected.eliminatedId);
      expect(result.mechanism).toBe('SECOND_TO_LAST');
    });
  }
});
