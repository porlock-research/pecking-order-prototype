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

  it('always uses FINALS when 2 players remain', () => {
    const input = makeInput({ roster: makeRoster(4, 2) });
    const ctx = resolveAndGetContext(input, 3, makeRoster(4, 2));
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

  it('always uses FINALS when 2 alive even with whitelist', () => {
    const input = makeInput({ roster: makeRoster(4, 2) });
    input.ruleset = {
      ...baseRuleset,
      voting: { allowed: ['EXECUTIONER', 'SHIELD'] },
    };
    const ctx = resolveAndGetContext(input, 3, makeRoster(4, 2));
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
      dilemmas: { mode: 'POOL', allowed: ['SILVER_GAMBIT', 'SPOTLIGHT'], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(['SILVER_GAMBIT', 'SPOTLIGHT']).toContain(ctx.resolvedDay?.dilemmaType);
  });

  it('omits dilemmaType from resolvedDay when dilemmas.allowed is empty', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dilemmas: { mode: 'POOL', allowed: [], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(ctx.resolvedDay?.dilemmaType).toBeUndefined();
  });

  it('avoids repeating dilemma type when avoidRepeat is true', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dilemmas: { mode: 'POOL', allowed: ['SILVER_GAMBIT', 'SPOTLIGHT'], avoidRepeat: true },
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
      dilemmas: { mode: 'SEQUENCE', sequence: ['SILVER_GAMBIT', 'SPOTLIGHT'], avoidRepeat: false },
    };
    const ctx1 = resolveAndGetContext(input, 1);
    expect(ctx1.resolvedDay?.dilemmaType).toBe('SILVER_GAMBIT');
    const ctx2 = resolveAndGetContext(input, 2);
    expect(ctx2.resolvedDay?.dilemmaType).toBe('SPOTLIGHT');
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

describe('Game Master — Multi-day progression (resolveDay output shape)', () => {
  // Simulates a real 6-player game using whitelist ruleset with games + activities.
  // Each day: RESOLVE_DAY → verify manifest → DAY_ENDED → shrink roster → repeat.
  const playTestRuleset: PeckingOrderRuleset = {
    kind: 'PECKING_ORDER',
    voting: {
      allowed: ['MAJORITY', 'EXECUTIONER', 'SHIELD'],
      constraints: [
        { voteType: 'EXECUTIONER', minPlayers: 5 },
        { voteType: 'SHIELD', minPlayers: 4 },
      ],
    },
    games: { allowed: ['TRIVIA', 'GAP_RUN', 'STACKER'], avoidRepeat: true },
    activities: { allowed: ['HOT_TAKE', 'CONFESSION'], avoidRepeat: true },
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

  function makeProgressionInput(playerCount: number): GameMasterInput {
    return {
      roster: makeRoster(playerCount),
      ruleset: playTestRuleset,
      schedulePreset: 'SMOKE_TEST',
      startTime: '2026-03-24T10:00:00.000Z',
      gameHistory: [],
    };
  }

  it('resolves 5 days for 6 players with correct manifest shape each day', () => {
    const input = makeProgressionInput(6);
    const actor = createActor(createGameMasterMachine(), { input });
    actor.start();

    let roster = makeRoster(6);
    let aliveCount = 6;
    const seenVoteTypes: string[] = [];
    const seenGameTypes: string[] = [];

    for (let day = 1; aliveCount > 2; day++) {
      actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: day, roster });
      const ctx = actor.getSnapshot().context;
      const resolved = ctx.resolvedDay!;

      // ── Manifest shape completeness ──
      expect(resolved.dayIndex).toBe(day);
      expect(resolved.theme).toBe(`Day ${day}`);
      expect(resolved.voteType).toBeDefined();
      expect(resolved.gameType).toBeDefined();
      expect(resolved.timeline).toBeDefined();
      expect(resolved.timeline.length).toBeGreaterThan(0);
      expect(resolved.dmCharsPerPlayer).toBe(1200);
      expect(resolved.dmPartnersPerPlayer).toBe(3);

      // ── Timeline has required events ──
      const actions = resolved.timeline.map((e: any) => e.action);
      expect(actions).toContain('OPEN_GROUP_CHAT');
      expect(actions).toContain('OPEN_VOTING');
      expect(actions).toContain('CLOSE_VOTING');
      expect(actions).toContain('END_DAY');
      // Game events present when gameType is not NONE
      if (resolved.gameType !== 'NONE') {
        expect(actions).toContain('START_GAME');
        expect(actions).toContain('END_GAME');
      }

      // ── Timeline timestamps are valid ISO and in order ──
      for (let i = 1; i < resolved.timeline.length; i++) {
        const prev = new Date(resolved.timeline[i - 1].time).getTime();
        const curr = new Date(resolved.timeline[i].time).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }

      // ── Vote type respects minPlayers constraints ──
      if (aliveCount < 5) {
        expect(resolved.voteType).not.toBe('EXECUTIONER');
      }
      if (aliveCount < 4) {
        expect(resolved.voteType).not.toBe('SHIELD');
      }

      // ── FINALS only when 2 alive ──
      if (aliveCount > 2) {
        expect(resolved.voteType).not.toBe('FINALS');
        expect(resolved.nextDayStart).toBeDefined();
      }

      // ── avoidRepeat: game type shouldn't repeat consecutively ──
      if (seenGameTypes.length > 0 && resolved.gameType !== 'NONE') {
        expect(resolved.gameType).not.toBe(seenGameTypes[seenGameTypes.length - 1]);
      }

      seenVoteTypes.push(resolved.voteType);
      if (resolved.gameType !== 'NONE') seenGameTypes.push(resolved.gameType);

      // Simulate elimination: remove last alive player
      actor.send({ type: 'GAME_MASTER.DAY_ENDED', dayIndex: day, roster });
      const eliminatedId = Object.keys(roster).filter(id => roster[id].status === 'ALIVE').pop()!;
      roster = {
        ...roster,
        [eliminatedId]: { ...roster[eliminatedId], status: 'ELIMINATED' } as SocialPlayer,
      };
      aliveCount--;
    }

    // Final day: 2 alive → FINALS
    const finalDay = seenVoteTypes.length + 1;
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: finalDay, roster });
    const finalCtx = actor.getSnapshot().context;
    expect(finalCtx.resolvedDay!.voteType).toBe('FINALS');
    expect(finalCtx.resolvedDay!.nextDayStart).toBeUndefined();

    // Verify we played the right number of days
    expect(seenVoteTypes.length).toBe(4); // 6→5→4→3 (4 non-FINALS days)
    expect(finalDay).toBe(5); // Day 5 is FINALS

    actor.stop();
  });

  it('cycles whitelist voting types across days, filtering by minPlayers', () => {
    // Whitelist: ['MAJORITY', 'EXECUTIONER', 'SHIELD']
    // Cycling: pool[(dayIndex-1) % pool.length] AFTER filtering by minPlayers
    const input = makeProgressionInput(8);
    const actor = createActor(createGameMasterMachine(), { input });
    actor.start();

    // Day 1: 8 alive → full pool, pool[0] = MAJORITY
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 1, roster: makeRoster(8) });
    expect(actor.getSnapshot().context.resolvedDay!.voteType).toBe('MAJORITY');

    // Day 2: 7 alive → full pool, pool[1] = EXECUTIONER
    actor.send({ type: 'GAME_MASTER.DAY_ENDED', dayIndex: 1, roster: makeRoster(8) });
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 2, roster: makeRoster(8, 7) });
    expect(actor.getSnapshot().context.resolvedDay!.voteType).toBe('EXECUTIONER');

    // Day 3: 6 alive → full pool, pool[2] = SHIELD
    actor.send({ type: 'GAME_MASTER.DAY_ENDED', dayIndex: 2, roster: makeRoster(8, 7) });
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 3, roster: makeRoster(8, 6) });
    expect(actor.getSnapshot().context.resolvedDay!.voteType).toBe('SHIELD');

    // Day 4: 5 alive → full pool, pool[0] wraps = MAJORITY
    actor.send({ type: 'GAME_MASTER.DAY_ENDED', dayIndex: 3, roster: makeRoster(8, 6) });
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 4, roster: makeRoster(8, 5) });
    expect(actor.getSnapshot().context.resolvedDay!.voteType).toBe('MAJORITY');

    // Day 5: 4 alive → EXECUTIONER filtered (needs 5), pool = ['MAJORITY','SHIELD']
    //   pool[(5-1) % 2] = pool[0] = MAJORITY
    actor.send({ type: 'GAME_MASTER.DAY_ENDED', dayIndex: 4, roster: makeRoster(8, 5) });
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 5, roster: makeRoster(8, 4) });
    expect(actor.getSnapshot().context.resolvedDay!.voteType).toBe('MAJORITY');

    actor.stop();
  });

  it('falls back when constraints eliminate all whitelist options', () => {
    // 3 alive: EXECUTIONER needs 5, SHIELD needs 4 → both filtered out.
    // Only MAJORITY left (always valid).
    const input = makeProgressionInput(6);
    input.ruleset = {
      ...playTestRuleset,
      voting: {
        allowed: ['EXECUTIONER', 'SHIELD'],
        constraints: [
          { voteType: 'EXECUTIONER', minPlayers: 5 },
          { voteType: 'SHIELD', minPlayers: 4 },
        ],
      },
    };

    const ctx = resolveAndGetContext(input, 1, makeRoster(6, 3));
    // Both filtered by minPlayers, pool empty → fallback to MAJORITY
    expect(ctx.resolvedDay?.voteType).toBe('MAJORITY');
  });

  it('resolveDay output includes game and activity types from whitelist with avoidRepeat', () => {
    const input = makeProgressionInput(4);
    const actor = createActor(createGameMasterMachine(), { input });
    actor.start();

    // Day 1
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 1, roster: makeRoster(4) });
    const day1 = actor.getSnapshot().context.resolvedDay!;
    expect(['TRIVIA', 'GAP_RUN', 'STACKER']).toContain(day1.gameType);
    expect(['HOT_TAKE', 'CONFESSION']).toContain(day1.activityType);

    // Simulate day end with game history
    actor.send({ type: 'GAME_MASTER.DAY_ENDED', dayIndex: 1, roster: makeRoster(4) });

    // Day 2 — game type should differ from Day 1 (avoidRepeat)
    input.gameHistory = [{ gameType: day1.gameType, dayIndex: 1, timestamp: Date.now(), silverRewards: {}, goldContribution: 0, summary: {} }];
    const actor2 = createActor(createGameMasterMachine(), { input });
    actor2.start();
    actor2.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 2, roster: makeRoster(4, 3) });
    const day2 = actor2.getSnapshot().context.resolvedDay!;
    if (day1.gameType !== 'NONE' && day2.gameType !== 'NONE') {
      expect(day2.gameType).not.toBe(day1.gameType);
    }

    actor.stop();
    actor2.stop();
  });

  it('PER_ACTIVE_PLAYER social scaling multiplies by alive count', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      social: {
        ...baseRuleset.social,
        dmChars: { mode: 'PER_ACTIVE_PLAYER', base: 200 },
      },
    };
    // 4 alive players → 200 * 4 = 800
    const ctx = resolveAndGetContext(input, 1);
    expect(ctx.resolvedDay?.dmCharsPerPlayer).toBe(800);

    // 3 alive → 200 * 3 = 600
    const ctx2 = resolveAndGetContext(input, 2, makeRoster(4, 3));
    expect(ctx2.resolvedDay?.dmCharsPerPlayer).toBe(600);
  });
});

describe('Game Master — 10-player full tournament day resolution', () => {
  // Mirrors a real playtest ruleset: diverse voting, games, activities, dilemmas.
  // Drives a full 10→2 player tournament through the GM, verifying each day's
  // manifest is valid and the ruleset is respected.
  const fullRuleset: PeckingOrderRuleset = {
    kind: 'PECKING_ORDER',
    voting: {
      allowed: ['MAJORITY', 'EXECUTIONER', 'BUBBLE', 'PODIUM_SACRIFICE', 'SHIELD', 'TRUST_PAIRS'],
      constraints: [
        { voteType: 'BUBBLE', minPlayers: 6 },
        { voteType: 'TRUST_PAIRS', minPlayers: 5 },
        { voteType: 'PODIUM_SACRIFICE', minPlayers: 5 },
        { voteType: 'EXECUTIONER', minPlayers: 5 },
        { voteType: 'SHIELD', minPlayers: 4 },
      ],
    },
    games: { allowed: ['TRIVIA', 'GAP_RUN', 'SEQUENCE', 'STACKER', 'REACTION_TIME'], avoidRepeat: true },
    activities: { allowed: ['HOT_TAKE', 'CONFESSION', 'PLAYER_PICK', 'WOULD_YOU_RATHER'], avoidRepeat: true },
    dilemmas: { mode: 'POOL', allowed: ['SILVER_GAMBIT', 'SPOTLIGHT', 'GIFT_OR_GRIEF'], avoidRepeat: true },
    social: {
      dmChars: { mode: 'DIMINISHING', base: 1200, floor: 400 },
      dmPartners: { mode: 'FIXED', base: 3 },
      dmCost: 1,
      groupDmEnabled: true,
      requireDmInvite: false,
      dmSlotsPerPlayer: 5,
    },
    inactivity: { enabled: false, thresholdDays: 2, action: 'ELIMINATE' },
    dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE' },
  };

  it('resolves 9 days for 10 players — correct mechanisms each day, FINALS last', () => {
    const input: GameMasterInput = {
      roster: makeRoster(10),
      ruleset: fullRuleset,
      schedulePreset: 'SMOKE_TEST',
      startTime: '2026-03-24T10:00:00.000Z',
      gameHistory: [],
    };
    const actor = createActor(createGameMasterMachine(), { input });
    actor.start();

    let roster = makeRoster(10);
    let alive = 10;

    const dayLog: Array<{
      day: number;
      alive: number;
      voteType: string;
      gameType: string;
      activityType: string;
      dilemmaType: string;
      dmChars: number;
      timelineEvents: number;
      hasInjectPrompt: boolean;
      hasNextDayStart: boolean;
    }> = [];

    const allVoteTypes = fullRuleset.voting.allowed!;
    const allGameTypes = fullRuleset.games.allowed!;
    const allActivityTypes = fullRuleset.activities.allowed!;
    const allDilemmaTypes = fullRuleset.dilemmas!.allowed!;

    // Play through until FINALS
    while (alive > 2) {
      const dayIndex = dayLog.length + 1;
      actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex, roster });
      const ctx = actor.getSnapshot().context;
      const day = ctx.resolvedDay!;

      const entry = {
        day: dayIndex,
        alive,
        voteType: day.voteType,
        gameType: day.gameType,
        activityType: day.activityType || 'NONE',
        dilemmaType: day.dilemmaType || 'NONE',
        dmChars: day.dmCharsPerPlayer!,
        timelineEvents: day.timeline.length,
        hasInjectPrompt: day.timeline.some((e: any) => e.action === 'INJECT_PROMPT'),
        hasNextDayStart: !!day.nextDayStart,
      };
      dayLog.push(entry);

      // ── Assertions per day ──

      // Vote type must be from the allowed list (or FINALS)
      expect([...allVoteTypes, 'FINALS']).toContain(day.voteType);

      // Vote type respects minPlayers constraints
      const constraints = fullRuleset.voting.constraints || [];
      for (const c of constraints) {
        if (day.voteType === c.voteType) {
          expect(alive).toBeGreaterThanOrEqual(c.minPlayers);
        }
      }

      // Not FINALS yet (alive > 2)
      expect(day.voteType).not.toBe('FINALS');

      // Game type from allowed list
      expect([...allGameTypes, 'NONE']).toContain(day.gameType);

      // Activity type from allowed list
      expect([...allActivityTypes, 'NONE']).toContain(day.activityType || 'NONE');

      // Dilemma type from allowed list
      expect([...allDilemmaTypes, 'NONE']).toContain(day.dilemmaType || 'NONE');

      // Timeline has events
      expect(day.timeline.length).toBeGreaterThan(0);

      // GM briefing message present
      expect(entry.hasInjectPrompt).toBe(true);

      // nextDayStart present (not last day)
      expect(day.nextDayStart).toBeDefined();

      // DM chars should be between floor and base (DIMINISHING mode)
      expect(entry.dmChars).toBeGreaterThanOrEqual(400);
      expect(entry.dmChars).toBeLessThanOrEqual(1200);

      // avoidRepeat: game type shouldn't repeat consecutively
      if (dayLog.length >= 2) {
        const prev = dayLog[dayLog.length - 2];
        if (prev.gameType !== 'NONE' && entry.gameType !== 'NONE') {
          expect(entry.gameType).not.toBe(prev.gameType);
        }
        if (prev.activityType !== 'NONE' && entry.activityType !== 'NONE') {
          expect(entry.activityType).not.toBe(prev.activityType);
        }
        if (prev.dilemmaType !== 'NONE' && entry.dilemmaType !== 'NONE') {
          expect(entry.dilemmaType).not.toBe(prev.dilemmaType);
        }
      }

      // Simulate elimination: remove last alive player
      actor.send({ type: 'GAME_MASTER.DAY_ENDED', dayIndex, roster });
      const eliminatedId = Object.keys(roster).filter(id => roster[id].status === 'ALIVE').pop()!;
      roster = { ...roster, [eliminatedId]: { ...roster[eliminatedId], status: 'ELIMINATED' } as SocialPlayer };
      alive--;
    }

    // ── FINALS day ──
    const finalsDay = dayLog.length + 1;
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: finalsDay, roster });
    const finalsCtx = actor.getSnapshot().context;
    const finals = finalsCtx.resolvedDay!;

    expect(finals.voteType).toBe('FINALS');
    expect(finals.nextDayStart).toBeUndefined();
    expect(finals.timeline.some((e: any) => e.action === 'INJECT_PROMPT')).toBe(true);

    dayLog.push({
      day: finalsDay,
      alive: 2,
      voteType: 'FINALS',
      gameType: finals.gameType,
      activityType: finals.activityType || 'NONE',
      dilemmaType: finals.dilemmaType || 'NONE',
      dmChars: finals.dmCharsPerPlayer!,
      timelineEvents: finals.timeline.length,
      hasInjectPrompt: true,
      hasNextDayStart: false,
    });

    // ── Summary assertions ──
    expect(dayLog).toHaveLength(9); // 10 players → 9 days (8 regular + FINALS)
    expect(dayLog[dayLog.length - 1].voteType).toBe('FINALS');

    // Every day resolved something
    for (const d of dayLog) {
      expect(d.timelineEvents).toBeGreaterThan(0);
      expect(d.hasInjectPrompt).toBe(true);
    }

    // DM chars should decrease over time (DIMINISHING)
    expect(dayLog[0].dmChars).toBeGreaterThan(dayLog[dayLog.length - 2].dmChars);

    // Print the day log for inspection
    console.log('\n=== 10-Player Tournament Day Log ===');
    console.log('Day | Alive | Vote           | Game           | Activity         | Dilemma        | DM Chars | Events');
    console.log('----|-------|----------------|----------------|------------------|----------------|----------|-------');
    for (const d of dayLog) {
      console.log(
        `  ${d.day} |   ${String(d.alive).padStart(2)} | ${d.voteType.padEnd(14)} | ${d.gameType.padEnd(14)} | ${d.activityType.padEnd(16)} | ${d.dilemmaType.padEnd(14)} | ${String(d.dmChars).padStart(8)} | ${d.timelineEvents}`
      );
    }

    actor.stop();
  });
});
