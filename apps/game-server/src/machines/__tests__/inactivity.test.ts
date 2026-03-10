import { describe, it, expect } from 'vitest';
import {
  createInactivityModule,
  type InactivityState,
} from '../observations/inactivity';
import type { PeckingOrderRuleset, SocialPlayer } from '@pecking-order/shared-types';
import { GameMasterActionTypes, GAME_MASTER_ID } from '@pecking-order/shared-types';

const baseRuleset: PeckingOrderRuleset = {
  kind: 'PECKING_ORDER',
  voting: { mode: 'SEQUENCE', sequence: ['MAJORITY', 'FINALS'] },
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
  inactivity: { enabled: true, thresholdDays: 2, action: 'ELIMINATE' },
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

describe('Inactivity observation module', () => {
  const mod = createInactivityModule();

  describe('init', () => {
    it('initializes playerActivity for all alive players', () => {
      const state = mod.init(makeRoster(4), baseRuleset);
      expect(Object.keys(state.playerActivity)).toHaveLength(4);
      expect(state.playerActivity['p0'].consecutiveInactiveDays).toBe(0);
      expect(state.playerActivity['p0'].lastActiveDayIndex).toBe(0);
    });

    it('skips eliminated players', () => {
      const state = mod.init(makeRoster(4, 2), baseRuleset);
      expect(Object.keys(state.playerActivity)).toHaveLength(2);
      expect(state.playerActivity['p2']).toBeUndefined();
    });
  });

  describe('onFact', () => {
    it('marks a player as active for the current day', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      state = mod.onFact(state, {
        type: 'CHAT_MSG', actorId: 'p0', timestamp: Date.now(),
      });
      expect('p0' in state.activeDuringCurrentDay).toBe(true);
    });

    it('ignores SYSTEM facts', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      state = mod.onFact(state, {
        type: 'ELIMINATION', actorId: 'SYSTEM', timestamp: Date.now(),
      });
      expect(Object.keys(state.activeDuringCurrentDay).length).toBe(0);
    });

    it('ignores GAME_MASTER facts', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      state = mod.onFact(state, {
        type: 'ELIMINATION', actorId: GAME_MASTER_ID, timestamp: Date.now(),
      });
      expect(Object.keys(state.activeDuringCurrentDay).length).toBe(0);
    });
  });

  describe('onDayEnded', () => {
    it('resets consecutive days for active players', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      state.activeDuringCurrentDay['p0'] = true;
      state.playerActivity['p1'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 1 };

      state = mod.onDayEnded(state, 1, makeRoster(4));

      expect(state.playerActivity['p0'].consecutiveInactiveDays).toBe(0);
      expect(state.playerActivity['p0'].lastActiveDayIndex).toBe(1);
      expect(state.playerActivity['p1'].consecutiveInactiveDays).toBe(2);
    });

    it('clears activeDuringCurrentDay set', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      state.activeDuringCurrentDay['p0'] = true;
      state = mod.onDayEnded(state, 1, makeRoster(4));
      expect(Object.keys(state.activeDuringCurrentDay).length).toBe(0);
    });
  });

  describe('onResolveDay', () => {
    it('skips day 1 (no eliminations possible)', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      state.playerActivity['p0'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 5 };
      const result = mod.onResolveDay(state, 1, makeRoster(4), baseRuleset);
      expect(result.actions).toHaveLength(0);
    });

    it('eliminates a player who exceeds threshold', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      state.playerActivity['p0'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 2 };
      const result = mod.onResolveDay(state, 3, makeRoster(4), baseRuleset);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].action).toBe(GameMasterActionTypes.ELIMINATE);
      expect(result.actions[0].playerId).toBe('p0');
    });

    it('does not eliminate if inactivity is disabled', () => {
      const disabledRuleset = {
        ...baseRuleset,
        inactivity: { ...baseRuleset.inactivity, enabled: false },
      };
      let state = mod.init(makeRoster(4), disabledRuleset);
      state.playerActivity['p0'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 5 };
      const result = mod.onResolveDay(state, 3, makeRoster(4), disabledRuleset);
      expect(result.actions).toHaveLength(0);
    });

    it('does not eliminate if it would leave fewer than 2 alive', () => {
      let state = mod.init(makeRoster(4, 2), baseRuleset);
      state.playerActivity['p0'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 5 };
      const result = mod.onResolveDay(state, 3, makeRoster(4, 2), baseRuleset);
      expect(result.actions).toHaveLength(0);
    });

    it('eliminates multiple players but leaves at least 2 alive', () => {
      const roster = makeRoster(5);
      let state = mod.init(roster, baseRuleset);
      state.playerActivity['p0'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 3 };
      state.playerActivity['p1'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 3 };
      state.playerActivity['p2'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 3 };

      const result = mod.onResolveDay(state, 4, roster, baseRuleset);
      expect(result.actions.length).toBe(3);
    });

    it('does not eliminate below threshold', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      state.playerActivity['p0'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 1 };
      const result = mod.onResolveDay(state, 3, makeRoster(4), baseRuleset);
      expect(result.actions).toHaveLength(0);
    });
  });
});
