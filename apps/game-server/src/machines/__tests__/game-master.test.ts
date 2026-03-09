import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { createGameMasterMachine, buildGameMasterContext, type GameMasterInput } from '../game-master';
import type { PeckingOrderRuleset, SocialPlayer } from '@pecking-order/shared-types';

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

function makeInput(overrides?: Partial<GameMasterInput>): GameMasterInput {
  return {
    dayIndex: 1,
    roster: makeRoster(4),
    ruleset: baseRuleset,
    schedulePreset: 'DEFAULT',
    gameHistory: [],
    ...overrides,
  };
}

describe('Game Master context resolution (buildGameMasterContext)', () => {
  it('resolves day 1 with SEQUENCE voting — picks first vote type', () => {
    const ctx = buildGameMasterContext(makeInput());
    expect(ctx.resolvedDay).toBeDefined();
    expect(ctx.resolvedDay?.voteType).toBe('MAJORITY');
    expect(ctx.resolvedDay?.dayIndex).toBe(1);
  });

  it('resolves day 2 with SEQUENCE voting — picks second vote type', () => {
    const ctx = buildGameMasterContext(makeInput({ dayIndex: 2 }));
    expect(ctx.resolvedDay?.voteType).toBe('BUBBLE');
  });

  it('always uses FINALS for the last day', () => {
    // 4 alive players → 3 total days. Day 3 should be FINALS.
    const ctx = buildGameMasterContext(makeInput({ dayIndex: 3 }));
    expect(ctx.resolvedDay?.voteType).toBe('FINALS');
  });

  it('computes totalDays as alivePlayers - 1', () => {
    const ctx = buildGameMasterContext(makeInput());
    expect(ctx.totalDays).toBe(3); // 4 players - 1
  });

  it('respects maxDays cap', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE', maxDays: 2 },
    };
    const ctx = buildGameMasterContext(input);
    expect(ctx.totalDays).toBe(2);
  });

  it('applies DIMINISHING social scaling', () => {
    const input = makeInput({ dayIndex: 3 });
    input.ruleset = {
      ...baseRuleset,
      social: {
        ...baseRuleset.social,
        dmChars: { mode: 'DIMINISHING', base: 1200, floor: 400 },
      },
    };
    const ctx = buildGameMasterContext(input);
    const chars = ctx.resolvedDay?.dmCharsPerPlayer;
    expect(chars).toBeDefined();
    expect(chars!).toBeLessThan(1200);
    expect(chars!).toBeGreaterThanOrEqual(400);
  });

  it('applies FIXED social scaling (no change)', () => {
    const ctx = buildGameMasterContext(makeInput({ dayIndex: 2 }));
    expect(ctx.resolvedDay?.dmCharsPerPlayer).toBe(1200);
    expect(ctx.resolvedDay?.dmPartnersPerPlayer).toBe(3);
  });

  it('resolves NONE game type correctly', () => {
    const ctx = buildGameMasterContext(makeInput());
    expect(ctx.resolvedDay?.gameType).toBe('NONE');
  });

  it('resolves SEQUENCE game type', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      games: { mode: 'SEQUENCE', sequence: ['TRIVIA', 'GAP_RUN'], avoidRepeat: false },
    };
    const ctx = buildGameMasterContext(input);
    expect(ctx.resolvedDay?.gameType).toBe('TRIVIA');
  });

  it('handles fewer alive players (post-elimination)', () => {
    // 6 started, 3 alive → totalDays = 2
    const input = makeInput({ roster: makeRoster(6, 3), dayIndex: 1 });
    const ctx = buildGameMasterContext(input);
    expect(ctx.totalDays).toBe(2);
  });

  it('uses FIXED dayCount mode', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dayCount: { mode: 'FIXED', fixedCount: 5 },
    };
    const ctx = buildGameMasterContext(input);
    expect(ctx.totalDays).toBe(5);
  });

  it('clamps vote sequence when dayIndex exceeds sequence length', () => {
    // sequence: [MAJORITY, BUBBLE, EXECUTIONER, PODIUM_SACRIFICE]
    // 6 alive → 5 total days. Day 4 → index 3 → PODIUM_SACRIFICE, day 5 = FINALS
    const input = makeInput({ roster: makeRoster(6), dayIndex: 4 });
    input.ruleset = {
      ...baseRuleset,
      voting: { mode: 'SEQUENCE', sequence: ['MAJORITY', 'BUBBLE', 'EXECUTIONER', 'PODIUM_SACRIFICE'] },
    };
    const ctx = buildGameMasterContext(input);
    expect(ctx.resolvedDay?.voteType).toBe('PODIUM_SACRIFICE');
  });
});

describe('Game Master actor (XState machine)', () => {
  it('starts in observing state', () => {
    const actor = createActor(createGameMasterMachine(), { input: makeInput() });
    actor.start();
    expect(actor.getSnapshot().value).toBe('observing');
    actor.stop();
  });

  it('accumulates FACT.RECORD events', () => {
    const actor = createActor(createGameMasterMachine(), { input: makeInput() });
    actor.start();
    actor.send({
      type: 'FACT.RECORD',
      fact: { type: 'CHAT_MSG', actorId: 'p0', timestamp: Date.now() },
    });
    actor.send({
      type: 'FACT.RECORD',
      fact: { type: 'DM_SENT', actorId: 'p1', timestamp: Date.now() },
    });
    const ctx = actor.getSnapshot().context;
    expect(ctx.observations.factCounts['CHAT_MSG']).toBe(1);
    expect(ctx.observations.factCounts['DM_SENT']).toBe(1);
    expect(ctx.observations.activePlayerIds).toContain('p0');
    expect(ctx.observations.activePlayerIds).toContain('p1');
    actor.stop();
  });

  it('handles ADMIN.OVERRIDE_NEXT_DAY', () => {
    const actor = createActor(createGameMasterMachine(), { input: makeInput() });
    actor.start();
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
