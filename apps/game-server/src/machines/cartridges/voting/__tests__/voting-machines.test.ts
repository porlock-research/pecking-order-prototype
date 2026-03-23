import { describe, it, expect } from 'vitest';
import { createActor, type AnyActorRef } from 'xstate';
import { VoteEvents } from '@pecking-order/shared-types';
import type { SocialPlayer, VoteResult } from '@pecking-order/shared-types';

import { bubbleMachine } from '../bubble-machine';
import { majorityMachine } from '../majority-machine';
import { executionerMachine } from '../executioner-machine';
import { podiumSacrificeMachine } from '../podium-sacrifice-machine';
import { shieldMachine } from '../shield-machine';
import { finalsMachine } from '../finals-machine';
import { trustPairsMachine } from '../trust-pairs-machine';
import { secondToLastMachine } from '../second-to-last-machine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoster(
  count: number,
  alive?: number,
  silverOverrides?: Record<string, number>,
): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  const aliveCount = alive ?? count;
  for (let i = 0; i < count; i++) {
    roster[`p${i}`] = {
      id: `p${i}`,
      personaName: `Player ${i}`,
      avatarUrl: '',
      status: i < aliveCount ? 'ALIVE' : 'ELIMINATED',
      silver: silverOverrides?.[`p${i}`] ?? (50 - i * 5),
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  }
  return roster;
}

function makeInput(roster: Record<string, SocialPlayer>, dayIndex = 1) {
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
  // 6 alive players: p0(50), p1(45), p2(40), p3(35), p4(30), p5(25)
  // Top 3 silver = p0, p1, p2 (immune) => eligible targets = p3, p4, p5
  // Eligible voters = all alive
  const roster6 = () => makeRoster(6);

  it('all vote to save same player => that player is safe, a 0-save player eliminated', () => {
    const actor = createActor(stubBubble, { input: makeInput(roster6()) });
    actor.start();

    // All 6 alive voters save p3
    for (let i = 0; i < 6; i++) {
      actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: `p${i}`, targetId: 'p3' });
    }
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // p3 has 6 saves, p4 and p5 have 0 saves => tie-break lowest silver => p5 (25) eliminated
    expect(result.eliminatedId).not.toBe('p3');
    expect(result.eliminatedId).toBe('p5');
    expect(result.mechanism).toBe('BUBBLE');
  });

  it('split votes => player with fewest saves eliminated', () => {
    const actor = createActor(stubBubble, { input: makeInput(roster6()) });
    actor.start();

    // p0,p1,p5 save p3 (3 saves), p2,p3 save p4 (2 saves), p4 saves p5 (1 save)
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p0', targetId: 'p3' });
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p1', targetId: 'p3' });
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p2', targetId: 'p4' });
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p3', targetId: 'p4' });
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p4', targetId: 'p5' });
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p5', targetId: 'p3' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // p3=3 saves, p4=2 saves, p5=1 save => p5 eliminated (fewest saves)
    expect(result.eliminatedId).toBe('p5');
  });

  it('tie in fewest saves => lowest silver eliminated', () => {
    const actor = createActor(stubBubble, { input: makeInput(roster6()) });
    actor.start();

    // p0-p4 save p3 (4 saves), p5 saves p5 (self, 1 save) => p4=0, p5=1 — not a tie
    // Better: p0,p1,p2,p5 save p3 (4), p3 saves p4 (1), p4 saves p5 (1)
    // tallies: p3=4, p4=1, p5=1 => tie between p4(30) and p5(25) => p5 eliminated
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p0', targetId: 'p3' });
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p1', targetId: 'p3' });
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p2', targetId: 'p3' });
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p3', targetId: 'p4' });
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p4', targetId: 'p5' });
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p5', targetId: 'p3' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    expect(result.eliminatedId).toBe('p5');
  });

  it('nobody votes => 0 saves each, tie-break by lowest silver', () => {
    const actor = createActor(stubBubble, { input: makeInput(roster6()) });
    actor.start();

    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // All 3 targets (p3,p4,p5) have 0 saves => tie => lowest silver = p5
    expect(result.eliminatedId).toBe('p5');
  });

  it('immune players (top 3 silver) excluded from targets', () => {
    const actor = createActor(stubBubble, { input: makeInput(roster6()) });
    actor.start();

    // Try voting for immune player p0 — should be ignored
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p3', targetId: 'p0' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const snap = actor.getSnapshot();
    // p0 should not appear in tallies vote count (vote was rejected)
    expect(snap.context.votes).toEqual({});
  });

  it('only 1 save on a player, others have 0 => a 0-save player eliminated, NOT the 1-save player', () => {
    const actor = createActor(stubBubble, { input: makeInput(roster6()) });
    actor.start();

    // Only p0 votes, saves p4
    actor.send({ type: VoteEvents.BUBBLE.CAST, senderId: 'p0', targetId: 'p4' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // p3=0, p4=1, p5=0 => tied at 0: p3(35) vs p5(25) => p5 eliminated
    expect(result.eliminatedId).not.toBe('p4');
    expect(result.eliminatedId).toBe('p5');
  });
});

// ---------------------------------------------------------------------------
// MAJORITY MACHINE
// ---------------------------------------------------------------------------

describe('Majority Machine', () => {
  const roster5 = () => makeRoster(5);

  it('clear majority => most-voted player eliminated', () => {
    const actor = createActor(stubMajority, { input: makeInput(roster5()) });
    actor.start();

    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p0', targetId: 'p2' });
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p1', targetId: 'p2' });
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p2', targetId: 'p0' });
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p3', targetId: 'p2' });
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p4', targetId: 'p0' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    expect(result.eliminatedId).toBe('p2');
    expect(result.mechanism).toBe('MAJORITY');
  });

  it('tie => lowest silver eliminated', () => {
    // p0=50, p1=45, p2=40, p3=35, p4=30
    const actor = createActor(stubMajority, { input: makeInput(roster5()) });
    actor.start();

    // p0 and p4 each get 2 votes
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p1', targetId: 'p0' });
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p2', targetId: 'p0' });
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p0', targetId: 'p4' });
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p3', targetId: 'p4' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // p0=50 silver, p4=30 silver => p4 eliminated (lowest silver in tie)
    expect(result.eliminatedId).toBe('p4');
  });

  it('nobody votes => fallback eliminates lowest silver', () => {
    const actor = createActor(stubMajority, { input: makeInput(roster5()) });
    actor.start();

    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // No votes cast => fallback: lowest silver among eligible targets (all alive)
    // p0=50, p1=45, p2=40, p3=35, p4=30 => p4 eliminated
    expect(result.eliminatedId).toBe('p4');
  });

  it('ineligible voter is rejected => fallback eliminates lowest silver', () => {
    // 5 total, 4 alive => p4 is already eliminated status
    const actor = createActor(stubMajority, { input: makeInput(makeRoster(5, 4)) });
    actor.start();

    // p4 (eliminated) tries to vote — should be ignored
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: 'p4', targetId: 'p0' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // No valid votes => fallback: lowest silver among alive (p0=50,p1=45,p2=40,p3=35) => p3
    expect(result.eliminatedId).toBe('p3');
  });

  it('self-vote is counted (no self-vote prevention)', () => {
    const actor = createActor(stubMajority, { input: makeInput(roster5()) });
    actor.start();

    // Everyone self-votes: each gets 1 vote, tie => lowest silver = p4
    for (let i = 0; i < 5; i++) {
      actor.send({ type: VoteEvents.MAJORITY.CAST, senderId: `p${i}`, targetId: `p${i}` });
    }
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    expect(result.eliminatedId).toBe('p4');
  });

  it('last vote from same voter overrides previous vote', () => {
    const actor = createActor(stubMajority, { input: makeInput(roster5()) });
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
  // 6 alive: p0(50), p1(45), p2(40), p3(35), p4(30), p5(25)
  // Top 3 silver (immune from pick) = p0, p1, p2
  const roster6 = () => makeRoster(6);

  it('election => most-voted becomes executioner => executioner picks target => target eliminated', () => {
    const actor = createActor(stubExecutioner, { input: makeInput(roster6()) });
    actor.start();

    // Election: p0,p1,p2 vote for p3 as executioner
    actor.send({ type: VoteEvents.EXECUTIONER.ELECT, senderId: 'p0', targetId: 'p3' });
    actor.send({ type: VoteEvents.EXECUTIONER.ELECT, senderId: 'p1', targetId: 'p3' });
    actor.send({ type: VoteEvents.EXECUTIONER.ELECT, senderId: 'p2', targetId: 'p3' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    let snap = actor.getSnapshot();
    expect(snap.value).toBe('executionerPicking');
    expect(snap.context.executionerId).toBe('p3');

    // Executioner picks p5
    actor.send({ type: VoteEvents.EXECUTIONER.PICK, senderId: 'p3', targetId: 'p5' });

    const result = doneOutput(actor);
    expect(result.eliminatedId).toBe('p5');
    expect(result.mechanism).toBe('EXECUTIONER');
  });

  it('election tie => lowest silver becomes executioner', () => {
    const actor = createActor(stubExecutioner, { input: makeInput(roster6()) });
    actor.start();

    // p0 votes p3, p1 votes p4 => tie (1 each). p3(silver=35), p4(silver=30) => p4 wins tiebreak (lowest silver)
    actor.send({ type: VoteEvents.EXECUTIONER.ELECT, senderId: 'p0', targetId: 'p3' });
    actor.send({ type: VoteEvents.EXECUTIONER.ELECT, senderId: 'p1', targetId: 'p4' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const snap = actor.getSnapshot();
    expect(snap.context.executionerId).toBe('p4');
  });

  it('zero election votes => fallback eliminates lowest silver among non-immune', () => {
    const actor = createActor(stubExecutioner, { input: makeInput(roster6()) });
    actor.start();

    // Nobody votes in election
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // No executioner elected => fallback: lowest silver among pick targets
    // Top 3 immune: p0(50), p1(45), p2(40). Pick targets: p3(35), p4(30), p5(25) => p5 eliminated
    expect(result.eliminatedId).toBe('p5');
    expect(result.summary.reason).toBe('no_election_votes');
  });

  it("executioner can't pick immune players (top 3 silver)", () => {
    const actor = createActor(stubExecutioner, { input: makeInput(roster6()) });
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

  it("non-executioner can't pick", () => {
    const actor = createActor(stubExecutioner, { input: makeInput(roster6()) });
    actor.start();

    actor.send({ type: VoteEvents.EXECUTIONER.ELECT, senderId: 'p0', targetId: 'p3' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    expect(actor.getSnapshot().value).toBe('executionerPicking');

    // p0 (not executioner) tries to pick => guard rejects
    actor.send({ type: VoteEvents.EXECUTIONER.PICK, senderId: 'p0', targetId: 'p5' });
    expect(actor.getSnapshot().value).toBe('executionerPicking'); // still waiting

    // p3 (executioner) picks => accepted
    actor.send({ type: VoteEvents.EXECUTIONER.PICK, senderId: 'p3', targetId: 'p5' });
    expect(actor.getSnapshot().status).toBe('done');
  });
});

// ---------------------------------------------------------------------------
// PODIUM SACRIFICE MACHINE
// ---------------------------------------------------------------------------

describe('Podium Sacrifice Machine', () => {
  // 6 alive: p0(50), p1(45), p2(40), p3(35), p4(30), p5(25)
  // Podium (top 3 silver) = p0, p1, p2 (targets)
  // Voters = alive - podium = p3, p4, p5
  const roster6 = () => makeRoster(6);

  it('all voters save same podium player => other podium players have 0 saves => one eliminated', () => {
    const actor = createActor(stubPodiumSacrifice, { input: makeInput(roster6()) });
    actor.start();

    // p3,p4,p5 all save p0
    actor.send({ type: VoteEvents.PODIUM_SACRIFICE.CAST, senderId: 'p3', targetId: 'p0' });
    actor.send({ type: VoteEvents.PODIUM_SACRIFICE.CAST, senderId: 'p4', targetId: 'p0' });
    actor.send({ type: VoteEvents.PODIUM_SACRIFICE.CAST, senderId: 'p5', targetId: 'p0' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // p0=3 saves, p1=0, p2=0 => tie at 0: p1(45) vs p2(40) => p2 eliminated (lowest silver)
    expect(result.eliminatedId).toBe('p2');
    expect(result.mechanism).toBe('PODIUM_SACRIFICE');
  });

  it('split saves => fewest-saved podium player eliminated', () => {
    const actor = createActor(stubPodiumSacrifice, { input: makeInput(roster6()) });
    actor.start();

    // p3 saves p0, p4 saves p1, p5 saves p0
    actor.send({ type: VoteEvents.PODIUM_SACRIFICE.CAST, senderId: 'p3', targetId: 'p0' });
    actor.send({ type: VoteEvents.PODIUM_SACRIFICE.CAST, senderId: 'p4', targetId: 'p1' });
    actor.send({ type: VoteEvents.PODIUM_SACRIFICE.CAST, senderId: 'p5', targetId: 'p0' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // p0=2, p1=1, p2=0 => p2 eliminated (fewest saves)
    expect(result.eliminatedId).toBe('p2');
  });

  it('no votes cast => all podium tied at 0 saves => lowest silver eliminated', () => {
    const actor = createActor(stubPodiumSacrifice, { input: makeInput(roster6()) });
    actor.start();

    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // p0=0, p1=0, p2=0 => 3-way tie, lowest silver = p2(40) eliminated
    expect(result.eliminatedId).toBe('p2');
  });

  it('podium is correctly top 3 silver holders', () => {
    const actor = createActor(stubPodiumSacrifice, { input: makeInput(roster6()) });
    actor.start();

    const snap = actor.getSnapshot();
    expect(snap.context.podiumPlayerIds).toEqual(expect.arrayContaining(['p0', 'p1', 'p2']));
    expect(snap.context.podiumPlayerIds).toHaveLength(3);
    // Voters should be p3, p4, p5
    expect(snap.context.eligibleVoters).toEqual(expect.arrayContaining(['p3', 'p4', 'p5']));
    expect(snap.context.eligibleVoters).not.toContain('p0');
  });

  it('non-podium player cannot be voted for', () => {
    const actor = createActor(stubPodiumSacrifice, { input: makeInput(roster6()) });
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
  const roster5 = () => makeRoster(5);

  it('one player gets no shields => eliminated', () => {
    const actor = createActor(stubShield, { input: makeInput(roster5()) });
    actor.start();

    // Everyone shields someone except nobody shields p4
    actor.send({ type: VoteEvents.SHIELD.SAVE, senderId: 'p0', targetId: 'p0' });
    actor.send({ type: VoteEvents.SHIELD.SAVE, senderId: 'p1', targetId: 'p0' });
    actor.send({ type: VoteEvents.SHIELD.SAVE, senderId: 'p2', targetId: 'p1' });
    actor.send({ type: VoteEvents.SHIELD.SAVE, senderId: 'p3', targetId: 'p2' });
    actor.send({ type: VoteEvents.SHIELD.SAVE, senderId: 'p4', targetId: 'p3' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // p0=2, p1=1, p2=1, p3=1, p4=0 => p4 eliminated
    expect(result.eliminatedId).toBe('p4');
    expect(result.mechanism).toBe('SHIELD');
  });

  it('tie in fewest shields => one of the tied is eliminated (random)', () => {
    const actor = createActor(stubShield, { input: makeInput(roster5()) });
    actor.start();

    // p0->p0, p1->p1, p2->p2 (each 1 save), p3 and p4 have 0 saves
    actor.send({ type: VoteEvents.SHIELD.SAVE, senderId: 'p0', targetId: 'p0' });
    actor.send({ type: VoteEvents.SHIELD.SAVE, senderId: 'p1', targetId: 'p1' });
    actor.send({ type: VoteEvents.SHIELD.SAVE, senderId: 'p2', targetId: 'p2' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // p0=1, p1=1, p2=1, p3=0, p4=0 => tie between p3 and p4 => random
    expect(['p3', 'p4']).toContain(result.eliminatedId);
  });

  it('all shields to one player => someone with 0 is eliminated', () => {
    const actor = createActor(stubShield, { input: makeInput(roster5()) });
    actor.start();

    for (let i = 0; i < 5; i++) {
      actor.send({ type: VoteEvents.SHIELD.SAVE, senderId: `p${i}`, targetId: 'p0' });
    }
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // p0=5, p1=0, p2=0, p3=0, p4=0 => tie among p1-p4 => random pick
    expect(result.eliminatedId).not.toBe('p0');
    expect(['p1', 'p2', 'p3', 'p4']).toContain(result.eliminatedId);
  });

  it('nobody votes => all have 0 shields => random elimination', () => {
    const actor = createActor(stubShield, { input: makeInput(roster5()) });
    actor.start();

    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // All 5 at 0 => random
    expect(['p0', 'p1', 'p2', 'p3', 'p4']).toContain(result.eliminatedId);
  });
});

// ---------------------------------------------------------------------------
// FINALS MACHINE
// ---------------------------------------------------------------------------

describe('Finals Machine', () => {
  // Finals: eliminated players vote for alive players to win
  // 5 total, 3 alive (p0,p1,p2), 2 eliminated (p3,p4)
  const roster5 = () => makeRoster(5, 3);

  it('most-voted alive player wins', () => {
    const actor = createActor(stubFinals, { input: makeInput(roster5()) });
    actor.start();

    // p3 and p4 (eliminated) vote for p1
    actor.send({ type: VoteEvents.FINALS.CAST, senderId: 'p3', targetId: 'p1' });
    actor.send({ type: VoteEvents.FINALS.CAST, senderId: 'p4', targetId: 'p1' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    expect((result as any).winnerId).toBe('p1');
    expect(result.mechanism).toBe('FINALS');
  });

  it('tie => highest silver wins', () => {
    const actor = createActor(stubFinals, { input: makeInput(roster5()) });
    actor.start();

    // p3 votes p0, p4 votes p1 => tie, p0(50) vs p1(45) => p0 wins (highest silver)
    actor.send({ type: VoteEvents.FINALS.CAST, senderId: 'p3', targetId: 'p0' });
    actor.send({ type: VoteEvents.FINALS.CAST, senderId: 'p4', targetId: 'p1' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    expect((result as any).winnerId).toBe('p0');
  });

  it('no eliminated voters => highest silver wins', () => {
    // All alive — no eliminated players to vote
    const roster = makeRoster(3, 3);
    const actor = createActor(stubFinals, { input: makeInput(roster) });
    actor.start();

    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // No voters, so falls to highest silver among alive: p0(50)
    expect((result as any).winnerId).toBe('p0');
    expect(result.summary.tieBreaker).toBe('highest_silver_no_voters');
  });

  it('alive players cannot vote (only eliminated can)', () => {
    const actor = createActor(stubFinals, { input: makeInput(roster5()) });
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
  // 5 alive players
  const roster5 = () => makeRoster(5);

  it('mutual trust => both immune from elimination votes', () => {
    const actor = createActor(stubTrustPairs, { input: makeInput(roster5()) });
    actor.start();

    // p0 trusts p1, p1 trusts p0 => mutual pair
    actor.send({ type: VoteEvents.TRUST_PAIRS.TRUST, senderId: 'p0', targetId: 'p1' });
    actor.send({ type: VoteEvents.TRUST_PAIRS.TRUST, senderId: 'p1', targetId: 'p0' });

    // Everyone votes to eliminate p0
    actor.send({ type: VoteEvents.TRUST_PAIRS.ELIMINATE, senderId: 'p2', targetId: 'p0' });
    actor.send({ type: VoteEvents.TRUST_PAIRS.ELIMINATE, senderId: 'p3', targetId: 'p0' });
    actor.send({ type: VoteEvents.TRUST_PAIRS.ELIMINATE, senderId: 'p4', targetId: 'p0' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // p0 is immune (mutual pair with p1), so votes against p0 don't count
    expect(result.eliminatedId).not.toBe('p0');
    expect(result.eliminatedId).not.toBe('p1');
    expect(result.eliminatedId).toBeNull(); // no non-immune votes
    expect(result.summary.mutualPairs).toEqual(expect.arrayContaining([expect.arrayContaining(['p0', 'p1'])]));
  });

  it('one-sided trust => non-immune player can be eliminated', () => {
    const actor = createActor(stubTrustPairs, { input: makeInput(roster5()) });
    actor.start();

    // p0 trusts p1, but p1 trusts p2 => no mutual pair for p0
    actor.send({ type: VoteEvents.TRUST_PAIRS.TRUST, senderId: 'p0', targetId: 'p1' });
    actor.send({ type: VoteEvents.TRUST_PAIRS.TRUST, senderId: 'p1', targetId: 'p2' });

    // Vote to eliminate p0
    actor.send({ type: VoteEvents.TRUST_PAIRS.ELIMINATE, senderId: 'p2', targetId: 'p0' });
    actor.send({ type: VoteEvents.TRUST_PAIRS.ELIMINATE, senderId: 'p3', targetId: 'p0' });
    actor.send({ type: VoteEvents.TRUST_PAIRS.ELIMINATE, senderId: 'p4', targetId: 'p0' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    expect(result.eliminatedId).toBe('p0');
  });

  it('most elimination votes among non-immune => eliminated', () => {
    const actor = createActor(stubTrustPairs, { input: makeInput(roster5()) });
    actor.start();

    // p0 & p1 mutual trust (immune)
    actor.send({ type: VoteEvents.TRUST_PAIRS.TRUST, senderId: 'p0', targetId: 'p1' });
    actor.send({ type: VoteEvents.TRUST_PAIRS.TRUST, senderId: 'p1', targetId: 'p0' });

    // p2,p3 vote for p4; p4 votes for p2
    actor.send({ type: VoteEvents.TRUST_PAIRS.ELIMINATE, senderId: 'p2', targetId: 'p4' });
    actor.send({ type: VoteEvents.TRUST_PAIRS.ELIMINATE, senderId: 'p3', targetId: 'p4' });
    actor.send({ type: VoteEvents.TRUST_PAIRS.ELIMINATE, senderId: 'p4', targetId: 'p2' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    // p4 has 2 votes (non-immune), p2 has 1 vote (non-immune) => p4 eliminated
    expect(result.eliminatedId).toBe('p4');
  });

  it("can't trust self", () => {
    const actor = createActor(stubTrustPairs, { input: makeInput(roster5()) });
    actor.start();

    actor.send({ type: VoteEvents.TRUST_PAIRS.TRUST, senderId: 'p0', targetId: 'p0' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const snap = actor.getSnapshot();
    expect(snap.context.trustPicks).toEqual({});
  });

  it('elimination vote tie among non-immune => lowest silver eliminated', () => {
    const actor = createActor(stubTrustPairs, { input: makeInput(roster5()) });
    actor.start();

    // No trust pairs => no immunity
    // p0 votes p3, p1 votes p4 => tie at 1 vote each
    // p3(silver=35) vs p4(silver=30) => p4 eliminated (lowest silver)
    actor.send({ type: VoteEvents.TRUST_PAIRS.ELIMINATE, senderId: 'p0', targetId: 'p3' });
    actor.send({ type: VoteEvents.TRUST_PAIRS.ELIMINATE, senderId: 'p1', targetId: 'p4' });
    actor.send({ type: 'INTERNAL.CLOSE_VOTING' });

    const result = doneOutput(actor);
    expect(result.eliminatedId).toBe('p4');
  });
});

// ---------------------------------------------------------------------------
// SECOND TO LAST MACHINE
// ---------------------------------------------------------------------------

describe('Second To Last Machine', () => {
  it('second-lowest silver eliminated (not lowest)', () => {
    // p0=50, p1=45, p2=40, p3=35, p4=30
    const roster = makeRoster(5);
    const actor = createActor(stubSecondToLast, { input: makeInput(roster) });
    actor.start();

    const result = doneOutput(actor);
    // Ranking (high to low): p0(50), p1(45), p2(40), p3(35), p4(30)
    // Second-to-last = p3 (index length-2)
    expect(result.eliminatedId).toBe('p3');
    expect(result.mechanism).toBe('SECOND_TO_LAST');
  });

  it('only 1 player alive => that player eliminated (fallback)', () => {
    const roster = makeRoster(3, 1);
    const actor = createActor(stubSecondToLast, { input: makeInput(roster) });
    actor.start();

    const result = doneOutput(actor);
    // Only p0 alive => fallback eliminates the sole remaining player
    expect(result.eliminatedId).toBe('p0');
  });

  it('2 players alive => second-to-last is the top silver holder', () => {
    // Only p0(50) and p1(45) alive
    const roster = makeRoster(3, 2);
    const actor = createActor(stubSecondToLast, { input: makeInput(roster) });
    actor.start();

    const result = doneOutput(actor);
    // Ranking: p0(50), p1(45) => second-to-last (index 0) = p0
    expect(result.eliminatedId).toBe('p0');
  });

  it('custom silver values change elimination target', () => {
    const roster = makeRoster(5, 5, { p0: 10, p1: 20, p2: 30, p3: 40, p4: 50 });
    const actor = createActor(stubSecondToLast, { input: makeInput(roster) });
    actor.start();

    // Ranking (high to low): p4(50), p3(40), p2(30), p1(20), p0(10)
    // Second-to-last = p1
    const result = doneOutput(actor);
    expect(result.eliminatedId).toBe('p1');
  });
});
