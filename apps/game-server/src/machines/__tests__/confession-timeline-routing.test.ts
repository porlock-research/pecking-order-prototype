import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { orchestratorMachine } from '../l2-orchestrator';
import { Events, PlayerStatuses } from '@pecking-order/shared-types';
import type { DynamicManifest, PeckingOrderRuleset, SocialPlayer } from '@pecking-order/shared-types';

function makeRoster(ids: string[], eliminatedIds: string[] = []): Record<string, SocialPlayer> {
  const out: Record<string, SocialPlayer> = {};
  ids.forEach((id, i) => {
    out[id] = {
      personaName: `P${i}`,
      avatarUrl: '',
      bio: '',
      isAlive: !eliminatedIds.includes(id),
      isSpectator: false,
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
      destinyId: `d${i}`,
      status: eliminatedIds.includes(id) ? PlayerStatuses.ELIMINATED : PlayerStatuses.ALIVE,
    } as any;
  });
  return out;
}

const BASE_RULESET: PeckingOrderRuleset = {
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

function manifestWith(confessionsEnabled: boolean | 'absent'): DynamicManifest {
  const ruleset: PeckingOrderRuleset =
    confessionsEnabled === 'absent'
      ? BASE_RULESET
      : { ...BASE_RULESET, confessions: { enabled: confessionsEnabled } };
  return {
    kind: 'DYNAMIC',
    scheduling: 'ADMIN',
    startTime: new Date().toISOString(),
    ruleset,
    schedulePreset: 'SMOKE_TEST',
    minPlayers: 2,
    maxPlayers: 4,
    days: [],
  } as any;
}

function bootL2(confessionsEnabled: boolean | 'absent', rosterIds: string[], eliminatedIds: string[] = []) {
  const actor = createActor(orchestratorMachine);
  actor.start();
  actor.send({
    type: Events.System.INIT,
    gameId: 'test-confessions',
    inviteCode: 'CONF',
    payload: { roster: makeRoster(rosterIds, eliminatedIds), manifest: manifestWith(confessionsEnabled) },
  } as any);
  actor.send({ type: Events.System.WAKEUP });
  return actor;
}

function l3Context(actor: ReturnType<typeof createActor>): any {
  const l3 = (actor.getSnapshot() as any).children?.['l3-session'];
  return l3?.getSnapshot().context;
}

function l3Value(actor: ReturnType<typeof createActor>): any {
  const l3 = (actor.getSnapshot() as any).children?.['l3-session'];
  return l3?.getSnapshot().value;
}

describe('L2 timeline routing — START_CONFESSION_CHAT', () => {
  it('forwards to L3 when ruleset.confessions.enabled=true and ≥2 alive', () => {
    const actor = bootL2(true, ['p1', 'p2', 'p3']);
    actor.send({
      type: Events.Admin.INJECT_TIMELINE_EVENT,
      payload: { action: 'START_CONFESSION_CHAT' },
    } as any);
    expect(l3Context(actor)?.confessionPhase.active).toBe(true);
    expect(JSON.stringify(l3Value(actor))).toContain('"confessionLayer":"posting"');
  });

  it('blocks at L2 when ruleset.confessions.enabled=false (does not reach L3)', () => {
    const actor = bootL2(false, ['p1', 'p2', 'p3']);
    actor.send({
      type: Events.Admin.INJECT_TIMELINE_EVENT,
      payload: { action: 'START_CONFESSION_CHAT' },
    } as any);
    expect(l3Context(actor)?.confessionPhase.active).toBe(false);
    expect(JSON.stringify(l3Value(actor))).toContain('"confessionLayer":"idle"');
  });

  it('blocks at L2 when confessions block is absent from ruleset (backward compat)', () => {
    const actor = bootL2('absent', ['p1', 'p2', 'p3']);
    actor.send({
      type: Events.Admin.INJECT_TIMELINE_EVENT,
      payload: { action: 'START_CONFESSION_CHAT' },
    } as any);
    expect(l3Context(actor)?.confessionPhase.active).toBe(false);
  });

  it('blocks at L2 when alive count < 2 (even with confessions enabled)', () => {
    // Boot with 4 alive (to avoid early gameOver), then eliminate 3 from within
    // activeSession so only p1 remains alive → guard trips on < 2.
    const actor = bootL2(true, ['p1', 'p2', 'p3', 'p4']);
    expect(l3Context(actor)?.confessionPhase.active).toBe(false);

    actor.send({ type: 'ADMIN.ELIMINATE_PLAYER', playerId: 'p2' } as any);
    actor.send({ type: 'ADMIN.ELIMINATE_PLAYER', playerId: 'p3' } as any);
    actor.send({ type: 'ADMIN.ELIMINATE_PLAYER', playerId: 'p4' } as any);

    // If the machine transitioned to gameOver, l3 child is gone — but the guard
    // still runs at L2 level. Either way, L3's confessionPhase must not activate.
    actor.send({
      type: Events.Admin.INJECT_TIMELINE_EVENT,
      payload: { action: 'START_CONFESSION_CHAT' },
    } as any);

    const l3 = (actor.getSnapshot() as any).children?.['l3-session'];
    const phase = l3?.getSnapshot().context.confessionPhase;
    expect(phase?.active ?? false).toBe(false);
  });
});

describe('L2 timeline routing — END_CONFESSION_CHAT', () => {
  it('forwards END unconditionally (closes any active phase)', () => {
    const actor = bootL2(true, ['p1', 'p2', 'p3']);
    // open a phase first
    actor.send({
      type: Events.Admin.INJECT_TIMELINE_EVENT,
      payload: { action: 'START_CONFESSION_CHAT' },
    } as any);
    expect(l3Context(actor)?.confessionPhase.active).toBe(true);

    actor.send({
      type: Events.Admin.INJECT_TIMELINE_EVENT,
      payload: { action: 'END_CONFESSION_CHAT' },
    } as any);
    expect(l3Context(actor)?.confessionPhase.active).toBe(false);
    expect(JSON.stringify(l3Value(actor))).toContain('"confessionLayer":"idle"');
  });
});

describe('L2 prefix forwarding — CONFESSION.*', () => {
  it('forwards CONFESSION.POST from client-level event straight to L3', () => {
    const actor = bootL2(true, ['p1', 'p2']);
    // open phase
    actor.send({
      type: Events.Admin.INJECT_TIMELINE_EVENT,
      payload: { action: 'START_CONFESSION_CHAT' },
    } as any);
    expect(l3Context(actor)?.confessionPhase.active).toBe(true);

    // senderId would normally be injected by L1 (see CLAUDE.md rule);
    // in L2-level tests we supply it directly.
    actor.send({
      type: Events.Confession.POST,
      senderId: 'p1',
      channelId: 'CONFESSION-d1',
      text: 'caught in L2 prefix guard and forwarded',
    } as any);

    const posts = l3Context(actor)?.confessionPhase.posts;
    expect(posts).toHaveLength(1);
    expect(posts[0].text).toBe('caught in L2 prefix guard and forwarded');
  });
});
