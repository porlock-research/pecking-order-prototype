/**
 * Arcade Machine Factory
 *
 * Generic lifecycle machine for async, per-player, client-rendered minigames.
 * The client renders the entire game and submits a final score payload.
 * The server tracks lifecycle (NOT_STARTED -> PLAYING -> COMPLETED),
 * validates timing, computes rewards, and emits facts.
 *
 * Usage:
 *   const myGameMachine = createArcadeMachine({
 *     gameType: 'MY_GAME',
 *     computeRewards: (result, timeElapsed, timeLimit) => ({ silver: ..., gold: ... }),
 *   });
 */
import { setup, assign, sendParent, enqueueActions, type AnyEventObject } from 'xstate';
import type { GameCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import { Events, FactTypes, ArcadePhases, Config } from '@pecking-order/shared-types';
import type { GameEvent, GameOutput } from '../contracts';
import { getAlivePlayerIds } from '../helpers/alive-players';

// --- Config ---

export interface ArcadeGameConfig {
  gameType: string;
  computeRewards: (
    result: Record<string, number>,
    timeElapsed: number,
    timeLimit: number,
  ) => { silver: number; gold: number };
  defaultTimeLimit?: number; // default 45_000
}

// --- Per-Player State ---

export interface ArcadePlayerState {
  status: 'NOT_STARTED' | 'PLAYING' | 'COMPLETED';
  startedAt: number;
  result: Record<string, number> | null;
  silverReward: number;
}

function createPlayerState(): ArcadePlayerState {
  return {
    status: ArcadePhases.NOT_STARTED,
    startedAt: 0,
    result: null,
    silverReward: 0,
  };
}

// --- Machine Context ---

export interface ArcadeGameContext {
  gameType: string;
  players: Record<string, ArcadePlayerState>;
  goldContribution: number;
  alivePlayers: string[];
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  seed: number;
  timeLimit: number;
  difficulty: number;
  ready: boolean;
}

// --- Factory ---

export function createArcadeMachine(config: ArcadeGameConfig) {
  const { gameType, computeRewards, defaultTimeLimit = Config.game.arcade.defaultTimeLimitMs } = config;
  const START_EVENT = Events.Game.start(gameType);
  const RESULT_EVENT = Events.Game.result(gameType);

  return setup({
    types: {
      context: {} as ArcadeGameContext,
      events: {} as GameEvent,
      input: {} as GameCartridgeInput,
      output: {} as GameOutput,
    },
    guards: {
      isStartEvent: ({ event }: any) => event.type === START_EVENT,
      isResultEvent: ({ event }: any) => event.type === RESULT_EVENT,
    } as any,
    actions: {
      startPlayer: assign(({ context, event }: any) => {
        const senderId = event.senderId as string;
        const player = context.players[senderId];
        if (!player || player.status !== ArcadePhases.NOT_STARTED) return {};

        return {
          players: {
            ...context.players,
            [senderId]: {
              ...player,
              status: ArcadePhases.PLAYING,
              startedAt: Date.now(),
            },
          },
        };
      }),

      processResult: enqueueActions(({ enqueue, context, event }: any) => {
        const senderId = event.senderId as string;
        const player = context.players[senderId];
        if (!player || player.status !== ArcadePhases.PLAYING) return;

        // Validate server-side timing
        const serverElapsed = Date.now() - player.startedAt;
        if (serverElapsed < 0) return;

        // Extract opaque result — everything except type/senderId
        const { type: _t, senderId: _s, ...resultPayload } = event;

        // Clamp timeElapsed if present
        const timeElapsed = Math.min(
          defaultTimeLimit,
          Math.max(0, resultPayload.timeElapsed || 0),
        );

        // Build the stored result (all number values clamped to non-negative integers)
        const result: Record<string, number> = {};
        for (const [key, val] of Object.entries(resultPayload)) {
          result[key] = Math.max(0, Math.floor(Number(val) || 0));
        }
        result.timeElapsed = timeElapsed;

        const { silver, gold } = computeRewards(result, timeElapsed, defaultTimeLimit);

        enqueue.assign({
          players: {
            ...context.players,
            [senderId]: {
              ...player,
              status: ArcadePhases.COMPLETED,
              result,
              silverReward: silver,
            },
          },
          goldContribution: context.goldContribution + gold,
        });

        enqueue.raise({ type: 'PLAYER_COMPLETED', playerId: senderId, silverReward: silver, goldContribution: gold } as any);

        // Check if all alive players are done
        const allDone = context.alivePlayers.every((pid: string) =>
          pid === senderId ? true : context.players[pid]?.status === ArcadePhases.COMPLETED
        );
        if (allDone) {
          enqueue.raise({ type: 'ALL_COMPLETE' } as any);
        }
      }),

      finalizeResults: assign(({ context }: any) => {
        const updatedPlayers = { ...context.players };
        for (const [pid, player] of Object.entries(updatedPlayers) as [string, ArcadePlayerState][]) {
          if (player.status !== ArcadePhases.COMPLETED) {
            const { silver } = computeRewards(
              player.result || {},
              player.result?.timeElapsed || 0,
              defaultTimeLimit,
            );
            updatedPlayers[pid] = { ...player, silverReward: silver };
          }
        }
        return { players: updatedPlayers };
      }),

      reportResults: sendParent(({ context }: any): AnyEventObject => ({
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.GAME_RESULT as any,
          actorId: 'SYSTEM',
          payload: {
            gameType,
            goldContribution: context.goldContribution,
            players: Object.fromEntries(
              Object.entries(context.players).map(([pid, p]: [string, any]) => [
                pid,
                { ...p.result, silverReward: p.silverReward },
              ])
            ),
          },
          timestamp: Date.now(),
        },
      })),

      emitSync: sendParent((): AnyEventObject => ({
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.GAME_ROUND as any,
          actorId: 'SYSTEM',
          payload: {},
          timestamp: Date.now(),
        },
      })),

      emitPlayerGameResult: sendParent(({ event }: any): AnyEventObject => ({
        type: Events.Cartridge.PLAYER_GAME_RESULT,
        playerId: event.playerId,
        silverReward: event.silverReward,
        goldContribution: event.goldContribution || 0,
      })),
    } as any,
  }).createMachine({
    id: `${gameType.toLowerCase().replace(/_/g, '-')}-game`,
    context: ({ input }: any) => {
      const alive = getAlivePlayerIds(input.roster);
      const players: Record<string, ArcadePlayerState> = {};
      for (const pid of alive) {
        players[pid] = createPlayerState();
      }

      // Deterministic seed from time + day index
      const seed = (Date.now() ^ (input.dayIndex * 2654435761)) >>> 0;

      // Default difficulty scales with day (day 1 = 0, day 7 ~ 0.9)
      const difficulty = input.difficulty ?? Math.min(1, (input.dayIndex - 1) * Config.game.arcade.difficultyScalePerDay);

      return {
        gameType,
        players,
        goldContribution: 0,
        alivePlayers: alive,
        roster: input.roster,
        dayIndex: input.dayIndex,
        seed,
        timeLimit: defaultTimeLimit,
        difficulty,
        ready: true,
      };
    },
    initial: 'active',
    output: ({ context }: any) => {
      const silverRewards: Record<string, number> = {};
      const playerResults: Record<string, { silverReward: number; result: Record<string, number> | null }> = {};
      for (const [pid, player] of Object.entries(context.players) as [string, ArcadePlayerState][]) {
        if (player.status !== ArcadePhases.COMPLETED) {
          silverRewards[pid] = player.silverReward;
        }
        playerResults[pid] = { silverReward: player.silverReward, result: player.result };
      }
      return {
        gameType: context.gameType,
        silverRewards,
        goldContribution: context.goldContribution,
        goldEmittedPerPlayer: true,
        summary: { playerResults },
      };
    },
    states: {
      active: {
        entry: 'emitSync',
        on: {
          '*': [
            { guard: 'isStartEvent', actions: 'startPlayer' },
            { guard: 'isResultEvent', actions: 'processResult' },
          ],
          'PLAYER_COMPLETED': {
            actions: 'emitPlayerGameResult',
          },
          'ALL_COMPLETE': { target: 'completed' },
          'INTERNAL.END_GAME': { target: 'completed' },
        },
      },
      completed: {
        entry: ['finalizeResults', 'emitSync'],
        type: 'final',
      },
    },
  } as any);
}
