import { describe, it, expect } from 'vitest';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { Events, FactTypes, PlayerStatuses } from '@pecking-order/shared-types';
import {
  computeOpenConfessionAssignment,
  computeCloseConfessionAssignment,
  isConfessionPostAllowed,
  l3ConfessionActions,
} from '../actions/l3-confession';

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

function fakeEnqueue() {
  const raises: any[] = [];
  return {
    enqueue: { raise: (e: any) => raises.push(e) },
    raises,
  };
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
    expect(next.confessionPhase).toEqual({ active: false, handlesByPlayer: {}, posts: [] });
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

describe('l3-confession — recordConfession action', () => {
  it('appends to posts with handle and raises CONFESSION_POSTED', () => {
    const ctx: any = {
      gameId: 'g1',
      dayIndex: 2,
      roster: roster(['p1', 'p2']),
      channels: {
        'CONFESSION-d2': { id: 'CONFESSION-d2', type: 'CONFESSION', memberIds: ['p1', 'p2'], capabilities: ['CONFESS'], createdBy: 'SYSTEM', createdAt: 1 },
      },
      confessionPhase: {
        active: true,
        handlesByPlayer: { p1: 'Confessor #1', p2: 'Confessor #2' },
        posts: [],
      },
    };
    const event: any = { type: Events.Confession.POST, senderId: 'p1', channelId: 'CONFESSION-d2', text: 'the truth is' };
    const { enqueue, raises } = fakeEnqueue();

    const assignSpec = (l3ConfessionActions.recordConfession as any);
    // xstate `assign(fn)` stores the computation on `.assignment`; exercise the function directly.
    const assignmentFn = assignSpec.assignment ?? assignSpec._out?.assignment ?? assignSpec;
    const patch = typeof assignmentFn === 'function'
      ? assignmentFn({ context: ctx, event, enqueue })
      : assignmentFn;

    const next = { ...ctx, confessionPhase: { ...ctx.confessionPhase, ...(patch.confessionPhase || {}) } };

    expect(next.confessionPhase.posts).toHaveLength(1);
    expect(next.confessionPhase.posts[0].handle).toBe('Confessor #1');
    expect(next.confessionPhase.posts[0].text).toBe('the truth is');
    expect(next.confessionPhase.posts[0].ts).toBeGreaterThan(0);

    expect(raises).toHaveLength(1);
    expect(raises[0].type).toBe(Events.Fact.RECORD);
    expect(raises[0].fact.type).toBe(FactTypes.CONFESSION_POSTED);
    expect(raises[0].fact.actorId).toBe('p1');
    expect(raises[0].fact.payload.handle).toBe('Confessor #1');
    expect(raises[0].fact.payload.channelId).toBe('CONFESSION-d2');
    expect(raises[0].fact.payload.dayIndex).toBe(2);
    expect(raises[0].fact.payload.text).toBe('the truth is');
  });

  it('skips write when sender has no handle (defensive: guard should prevent this)', () => {
    const ctx: any = {
      gameId: 'g1',
      dayIndex: 2,
      roster: roster(['p1']),
      channels: {
        'CONFESSION-d2': { id: 'CONFESSION-d2', type: 'CONFESSION', memberIds: ['p1'], capabilities: ['CONFESS'], createdBy: 'SYSTEM', createdAt: 1 },
      },
      confessionPhase: { active: true, handlesByPlayer: {}, posts: [] }, // no handles
    };
    const event: any = { type: Events.Confession.POST, senderId: 'p1', channelId: 'CONFESSION-d2', text: 'x' };
    const { enqueue, raises } = fakeEnqueue();

    const assignSpec = (l3ConfessionActions.recordConfession as any);
    const fn = assignSpec.assignment ?? assignSpec._out?.assignment ?? assignSpec;
    const patch = typeof fn === 'function' ? fn({ context: ctx, event, enqueue }) : fn;

    expect(patch).toEqual({});
    expect(raises).toHaveLength(0);
  });
});

describe('l3-confession — phase fact actions', () => {
  it('emitConfessionPhaseStartedFact raises FACT.RECORD with dayIndex + channelId', () => {
    const ctx: any = { dayIndex: 2, confessionPhase: { active: true, handlesByPlayer: { p1: 'Confessor #1' }, posts: [] } };
    const { enqueue, raises } = fakeEnqueue();
    (l3ConfessionActions.emitConfessionPhaseStartedFact as any)({ context: ctx, enqueue });
    expect(raises).toHaveLength(1);
    expect(raises[0].fact.type).toBe(FactTypes.CONFESSION_PHASE_STARTED);
    expect(raises[0].fact.actorId).toBe('SYSTEM');
    expect(raises[0].fact.payload.dayIndex).toBe(2);
    expect(raises[0].fact.payload.channelId).toBe('CONFESSION-d2');
  });

  it('emitConfessionPhaseEndedFact raises FACT.RECORD with postCount', () => {
    const ctx: any = {
      dayIndex: 2,
      confessionPhase: { active: true, handlesByPlayer: {}, posts: [{}, {}, {}] },
    };
    const { enqueue, raises } = fakeEnqueue();
    (l3ConfessionActions.emitConfessionPhaseEndedFact as any)({ context: ctx, enqueue });
    expect(raises[0].fact.type).toBe(FactTypes.CONFESSION_PHASE_ENDED);
    expect(raises[0].fact.payload.postCount).toBe(3);
    expect(raises[0].fact.payload.dayIndex).toBe(2);
    expect(raises[0].fact.payload.channelId).toBe('CONFESSION-d2');
  });

  it('emitConfessionPhaseEndedFact tolerates empty posts', () => {
    const ctx: any = { dayIndex: 1, confessionPhase: { active: true, handlesByPlayer: {}, posts: [] } };
    const { enqueue, raises } = fakeEnqueue();
    (l3ConfessionActions.emitConfessionPhaseEndedFact as any)({ context: ctx, enqueue });
    expect(raises[0].fact.payload.postCount).toBe(0);
  });
});

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
