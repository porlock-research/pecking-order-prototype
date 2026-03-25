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
  /** Tracks which players have been active during the current day. Uses Record instead of Set for JSON serialization compatibility (XState snapshot persistence). */
  activeDuringCurrentDay: Record<string, true>;
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
      return { playerActivity, activeDuringCurrentDay: {} };
    },

    onResolveDay(state, dayIndex, roster, ruleset) {
      const actions: GameMasterAction[] = [];

      // Hydrate players who joined after GM was spawned (DYNAMIC games
      // init with empty roster, players arrive via PLAYER_JOINED)
      const updatedActivity = { ...state.playerActivity };
      for (const [id, player] of Object.entries(roster)) {
        if (player.status === PlayerStatuses.ALIVE && !updatedActivity[id]) {
          updatedActivity[id] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 0 };
        }
      }
      const updatedState = { ...state, playerActivity: updatedActivity };

      // No eliminations on day 1 — no data yet
      if (dayIndex <= 1) return { state: updatedState, actions };

      // Skip if inactivity rules are disabled
      if (!ruleset.inactivity.enabled) return { state: updatedState, actions };

      const threshold = ruleset.inactivity.thresholdDays;
      const aliveIds = Object.entries(roster)
        .filter(([, p]) => p.status === PlayerStatuses.ALIVE)
        .map(([id]) => id);

      let aliveCount = aliveIds.length;

      for (const playerId of aliveIds) {
        if (aliveCount <= MIN_ALIVE_PLAYERS) break;

        const activity = updatedActivity[playerId];
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

      return { state: updatedState, actions };
    },

    onFact(state, fact) {
      // Only track player-originated facts, not system/game-master facts
      if (!fact.actorId || SYSTEM_ACTORS.includes(fact.actorId)) return state;

      // Only track players who are in our activity map
      if (!state.playerActivity[fact.actorId]) return state;

      if (fact.actorId in state.activeDuringCurrentDay) return state;

      return {
        ...state,
        activeDuringCurrentDay: { ...state.activeDuringCurrentDay, [fact.actorId]: true as const },
      };
    },

    onDayEnded(state, dayIndex, roster) {
      const updated: InactivityState['playerActivity'] = {};

      for (const [id, activity] of Object.entries(state.playerActivity)) {
        // Skip players no longer alive
        const player = roster[id];
        if (!player || player.status !== PlayerStatuses.ALIVE) continue;

        if (id in state.activeDuringCurrentDay) {
          updated[id] = { lastActiveDayIndex: dayIndex, consecutiveInactiveDays: 0 };
        } else {
          updated[id] = {
            lastActiveDayIndex: activity.lastActiveDayIndex,
            consecutiveInactiveDays: activity.consecutiveInactiveDays + 1,
          };
        }
      }

      return { playerActivity: updated, activeDuringCurrentDay: {} };
    },
  };
}
