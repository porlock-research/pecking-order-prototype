import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { createGameMasterMachine, buildGameMasterContext, type GameMasterInput } from '../game-master';
import type { PeckingOrderRuleset, SocialPlayer } from '@pecking-order/shared-types';
import { GameMasterActionTypes } from '@pecking-order/shared-types';

const baseRuleset: PeckingOrderRuleset = {
  kind: 'PECKING_ORDER',
  voting: { mode: 'SEQUENCE', sequence: ['MAJORITY', 'BUBBLE', 'FINALS'] },
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

function makeRoster(count: number, alive?: number): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  const aliveCount = alive ?? count;
  for (let i = 0; i < count; i++) {
    roster[`p${i}`] = {
      id: `p${i}`,
      personaName: `Player ${i}`,
      avatarUrl: '',
      status: i < aliveCount ? 'ALIVE' : 'ELIMINATED',
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  }
  return roster;
}

function makeInput(overrides?: Partial<GameMasterInput> & { inactivityEnabled?: boolean; thresholdDays?: number }): GameMasterInput {
  const { inactivityEnabled, thresholdDays, ...rest } = overrides ?? {};
  return {
    roster: makeRoster(4),
    ruleset: {
      ...baseRuleset,
      ...(inactivityEnabled !== undefined || thresholdDays !== undefined
        ? {
            inactivity: {
              ...baseRuleset.inactivity,
              enabled: inactivityEnabled ?? baseRuleset.inactivity.enabled,
              thresholdDays: thresholdDays ?? baseRuleset.inactivity.thresholdDays,
            },
          }
        : {}),
    },
    schedulePreset: 'DEFAULT',
    startTime: '2026-01-01T00:00:00.000Z',
    gameHistory: [],
    ...rest,
  };
}

// Helper: create actor, send RESOLVE_DAY, return context
function resolveAndGetContext(input: GameMasterInput, dayIndex: number, roster?: Record<string, SocialPlayer>) {
  const actor = createActor(createGameMasterMachine(), { input });
  actor.start();
  actor.send({
    type: 'GAME_MASTER.RESOLVE_DAY',
    dayIndex,
    roster: roster ?? input.roster,
  });
  const ctx = actor.getSnapshot().context;
  actor.stop();
  return ctx;
}

describe('Game Master day resolution (via RESOLVE_DAY event)', () => {
  it('resolves day 1 with SEQUENCE voting — picks first vote type', () => {
    const ctx = resolveAndGetContext(makeInput(), 1);
    expect(ctx.resolvedDay).toBeDefined();
    expect(ctx.resolvedDay?.voteType).toBe('MAJORITY');
    expect(ctx.resolvedDay?.dayIndex).toBe(1);
  });

  it('resolves day 2 with SEQUENCE voting — picks second vote type', () => {
    const ctx = resolveAndGetContext(makeInput(), 2);
    expect(ctx.resolvedDay?.voteType).toBe('BUBBLE');
  });

  it('always uses FINALS for the last day', () => {
    const ctx = resolveAndGetContext(makeInput(), 3);
    expect(ctx.resolvedDay?.voteType).toBe('FINALS');
  });

  it('computes totalDays as alivePlayers - 1', () => {
    const ctx = resolveAndGetContext(makeInput(), 1);
    expect(ctx.totalDays).toBe(3);
  });

  it('respects maxDays cap', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE', maxDays: 2 },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(ctx.totalDays).toBe(2);
  });

  it('applies DIMINISHING social scaling', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      social: {
        ...baseRuleset.social,
        dmChars: { mode: 'DIMINISHING', base: 1200, floor: 400 },
      },
    };
    const ctx = resolveAndGetContext(input, 3);
    const chars = ctx.resolvedDay?.dmCharsPerPlayer;
    expect(chars).toBeDefined();
    expect(chars!).toBeLessThan(1200);
    expect(chars!).toBeGreaterThanOrEqual(400);
  });

  it('applies FIXED social scaling (no change)', () => {
    const ctx = resolveAndGetContext(makeInput(), 2);
    expect(ctx.resolvedDay?.dmCharsPerPlayer).toBe(1200);
    expect(ctx.resolvedDay?.dmPartnersPerPlayer).toBe(3);
  });

  it('resolves NONE game type correctly', () => {
    const ctx = resolveAndGetContext(makeInput(), 1);
    expect(ctx.resolvedDay?.gameType).toBe('NONE');
  });

  it('resolves SEQUENCE game type', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      games: { mode: 'SEQUENCE', sequence: ['TRIVIA', 'GAP_RUN'], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(ctx.resolvedDay?.gameType).toBe('TRIVIA');
  });

  it('handles fewer alive players (post-elimination)', () => {
    const input = makeInput({ roster: makeRoster(6, 3) });
    const ctx = resolveAndGetContext(input, 1, makeRoster(6, 3));
    expect(ctx.totalDays).toBe(2);
  });

  it('uses FIXED dayCount mode', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dayCount: { mode: 'FIXED', fixedCount: 5 },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(ctx.totalDays).toBe(5);
  });

  it('clamps vote sequence when dayIndex exceeds sequence length', () => {
    const input = makeInput({ roster: makeRoster(6) });
    input.ruleset = {
      ...baseRuleset,
      voting: { mode: 'SEQUENCE', sequence: ['MAJORITY', 'BUBBLE', 'EXECUTIONER', 'PODIUM_SACRIFICE'] },
    };
    const ctx = resolveAndGetContext(input, 4, makeRoster(6));
    expect(ctx.resolvedDay?.voteType).toBe('PODIUM_SACRIFICE');
  });
});

describe('Game Master lifecycle', () => {
  it('starts in pregame state', () => {
    const actor = createActor(createGameMasterMachine(), { input: makeInput() });
    actor.start();
    expect(actor.getSnapshot().value).toBe('pregame');
    actor.stop();
  });

  it('transitions to tournament on GAME_MASTER.RESOLVE_DAY', () => {
    const actor = createActor(createGameMasterMachine(), { input: makeInput() });
    actor.start();
    actor.send({
      type: 'GAME_MASTER.RESOLVE_DAY',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    expect(actor.getSnapshot().value).toBe('tournament');
    actor.stop();
  });

  it('accumulates actions from observation modules on RESOLVE_DAY', () => {
    const actor = createActor(createGameMasterMachine(), { input: makeInput() });
    actor.start();
    actor.send({
      type: 'GAME_MASTER.RESOLVE_DAY',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    expect(actor.getSnapshot().context.gameMasterActions).toEqual([]);
    actor.stop();
  });

  it('transitions to postgame on GAME_MASTER.GAME_ENDED', () => {
    const actor = createActor(createGameMasterMachine(), { input: makeInput() });
    actor.start();
    actor.send({
      type: 'GAME_MASTER.RESOLVE_DAY',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    actor.send({ type: 'GAME_MASTER.GAME_ENDED' });
    expect(actor.getSnapshot().value).toBe('postgame');
    actor.stop();
  });

  it('forwards FACT.RECORD to observation modules in tournament', () => {
    const actor = createActor(createGameMasterMachine(), {
      input: makeInput({ inactivityEnabled: true }),
    });
    actor.start();
    actor.send({
      type: 'GAME_MASTER.RESOLVE_DAY',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    actor.send({
      type: 'FACT.RECORD',
      fact: { type: 'CHAT_MSG', actorId: 'p0', timestamp: Date.now() },
    });
    const ctx = actor.getSnapshot().context;
    expect('p0' in ctx.inactivityState.activeDuringCurrentDay).toBe(true);
    actor.stop();
  });

  it('settles day on GAME_MASTER.DAY_ENDED', () => {
    const actor = createActor(createGameMasterMachine(), {
      input: makeInput({ inactivityEnabled: true }),
    });
    actor.start();
    actor.send({
      type: 'GAME_MASTER.RESOLVE_DAY',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    actor.send({
      type: 'FACT.RECORD',
      fact: { type: 'CHAT_MSG', actorId: 'p0', timestamp: Date.now() },
    });
    actor.send({
      type: 'GAME_MASTER.DAY_ENDED',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    const ctx = actor.getSnapshot().context;
    expect(ctx.inactivityState.playerActivity['p0'].consecutiveInactiveDays).toBe(0);
    expect(ctx.inactivityState.playerActivity['p1'].consecutiveInactiveDays).toBe(1);
    actor.stop();
  });

  it('produces ELIMINATE actions when threshold exceeded', () => {
    const actor = createActor(createGameMasterMachine(), {
      input: makeInput({ inactivityEnabled: true, thresholdDays: 2 }),
    });
    actor.start();

    // Day 1
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 1, roster: makeRoster(4) });
    actor.send({ type: 'GAME_MASTER.DAY_ENDED', dayIndex: 1, roster: makeRoster(4) });

    // Day 2
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 2, roster: makeRoster(4) });
    actor.send({ type: 'GAME_MASTER.DAY_ENDED', dayIndex: 2, roster: makeRoster(4) });

    // Day 3 — resolve should produce ELIMINATE actions
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 3, roster: makeRoster(4) });
    const ctx = actor.getSnapshot().context;
    expect(ctx.gameMasterActions.length).toBe(2); // 4 alive, all inactive, eliminate 2 (leave 2)
    expect(ctx.gameMasterActions[0].action).toBe(GameMasterActionTypes.ELIMINATE);
    actor.stop();
  });

  it('handles ADMIN.OVERRIDE_NEXT_DAY in tournament', () => {
    const actor = createActor(createGameMasterMachine(), { input: makeInput() });
    actor.start();
    actor.send({
      type: 'GAME_MASTER.RESOLVE_DAY',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    actor.send({
      type: 'ADMIN.OVERRIDE_NEXT_DAY',
      day: { voteType: 'EXECUTIONER' as any },
    });
    const ctx = actor.getSnapshot().context;
    expect(ctx.resolvedDay?.voteType).toBe('EXECUTIONER');
    expect(ctx.reasoning).toContain('ADMIN OVERRIDE');
    actor.stop();
  });
});

describe('Game Master whitelist-based resolution', () => {
  it('picks vote type from allowed whitelist', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      voting: { allowed: ['EXECUTIONER', 'SHIELD', 'BUBBLE'] },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(['EXECUTIONER', 'SHIELD', 'BUBBLE']).toContain(ctx.resolvedDay?.voteType);
  });

  it('always uses FINALS on last day even with whitelist', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      voting: { allowed: ['EXECUTIONER', 'SHIELD'] },
    };
    const ctx = resolveAndGetContext(input, 3); // 4 players = 3 days, day 3 = last
    expect(ctx.resolvedDay?.voteType).toBe('FINALS');
  });

  it('picks game type from allowed whitelist', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      games: { allowed: ['TRIVIA', 'GAP_RUN'], avoidRepeat: true },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(['TRIVIA', 'GAP_RUN']).toContain(ctx.resolvedDay?.gameType);
  });

  it('returns NONE for games when allowed is empty', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      games: { allowed: [], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(ctx.resolvedDay?.gameType).toBe('NONE');
  });

  it('resolves activity type from allowed whitelist', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      activities: { allowed: ['CONFESSION', 'HOT_TAKE'], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(['CONFESSION', 'HOT_TAKE']).toContain(ctx.resolvedDay?.activityType);
  });

  it('returns NONE/undefined for activities when allowed is empty', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      activities: { allowed: [], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    // activityType should be undefined or 'NONE' when nothing allowed
    expect(ctx.resolvedDay?.activityType).toBeFalsy();
  });

  it('avoids repeating game types when avoidRepeat is true', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      games: { allowed: ['TRIVIA', 'GAP_RUN', 'SEQUENCE'], avoidRepeat: true },
    };
    const ctx1 = resolveAndGetContext(input, 1);
    // Simulate history from day 1
    input.gameHistory = [{ gameType: ctx1.resolvedDay?.gameType } as any];
    const ctx2 = resolveAndGetContext(input, 2);
    expect(ctx2.resolvedDay?.gameType).not.toBe(ctx1.resolvedDay?.gameType);
  });

  it('filters vote types by minPlayers constraints', () => {
    const input = makeInput({ roster: makeRoster(3) });
    input.ruleset = {
      ...baseRuleset,
      voting: {
        allowed: ['BUBBLE', 'MAJORITY'],
        constraints: [{ voteType: 'BUBBLE', minPlayers: 6 }],
      },
    };
    const ctx = resolveAndGetContext(input, 1, makeRoster(3));
    expect(ctx.resolvedDay?.voteType).toBe('MAJORITY');
  });
});

describe('Game Master dilemma resolution', () => {
  it('omits dilemmaType from resolvedDay when dilemmas is undefined on ruleset', () => {
    // baseRuleset has no dilemmas field — resolveDay() omits it rather than setting 'NONE'
    const ctx = resolveAndGetContext(makeInput(), 1);
    expect(ctx.resolvedDay?.dilemmaType).toBeUndefined();
  });

  it('omits dilemmaType from resolvedDay when dilemmas.mode is NONE', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dilemmas: { mode: 'NONE', avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(ctx.resolvedDay?.dilemmaType).toBeUndefined();
  });

  it('picks dilemma from allowed whitelist', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dilemmas: { allowed: ['PRISONERS_DILEMMA', 'COMMONS_DILEMMA'], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(['PRISONERS_DILEMMA', 'COMMONS_DILEMMA']).toContain(ctx.resolvedDay?.dilemmaType);
  });

  it('omits dilemmaType from resolvedDay when dilemmas.allowed is empty', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dilemmas: { allowed: [], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(ctx.resolvedDay?.dilemmaType).toBeUndefined();
  });

  it('avoids repeating dilemma type when avoidRepeat is true', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dilemmas: { allowed: ['PRISONERS_DILEMMA', 'COMMONS_DILEMMA'], avoidRepeat: true },
    };
    const ctx1 = resolveAndGetContext(input, 1);
    input.gameHistory = [{ dilemmaType: ctx1.resolvedDay?.dilemmaType } as any];
    const ctx2 = resolveAndGetContext(input, 2);
    expect(ctx2.resolvedDay?.dilemmaType).not.toBe(ctx1.resolvedDay?.dilemmaType);
  });

  it('resolves dilemma type from sequence mode', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dilemmas: { mode: 'SEQUENCE', sequence: ['PRISONERS_DILEMMA', 'COMMONS_DILEMMA'], avoidRepeat: false },
    };
    const ctx1 = resolveAndGetContext(input, 1);
    expect(ctx1.resolvedDay?.dilemmaType).toBe('PRISONERS_DILEMMA');
    const ctx2 = resolveAndGetContext(input, 2);
    expect(ctx2.resolvedDay?.dilemmaType).toBe('COMMONS_DILEMMA');
  });
});

describe('resolveDay timeline generation', () => {
  it('generates timeline events from schedule preset', () => {
    const input: GameMasterInput = {
      roster: makeRoster(5),
      ruleset: baseRuleset,
      schedulePreset: 'SPEED_RUN',
      startTime: '2026-03-10T14:00:00.000Z',
      gameHistory: [],
    };
    const actor = createActor(createGameMasterMachine(), { input });
    actor.start();
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 1, roster: input.roster });
    const snap = actor.getSnapshot();
    expect(snap.context.resolvedDay).toBeDefined();
    expect(snap.context.resolvedDay!.timeline.length).toBeGreaterThan(0);
    expect(snap.context.resolvedDay!.nextDayStart).toBeDefined();
    actor.stop();
  });
});
