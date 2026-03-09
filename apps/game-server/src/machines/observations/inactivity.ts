import {
  GameMasterActionTypes,
  GAME_MASTER_ID,
  PlayerStatuses,
} from '@pecking-order/shared-types';
import type {
  SocialPlayer,
  PeckingOrderRuleset,
  GameMasterAction,
} from '@pecking-order/shared-types';
import type { ObservationModule } from './types';

export interface InactivityState {
  playerActivity: Record<string, {
    lastActiveDayIndex: number;
    consecutiveInactiveDays: number;
  }>;
  activeDuringCurrentDay: Set<string>;
}

const SYSTEM_ACTORS = ['SYSTEM', GAME_MASTER_ID];
const MIN_ALIVE_PLAYERS = 2;

export function createInactivityModule(): ObservationModule<InactivityState> {
  return {
    init(roster, _ruleset) {
      const playerActivity: InactivityState['playerActivity'] = {};
      for (const [id, player] of Object.entries(roster)) {
        if (player.status === PlayerStatuses.ALIVE) {
          playerActivity[id] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 0 };
        }
      }
      return { playerActivity, activeDuringCurrentDay: new Set() };
    },

    onResolveDay(state, dayIndex, roster, ruleset) {
      const actions: GameMasterAction[] = [];

      // No eliminations on day 1 — no data yet
      if (dayIndex <= 1) return { state, actions };

      // Skip if inactivity rules are disabled
      if (!ruleset.inactivity.enabled) return { state, actions };

      const threshold = ruleset.inactivity.thresholdDays;
      const aliveIds = Object.entries(roster)
        .filter(([, p]) => p.status === PlayerStatuses.ALIVE)
        .map(([id]) => id);

      let aliveCount = aliveIds.length;

      for (const playerId of aliveIds) {
        if (aliveCount <= MIN_ALIVE_PLAYERS) break;

        const activity = state.playerActivity[playerId];
        if (!activity) continue;

        if (activity.consecutiveInactiveDays >= threshold) {
          actions.push({
            action: GameMasterActionTypes.ELIMINATE,
            playerId,
            reason: `Inactive for ${activity.consecutiveInactiveDays} consecutive days (threshold: ${threshold})`,
          });
          aliveCount--;
        }
      }

      return { state, actions };
    },

    onFact(state, fact) {
      // Only track player-originated facts, not system/game-master facts
      if (!fact.actorId || SYSTEM_ACTORS.includes(fact.actorId)) return state;

      // Only track players who are in our activity map
      if (!state.playerActivity[fact.actorId]) return state;

      if (state.activeDuringCurrentDay.has(fact.actorId)) return state;

      return {
        ...state,
        activeDuringCurrentDay: new Set([...state.activeDuringCurrentDay, fact.actorId]),
      };
    },

    onDayEnded(state, dayIndex, roster) {
      const updated: InactivityState['playerActivity'] = {};

      for (const [id, activity] of Object.entries(state.playerActivity)) {
        // Skip players no longer alive
        const player = roster[id];
        if (!player || player.status !== PlayerStatuses.ALIVE) continue;

        if (state.activeDuringCurrentDay.has(id)) {
          updated[id] = { lastActiveDayIndex: dayIndex, consecutiveInactiveDays: 0 };
        } else {
          updated[id] = {
            lastActiveDayIndex: activity.lastActiveDayIndex,
            consecutiveInactiveDays: activity.consecutiveInactiveDays + 1,
          };
        }
      }

      return { playerActivity: updated, activeDuringCurrentDay: new Set() };
    },
  };
}
