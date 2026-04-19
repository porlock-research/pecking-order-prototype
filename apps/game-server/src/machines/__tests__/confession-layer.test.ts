import { describe, it, expect } from 'vitest';
import { createActor, setup } from 'xstate';
import type { SocialPlayer, DailyManifest } from '@pecking-order/shared-types';
import { Events, FactTypes, PlayerStatuses } from '@pecking-order/shared-types';
import {
  computeOpenConfessionAssignment,
  computeCloseConfessionAssignment,
  isConfessionPostAllowed,
  l3ConfessionActions,
} from '../actions/l3-confession';
import { dailySessionMachine } from '../l3-session';

function roster(ids: string[]): Record<string, SocialPlayer> {
  const out: Record<string, SocialPlayer> = {};
  ids.forEach((id, i) => {
    out[id] = {
      id,
      personaName: `Player ${i}`,
      avatarUrl: '',
      status: PlayerStatuses.ALIVE,
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  });
  return out;
}

describe('l3-confession — computeOpenConfessionAssignment', () => {
  it('creates CONFESSION channel with alive members and CONFESS capability', () => {
    const ctx: any = {
      gameId: 'g1',
      dayIndex: 2,
      roster: roster(['p1', 'p2']),
      channels: {},
      confessionPhase: { active: false, handlesByPlayer: {}, posts: [] },
      groupChatOpen: true,
    };
    const patch = computeOpenConfessionAssignment(ctx);
    const next = { ...ctx, ...patch };
    expect(next.channels['CONFESSION-d2']).toBeDefined();
    expect(next.channels['CONFESSION-d2'].type).toBe('CONFESSION');
    expect(next.channels['CONFESSION-d2'].capabilities).toEqual(['CONFESS']);
    expect(next.channels['CONFESSION-d2'].memberIds.sort()).toEqual(['p1', 'p2']);
    expect(next.groupChatOpen).toBe(false);
    expect(Object.keys(next.confessionPhase.handlesByPlayer).sort()).toEqual(['p1', 'p2']);
    expect(next.confessionPhase.active).toBe(true);
    expect(next.confessionPhase.posts).toEqual([]);
  });

  it('excludes eliminated players from memberIds + handles', () => {
    const r = roster(['p1', 'p2', 'p3']);
    r.p3.status = PlayerStatuses.ELIMINATED as any;
    const ctx: any = {
      gameId: 'g1',
      dayIndex: 2,
      roster: r,
      channels: {},
      confessionPhase: { active: false, handlesByPlayer: {}, posts: [] },
      groupChatOpen: true,
    };
    const patch = computeOpenConfessionAssignment(ctx);
    const next = { ...ctx, ...patch };
    expect(next.channels['CONFESSION-d2'].memberIds.sort()).toEqual(['p1', 'p2']);
    expect(next.confessionPhase.handlesByPlayer.p3).toBeUndefined();
    expect(Object.keys(next.confessionPhase.handlesByPlayer).sort()).toEqual(['p1', 'p2']);
  });

  it('handle assignment is deterministic on seed (same gameId/dayIndex → same map)', () => {
    const ctx = (): any => ({
      gameId: 'g1',
      dayIndex: 2,
      roster: roster(['p1', 'p2', 'p3', 'p4']),
      channels: {},
      confessionPhase: { active: false, handlesByPlayer: {}, posts: [] },
      groupChatOpen: true,
    });
    const a = computeOpenConfessionAssignment(ctx()).confessionPhase.handlesByPlayer;
    const b = computeOpenConfessionAssignment(ctx()).confessionPhase.handlesByPlayer;
    expect(a).toEqual(b);
  });

  it('preserves existing non-CONFESSION channels', () => {
    const ctx: any = {
      gameId: 'g1',
      dayIndex: 2,
      roster: roster(['p1', 'p2']),
      channels: {
        MAIN: { id: 'MAIN', type: 'MAIN', memberIds: ['p1', 'p2'], capabilities: ['CHAT'], createdBy: 'SYSTEM', createdAt: 0 },
      },
      confessionPhase: { active: false, handlesByPlayer: {}, posts: [] },
      groupChatOpen: true,
    };
    const patch = computeOpenConfessionAssignment(ctx);
    expect(patch.channels.MAIN).toBeDefined();
    expect(patch.channels['CONFESSION-d2']).toBeDefined();
  });
});

describe('l3-confession — computeCloseConfessionAssignment', () => {
  it('removes the channel, restores groupChatOpen, clears handlesByPlayer + posts', () => {
    const ctx: any = {
      gameId: 'g1',
      dayIndex: 2,
      roster: roster(['p1', 'p2']),
      channels: {
        'CONFESSION-d2': { id: 'CONFESSION-d2', type: 'CONFESSION', memberIds: ['p1', 'p2'], capabilities: ['CONFESS'], createdBy: 'SYSTEM', createdAt: 1 },
        MAIN: { id: 'MAIN', type: 'MAIN', memberIds: ['p1', 'p2'], capabilities: ['CHAT'], createdBy: 'SYSTEM', createdAt: 0 },
      },
      confessionPhase: {
        active: true,
        handlesByPlayer: { p1: 'Confessor #1', p2: 'Confessor #2' },
        posts: [{ handle: 'Confessor #1', text: 'x', ts: 1 }],
      },
      groupChatOpen: false,
    };
    const patch = computeCloseConfessionAssignment(ctx);
    const next = { ...ctx, ...patch };
    expect(next.channels['CONFESSION-d2']).toBeUndefined();
    expect(next.channels.MAIN).toBeDefined();
    expect(next.groupChatOpen).toBe(true);
    expect(next.confessionPhase).toEqual({ active: false, handlesByPlayer: {}, posts: [], closesAt: null });
  });

  it('is idempotent if channel already absent', () => {
    const ctx: any = {
      gameId: 'g1',
      dayIndex: 2,
      roster: roster(['p1']),
      channels: { MAIN: { id: 'MAIN', type: 'MAIN', memberIds: ['p1'], capabilities: ['CHAT'], createdBy: 'SYSTEM', createdAt: 0 } },
      confessionPhase: { active: false, handlesByPlayer: {}, posts: [] },
      groupChatOpen: true,
    };
    const patch = computeCloseConfessionAssignment(ctx);
    expect(patch.channels.MAIN).toBeDefined();
    expect(patch.confessionPhase.active).toBe(false);
    expect(patch.groupChatOpen).toBe(true);
  });
});

// NOTE: recordConfession + emit*Fact actions are wrapped with enqueueActions() so
// their internals (enqueue.raise / enqueue.assign) can't be exercised by direct
// invocation without mocking xstate's action context. They are covered end-to-end
// by the "L3 confessionLayer lifecycle" tests below (CONFESSION.POST appends a
// post + phase-lifecycle tests), which use the real xstate runtime via parentWrapper.

describe('l3-confession — isConfessionPostAllowed guard', () => {
  function baseCtx(): any {
    return {
      dayIndex: 2,
      roster: roster(['p1', 'p2']),
      channels: {
        'CONFESSION-d2': {
          id: 'CONFESSION-d2',
          type: 'CONFESSION',
          memberIds: ['p1', 'p2'],
          capabilities: ['CONFESS'],
          createdBy: 'SYSTEM',
          createdAt: 1,
        },
      },
      confessionPhase: {
        active: true,
        handlesByPlayer: { p1: 'Confessor #1', p2: 'Confessor #2' },
        posts: [],
      },
    };
  }
  const validEvent: any = { type: Events.Confession.POST, senderId: 'p1', channelId: 'CONFESSION-d2', text: 'hello' };

  it('returns true on all rules satisfied', () => {
    expect(isConfessionPostAllowed(baseCtx(), validEvent)).toBe(true);
  });

  it('rule 1: false when phase is inactive', () => {
    const ctx = baseCtx();
    ctx.confessionPhase.active = false;
    expect(isConfessionPostAllowed(ctx, validEvent)).toBe(false);
  });

  it('rule 2: false when channel does not exist', () => {
    const ctx = baseCtx();
    delete ctx.channels['CONFESSION-d2'];
    expect(isConfessionPostAllowed(ctx, validEvent)).toBe(false);
  });

  it('rule 3: false when channel type is not CONFESSION', () => {
    const ctx = baseCtx();
    ctx.channels['CONFESSION-d2'].type = 'MAIN';
    expect(isConfessionPostAllowed(ctx, validEvent)).toBe(false);
  });

  it('rule 4: false when channel lacks CONFESS capability', () => {
    const ctx = baseCtx();
    ctx.channels['CONFESSION-d2'].capabilities = ['CHAT'];
    expect(isConfessionPostAllowed(ctx, validEvent)).toBe(false);
  });

  it('rule 5: false when sender is not in memberIds', () => {
    const ctx = baseCtx();
    ctx.channels['CONFESSION-d2'].memberIds = ['p2'];
    expect(isConfessionPostAllowed(ctx, validEvent)).toBe(false);
  });

  it('rule 6: false when sender is ELIMINATED (R3 P1)', () => {
    const ctx = baseCtx();
    ctx.roster.p1.status = PlayerStatuses.ELIMINATED;
    expect(isConfessionPostAllowed(ctx, validEvent)).toBe(false);
  });

  it('rule 7a: false when text is empty', () => {
    expect(isConfessionPostAllowed(baseCtx(), { ...validEvent, text: '' })).toBe(false);
  });

  it('rule 7b: false when text exceeds Config.confession.maxConfessionLength', () => {
    const long = 'a'.repeat(281);
    expect(isConfessionPostAllowed(baseCtx(), { ...validEvent, text: long })).toBe(false);
  });

  it('rule 7c: true at exact boundary (text.length === 280)', () => {
    const exact = 'a'.repeat(280);
    expect(isConfessionPostAllowed(baseCtx(), { ...validEvent, text: exact })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T9: confessionLayer parallel region — lifecycle via L3 actor
// Uses the parentWrapper pattern because L3's entry calls sendParent().
// ---------------------------------------------------------------------------

const parentWrapper = setup({
  types: {
    context: {} as { l3Ref: any },
    events: {} as any,
    input: {} as { dayIndex: number; roster: Record<string, SocialPlayer>; manifest: DailyManifest },
  },
  actors: { l3: dailySessionMachine },
}).createMachine({
  id: 'test-parent',
  context: { l3Ref: null },
  initial: 'running',
  states: {
    running: {
      invoke: { id: 'l3-session', src: 'l3', input: ({ event }: any) => event.input || {} },
      on: { '*': {} },
    },
    done: { type: 'final' },
  },
} as any);

function createL3Actor(rosterIds: string[]) {
  const input = {
    dayIndex: 2,
    roster: roster(rosterIds),
    manifest: {
      dayIndex: 2,
      voteType: 'MAJORITY',
      gameType: 'NONE',
      timeline: [],
      firstEventTime: '2026-01-01T00:00:00Z',
    } as any,
  };
  const parentActor = createActor(parentWrapper, { input });
  parentActor.start();
  return {
    send: (e: any) => {
      const l3 = parentActor.getSnapshot().children['l3-session'];
      if (l3) (l3 as any).send(e);
    },
    getL3Context: () => {
      const l3 = parentActor.getSnapshot().children['l3-session'];
      return l3 ? (l3 as any).getSnapshot().context : undefined;
    },
    getL3Value: () => {
      const l3 = parentActor.getSnapshot().children['l3-session'];
      return l3 ? (l3 as any).getSnapshot().value : undefined;
    },
    getL3Persisted: () => {
      const l3 = parentActor.getSnapshot().children['l3-session'];
      return l3 ? (l3 as any).getPersistedSnapshot() : undefined;
    },
    stop: () => parentActor.stop(),
  };
}

describe('L3 confessionLayer lifecycle', () => {
  it('idle → posting on INTERNAL.START_CONFESSION_CHAT', () => {
    const actor = createL3Actor(['p1', 'p2', 'p3']);
    actor.send({ type: Events.Internal.START_CONFESSION_CHAT });
    const value = JSON.stringify(actor.getL3Value());
    expect(value).toContain('"confessionLayer":"posting"');
    const ctx = actor.getL3Context();
    expect(ctx.confessionPhase.active).toBe(true);
    expect(Object.keys(ctx.confessionPhase.handlesByPlayer).sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('posting → idle on INTERNAL.END_CONFESSION_CHAT', () => {
    const actor = createL3Actor(['p1', 'p2']);
    actor.send({ type: Events.Internal.START_CONFESSION_CHAT });
    actor.send({ type: Events.Internal.END_CONFESSION_CHAT });
    const value = JSON.stringify(actor.getL3Value());
    expect(value).toContain('"confessionLayer":"idle"');
    expect(actor.getL3Context().confessionPhase.active).toBe(false);
  });

  it('CONFESSION channel appears in context on entry, disappears on exit', () => {
    const actor = createL3Actor(['p1', 'p2']);
    actor.send({ type: Events.Internal.START_CONFESSION_CHAT });
    expect(actor.getL3Context().channels['CONFESSION-d2']).toBeDefined();
    actor.send({ type: Events.Internal.END_CONFESSION_CHAT });
    expect(actor.getL3Context().channels['CONFESSION-d2']).toBeUndefined();
  });

  it('groupChatOpen toggles false/true across the phase lifecycle', () => {
    const actor = createL3Actor(['p1', 'p2']);
    const initial = actor.getL3Context().groupChatOpen;
    expect(typeof initial).toBe('boolean');
    actor.send({ type: Events.Internal.START_CONFESSION_CHAT });
    expect(actor.getL3Context().groupChatOpen).toBe(false);
    actor.send({ type: Events.Internal.END_CONFESSION_CHAT });
    expect(actor.getL3Context().groupChatOpen).toBe(true);
  });

  it('second START while already posting is a no-op (no transition, stable handles)', () => {
    const actor = createL3Actor(['p1', 'p2']);
    actor.send({ type: Events.Internal.START_CONFESSION_CHAT });
    const firstHandles = { ...actor.getL3Context().confessionPhase.handlesByPlayer };
    actor.send({ type: Events.Internal.START_CONFESSION_CHAT }); // self-loop absent → ignored
    expect(actor.getL3Context().confessionPhase.handlesByPlayer).toEqual(firstHandles);
  });

  it('CONFESSION.POST inside posting appends a post and raises CONFESSION_POSTED', () => {
    const actor = createL3Actor(['p1', 'p2']);
    actor.send({ type: Events.Internal.START_CONFESSION_CHAT });
    const senderHandle = actor.getL3Context().confessionPhase.handlesByPlayer.p1;
    actor.send({ type: Events.Confession.POST, senderId: 'p1', channelId: 'CONFESSION-d2', text: 'hi' });
    const posts = actor.getL3Context().confessionPhase.posts;
    expect(posts).toHaveLength(1);
    expect(posts[0].handle).toBe(senderHandle);
    expect(posts[0].text).toBe('hi');
  });

  it('CONFESSION.POST while idle is dropped (no posts recorded)', () => {
    const actor = createL3Actor(['p1', 'p2']);
    actor.send({ type: Events.Confession.POST, senderId: 'p1', channelId: 'CONFESSION-d2', text: 'hi' });
    expect(actor.getL3Context().confessionPhase.active).toBe(false);
    expect(actor.getL3Context().confessionPhase.posts).toEqual([]);
  });
});

