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
