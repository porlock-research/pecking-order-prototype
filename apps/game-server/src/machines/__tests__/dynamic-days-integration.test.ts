import { describe, it, expect, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { orchestratorMachine } from '../l2-orchestrator';
import { Events, PlayerStatuses, VoteEvents } from '@pecking-order/shared-types';
import type { DynamicManifest, PeckingOrderRuleset } from '@pecking-order/shared-types';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeRoster() {
  return {
    p1: { personaName: 'Alice', avatarUrl: '', bio: '', isAlive: true, isSpectator: false, silver: 100, gold: 0, realUserId: 'u1', destinyId: 'd1' },
    p2: { personaName: 'Bob',   avatarUrl: '', bio: '', isAlive: true, isSpectator: false, silver: 80,  gold: 0, realUserId: 'u2', destinyId: 'd2' },
    p3: { personaName: 'Carol', avatarUrl: '', bio: '', isAlive: true, isSpectator: false, silver: 60,  gold: 0, realUserId: 'u3', destinyId: 'd3' },
    p4: { personaName: 'Dave',  avatarUrl: '', bio: '', isAlive: true, isSpectator: false, silver: 40,  gold: 0, realUserId: 'u4', destinyId: 'd4' },
  };
}

const RULESET: PeckingOrderRuleset = {
  kind: 'PECKING_ORDER',
  voting: { allowed: ['MAJORITY'] },
  games: { mode: 'NONE', avoidRepeat: false },
  activities: { mode: 'NONE', avoidRepeat: false },
  social: {
    dmChars: { mode: 'FIXED', base: 1200 },
    dmPartners: { mode: 'FIXED', base: 3 },
    dmCost: 1,
    groupDmEnabled: true,
    requireDmInvite: false,
    dmSlotsPerPlayer: 5,
  },
  inactivity: { enabled: false, thresholdDays: 2, action: 'ELIMINATE' },
  dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE' },
};

function makeDynamicManifest(): DynamicManifest {
  return {
    kind: 'DYNAMIC',
    scheduling: 'ADMIN',
    startTime: new Date().toISOString(),
    ruleset: RULESET,
    schedulePreset: 'SMOKE_TEST',
    minPlayers: 3,
    maxPlayers: 4,
    days: [],
  };
}

/** Send SYSTEM.INIT and SYSTEM.WAKEUP to get to Day 1 activeSession */
function initAndStartDay1(actor: ReturnType<typeof createActor>) {
  actor.send({
    type: Events.System.INIT,
    gameId: 'test-dynamic-1',
    inviteCode: 'TEST',
    payload: { roster: makeRoster(), manifest: makeDynamicManifest() },
  } as any);
  actor.send({ type: Events.System.WAKEUP });
}

/** Open voting, cast majority votes, close voting. */
function runMajorityVoting(actor: ReturnType<typeof createActor>, voters: Array<{ senderId: string; targetId: string }>) {
  actor.send({ type: Events.Admin.INJECT_TIMELINE_EVENT, payload: { action: 'OPEN_VOTING' } } as any);
  for (const { senderId, targetId } of voters) {
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId, targetId } as any);
  }
  actor.send({ type: Events.Admin.INJECT_TIMELINE_EVENT, payload: { action: 'CLOSE_VOTING' } } as any);
}

/** End the current day — transitions to nightSummary */
function endDay(actor: ReturnType<typeof createActor>) {
  actor.send({ type: Events.Admin.INJECT_TIMELINE_EVENT, payload: { action: 'END_DAY' } } as any);
}

/** Start next day from nightSummary */
function startNextDay(actor: ReturnType<typeof createActor>) {
  actor.send({ type: Events.System.WAKEUP });
}

function getCtx(actor: ReturnType<typeof createActor>) {
  return actor.getSnapshot().context as any;
}

function getStateValue(actor: ReturnType<typeof createActor>) {
  return actor.getSnapshot().value;
}

function countAlive(actor: ReturnType<typeof createActor>): number {
  const roster = getCtx(actor).roster;
  return Object.values(roster).filter((p: any) => p.status === PlayerStatuses.ALIVE).length;
}

function makeDynamicManifestWithInactivity(thresholdDays = 1): DynamicManifest {
  return {
    kind: 'DYNAMIC',
    scheduling: 'ADMIN',
    startTime: new Date().toISOString(),
    ruleset: {
      ...RULESET,
      inactivity: { enabled: true, thresholdDays, action: 'ELIMINATE' },
    },
    schedulePreset: 'SMOKE_TEST',
    minPlayers: 3,
    maxPlayers: 5,
    days: [],
  };
}

function makeRoster5() {
  return {
    ...makeRoster(),
    p5: { personaName: 'Eve', avatarUrl: '', bio: '', isAlive: true, isSpectator: false, silver: 20, gold: 0, realUserId: 'u5', destinyId: 'd5' },
  };
}

function initWithManifest(actor: ReturnType<typeof createActor>, roster: any, manifest: DynamicManifest) {
  actor.send({
    type: Events.System.INIT,
    gameId: 'test-dynamic-1',
    inviteCode: 'TEST',
    payload: { roster, manifest },
  } as any);
  actor.send({ type: Events.System.WAKEUP });
}

// NOTE: Using ['MAJORITY'] only for voting whitelist. PODIUM_SACRIFICE and BUBBLE
// both have degenerate behavior with 3 alive players (all become podium/immune,
// zero eligible voters). Whitelist cycling is already tested in game-master.test.ts.
describe('Dynamic Days — Multi-day tournament', () => {
  let actor: ReturnType<typeof createActor>;

  afterEach(() => { actor?.stop(); });

  it('drives a 4-player dynamic game through 3 days to completion', () => {
    // FINALS triggers when alive <= 2, not based on dayIndex vs totalDays.
    // 4 players: Day 1 → eliminate → 3 alive, Day 2 → eliminate → 2 alive, Day 3 → FINALS.
    actor = createActor(orchestratorMachine);
    actor.start();

    // ── Init ──
    initAndStartDay1(actor);
    const stateAfterInit = getStateValue(actor);
    expect(stateAfterInit).toHaveProperty('dayLoop');

    // ── Day 1 assertions ──
    let ctx = getCtx(actor);
    expect(ctx.dayIndex).toBe(1);
    expect(ctx.manifest.days).toHaveLength(1);
    expect(ctx.manifest.days[0].dayIndex).toBe(1);
    expect(ctx.manifest.days[0].voteType).toBe('MAJORITY');
    expect(ctx.manifest.days[0].timeline.length).toBeGreaterThan(0);
    expect(ctx.manifest.days[0].nextDayStart).toBeDefined();
    expect(ctx.manifest.days[0].dmCharsPerPlayer).toBe(1200);
    expect(ctx.manifest.days[0].dmPartnersPerPlayer).toBe(3);
    expect(ctx.manifest.days[0].activityType).toBeUndefined();
    expect(ctx.manifest.days[0].dilemmaType).toBeUndefined();

    // ── Day 1 voting: eliminate p4 ──
    runMajorityVoting(actor, [
      { senderId: 'p1', targetId: 'p4' },
      { senderId: 'p2', targetId: 'p4' },
      { senderId: 'p3', targetId: 'p4' },
    ]);

    ctx = getCtx(actor);
    expect(ctx.pendingElimination).not.toBeNull();
    expect(ctx.pendingElimination.eliminatedId).toBe('p4');
    expect(ctx.pendingElimination.mechanism).toBe('MAJORITY');

    endDay(actor);

    ctx = getCtx(actor);
    expect(ctx.roster.p4.status).toBe(PlayerStatuses.ELIMINATED);
    expect(ctx.pendingElimination).toBeNull();
    expect(countAlive(actor)).toBe(3);
    expect(ctx.completedPhases).toHaveLength(1);
    expect(ctx.completedPhases[0].kind).toBe('voting');
    expect(ctx.completedPhases[0].mechanism).toBe('MAJORITY');
    expect(ctx.completedPhases[0].eliminatedId).toBe('p4');

    // ── Day 2: 3 alive → MAJORITY (not FINALS yet) ──
    startNextDay(actor);

    ctx = getCtx(actor);
    expect(ctx.dayIndex).toBe(2);
    expect(ctx.manifest.days).toHaveLength(2);
    expect(ctx.manifest.days[1].dayIndex).toBe(2);
    expect(ctx.manifest.days[1].voteType).toBe('MAJORITY');
    expect(ctx.manifest.days[1].nextDayStart).toBeDefined();
    const dayIndices = ctx.manifest.days.map((d: any) => d.dayIndex);
    expect(new Set(dayIndices).size).toBe(dayIndices.length);

    // ── Day 2 voting: eliminate p3 ──
    runMajorityVoting(actor, [
      { senderId: 'p1', targetId: 'p3' },
      { senderId: 'p2', targetId: 'p3' },
    ]);

    ctx = getCtx(actor);
    expect(ctx.pendingElimination).not.toBeNull();
    expect(ctx.pendingElimination.eliminatedId).toBe('p3');

    endDay(actor);

    ctx = getCtx(actor);
    expect(ctx.roster.p3.status).toBe(PlayerStatuses.ELIMINATED);
    expect(countAlive(actor)).toBe(2);
    expect(ctx.completedPhases).toHaveLength(2);

    // ── Day 3: 2 alive → FINALS ──
    startNextDay(actor);

    ctx = getCtx(actor);
    expect(ctx.dayIndex).toBe(3);
    expect(ctx.manifest.days).toHaveLength(3);
    expect(ctx.manifest.days[2].dayIndex).toBe(3);
    expect(ctx.manifest.days[2].voteType).toBe('FINALS');
    // Last day: nextDayStart should be undefined
    expect(ctx.manifest.days[2].nextDayStart).toBeUndefined();

    // ── Day 3 voting: FINALS — eliminated players vote ──
    actor.send({ type: Events.Admin.INJECT_TIMELINE_EVENT, payload: { action: 'OPEN_VOTING' } } as any);
    // Eliminated players (p3, p4) vote for p1 as winner
    actor.send({ type: VoteEvents.FINALS.CAST, senderId: 'p3', targetId: 'p1' } as any);
    actor.send({ type: VoteEvents.FINALS.CAST, senderId: 'p4', targetId: 'p1' } as any);
    actor.send({ type: Events.Admin.INJECT_TIMELINE_EVENT, payload: { action: 'CLOSE_VOTING' } } as any);

    ctx = getCtx(actor);
    expect(ctx.pendingElimination).not.toBeNull();
    expect(ctx.pendingElimination.winnerId).toBe('p1');
    expect(ctx.pendingElimination.eliminatedId).toBe('p2');
    expect(ctx.pendingElimination.mechanism).toBe('FINALS');

    // End Day 3 → nightSummary → isGameComplete → gameSummary
    endDay(actor);

    ctx = getCtx(actor);
    expect(ctx.winner).not.toBeNull();
    expect(ctx.winner.playerId).toBe('p1');
    expect(ctx.winner.mechanism).toBe('FINALS');
    expect(ctx.completedPhases).toHaveLength(3);

    const finalState = getStateValue(actor);
    expect(finalState).toBe('gameSummary');
  });

  it('grows manifest.days correctly with no duplicates across days', () => {
    actor = createActor(orchestratorMachine);
    actor.start();
    initAndStartDay1(actor);

    let ctx = getCtx(actor);
    expect(ctx.manifest.days).toHaveLength(1);
    expect(ctx.manifest.kind).toBe('DYNAMIC');

    runMajorityVoting(actor, [
      { senderId: 'p1', targetId: 'p4' },
      { senderId: 'p2', targetId: 'p4' },
      { senderId: 'p3', targetId: 'p4' },
    ]);
    endDay(actor);

    startNextDay(actor);
    ctx = getCtx(actor);
    expect(ctx.manifest.days).toHaveLength(2);
    for (const day of ctx.manifest.days) {
      expect(day.timeline.length).toBeGreaterThan(0);
      expect(day.dmCharsPerPlayer).toBeDefined();
      expect(day.dmPartnersPerPlayer).toBeDefined();
    }
    const indices = ctx.manifest.days.map((d: any) => d.dayIndex);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it('stays in nightSummary when game is not complete (requires explicit WAKEUP)', () => {
    actor = createActor(orchestratorMachine);
    actor.start();
    initAndStartDay1(actor);

    runMajorityVoting(actor, [
      { senderId: 'p1', targetId: 'p4' },
      { senderId: 'p2', targetId: 'p4' },
      { senderId: 'p3', targetId: 'p4' },
    ]);
    endDay(actor);

    const state = getStateValue(actor);
    expect(state).toHaveProperty('dayLoop');
    expect((state as any).dayLoop).toBe('nightSummary');

    startNextDay(actor);
    const ctx = getCtx(actor);
    expect(ctx.dayIndex).toBe(2);
  });

  it('does not trigger isDayIndexPastEnd prematurely during normal play', () => {
    actor = createActor(orchestratorMachine);
    actor.start();
    initAndStartDay1(actor);

    let state = getStateValue(actor);
    expect(state).toHaveProperty('dayLoop');
    expect((state as any).dayLoop).not.toBe('gameSummary');

    runMajorityVoting(actor, [
      { senderId: 'p1', targetId: 'p4' },
      { senderId: 'p2', targetId: 'p4' },
      { senderId: 'p3', targetId: 'p4' },
    ]);
    endDay(actor);

    state = getStateValue(actor);
    expect(state).not.toBe('gameSummary');

    startNextDay(actor);
    const ctx = getCtx(actor);
    expect(ctx.dayIndex).toBe(2);
    expect(ctx.manifest.days).toHaveLength(2);
  });
});

describe('Dynamic Days — Partial participation', () => {
  let actor: ReturnType<typeof createActor>;

  afterEach(() => { actor?.stop(); });

  it('eliminates via majority when only 1 of 4 players votes', () => {
    actor = createActor(orchestratorMachine);
    actor.start();
    initAndStartDay1(actor);

    // Only p1 votes — p4 gets 1 vote, that's the majority (only vote)
    runMajorityVoting(actor, [
      { senderId: 'p1', targetId: 'p4' },
    ]);

    const ctx = getCtx(actor);
    expect(ctx.pendingElimination).not.toBeNull();
    expect(ctx.pendingElimination.eliminatedId).toBe('p4');
    expect(ctx.pendingElimination.mechanism).toBe('MAJORITY');

    endDay(actor);
    expect(getCtx(actor).roster.p4.status).toBe(PlayerStatuses.ELIMINATED);
    expect(countAlive(actor)).toBe(3);
  });

  it('falls back to lowest silver when nobody votes', () => {
    actor = createActor(orchestratorMachine);
    actor.start();
    initAndStartDay1(actor);

    // Open voting, then immediately close — zero votes cast
    actor.send({ type: Events.Admin.INJECT_TIMELINE_EVENT, payload: { action: 'OPEN_VOTING' } } as any);
    actor.send({ type: Events.Admin.INJECT_TIMELINE_EVENT, payload: { action: 'CLOSE_VOTING' } } as any);

    const ctx = getCtx(actor);
    expect(ctx.pendingElimination).not.toBeNull();
    // p4 has lowest silver (40) among alive players
    expect(ctx.pendingElimination.eliminatedId).toBe('p4');
    expect(ctx.pendingElimination.mechanism).toBe('MAJORITY');
    expect(ctx.pendingElimination.summary.tallies).toEqual({});

    endDay(actor);
    expect(getCtx(actor).roster.p4.status).toBe(PlayerStatuses.ELIMINATED);
  });
});

describe('Dynamic Days — Inactivity + voting interaction', () => {
  let actor: ReturnType<typeof createActor>;

  afterEach(() => { actor?.stop(); });

  it('applies both voting elimination and inactivity elimination in the same night', () => {
    // 5 players, inactivity threshold=1.
    // Day 1: p1,p2,p3 vote (active), p4,p5 inactive. Vote eliminates p5.
    // Day 1 night: GM records p4 inactive for 1 day.
    // Day 2 morning: GM produces ELIMINATE for p4 (threshold met).
    // Day 2: p1,p2 vote to eliminate p3.
    // Day 2 night: voting eliminates p3, inactivity eliminates p4. Both applied.
    actor = createActor(orchestratorMachine);
    actor.start();
    initWithManifest(actor, makeRoster5(), makeDynamicManifestWithInactivity(1));

    // ── Day 1: p1,p2,p3 vote, p4 and p5 don't participate ──
    runMajorityVoting(actor, [
      { senderId: 'p1', targetId: 'p5' },
      { senderId: 'p2', targetId: 'p5' },
      { senderId: 'p3', targetId: 'p5' },
    ]);
    endDay(actor);

    let ctx = getCtx(actor);
    expect(ctx.roster.p5.status).toBe(PlayerStatuses.ELIMINATED);
    expect(countAlive(actor)).toBe(4); // p1,p2,p3,p4

    // ── Day 2: GM should flag p4 for inactivity elimination ──
    startNextDay(actor);

    // Day 2 voting: p1,p2 eliminate p3 (p4 still inactive)
    runMajorityVoting(actor, [
      { senderId: 'p1', targetId: 'p3' },
      { senderId: 'p2', targetId: 'p3' },
    ]);

    ctx = getCtx(actor);
    expect(ctx.pendingElimination).not.toBeNull();
    expect(ctx.pendingElimination.eliminatedId).toBe('p3');

    endDay(actor);

    // Both eliminations should be applied:
    // - p3 eliminated by voting
    // - p4 eliminated by inactivity
    ctx = getCtx(actor);
    expect(ctx.roster.p3.status).toBe(PlayerStatuses.ELIMINATED);
    expect(ctx.roster.p4.status).toBe(PlayerStatuses.ELIMINATED);
    expect(countAlive(actor)).toBe(2); // p1, p2
  });

  it('inactivity does not eliminate below 2 alive when combined with voting', () => {
    // 4 players, inactivity threshold=1.
    // Day 1: only p1 votes (active), p2,p3,p4 inactive. Vote eliminates p4.
    // Day 1 night: GM records p2,p3 inactive for 1 day.
    // Day 2 morning: GM produces ELIMINATE for p2 AND p3 (both inactive).
    //   But GM's own guard only produces 1 (leaves 2 alive from GM's perspective: 3 alive - 1 = 2).
    // Day 2: p1 votes to eliminate p3.
    // Day 2 night: voting eliminates p3. GM action wants to eliminate p2.
    //   But after pre-applying voting elimination, only 2 alive → GM elimination blocked.
    // Final: 2 alive (p1, p2).
    actor = createActor(orchestratorMachine);
    actor.start();
    initWithManifest(actor, makeRoster(), {
      ...makeDynamicManifestWithInactivity(1),
      maxPlayers: 4,
    });

    // ── Day 1: only p1 votes ──
    runMajorityVoting(actor, [
      { senderId: 'p1', targetId: 'p4' },
    ]);
    endDay(actor);

    let ctx = getCtx(actor);
    expect(ctx.roster.p4.status).toBe(PlayerStatuses.ELIMINATED);
    expect(countAlive(actor)).toBe(3); // p1,p2,p3

    // ── Day 2: GM flags inactive players ──
    startNextDay(actor);

    // p1 votes to eliminate p3
    runMajorityVoting(actor, [
      { senderId: 'p1', targetId: 'p3' },
    ]);
    endDay(actor);

    ctx = getCtx(actor);
    // p3 eliminated by voting
    expect(ctx.roster.p3.status).toBe(PlayerStatuses.ELIMINATED);
    // p2 should NOT be eliminated — would leave only 1 alive
    expect(ctx.roster.p2.status).toBe(PlayerStatuses.ALIVE);
    expect(countAlive(actor)).toBe(2); // p1, p2 — floor respected
  });
});
