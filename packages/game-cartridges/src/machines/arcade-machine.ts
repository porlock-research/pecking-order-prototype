/**
 * Arcade Machine Factory
 *
 * Generic lifecycle machine for async, per-player, client-rendered minigames.
 * The client renders the entire game and submits a final score payload.
 * The server tracks lifecycle (NOT_STARTED -> PLAYING -> AWAITING_DECISION -> COMPLETED),
 * validates timing, computes rewards, and emits facts.
 *
 * Players can RETRY (return to PLAYING) or SUBMIT (finalize) after completing a run.
 * On deadline (INTERNAL.END_GAME), AWAITING_DECISION players are auto-submitted
 * and mid-retry PLAYING players fall back to their previousResult.
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
  status: 'NOT_STARTED' | 'PLAYING' | 'AWAITING_DECISION' | 'COMPLETED';
  startedAt: number;
  result: Record<string, number> | null;
  silverReward: number;
  goldReward: number;
  retryCount: number;
  previousResult: Record<string, number> | null;
  previousSilverReward: number;
  previousGoldReward: number;
}

function createPlayerState(): ArcadePlayerState {
  return {
    status: ArcadePhases.NOT_STARTED,
    startedAt: 0,
    result: null,
    silverReward: 0,
    goldReward: 0,
    retryCount: 0,
    previousResult: null,
    previousSilverReward: 0,
    previousGoldReward: 0,
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
      isSubmitEvent: ({ event }: any) => event.type === Events.Game.SUBMIT,
      isRetryEvent: ({ event }: any) => event.type === Events.Game.RETRY,
    } as any,
    actions: {
      startPlayer: assign(({ context, event }: any) => {
        const senderId = event.senderId as string;
        const player = context.players[senderId];
        if (!player || (player.status !== ArcadePhases.NOT_STARTED && player.status !== ArcadePhases.PLAYING)) return {};

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

        // Transition to AWAITING_DECISION — do NOT add gold to machine contribution yet
        enqueue.assign({
          players: {
            ...context.players,
            [senderId]: {
              ...player,
              status: ArcadePhases.AWAITING_DECISION,
              result,
              silverReward: silver,
              goldReward: gold,
            },
          },
        });

        // Emit sync so clients see the updated state
        enqueue.raise({ type: 'SYNC_AFTER_RESULT' } as any);
      }),

      submitPlayer: enqueueActions(({ enqueue, context, event }: any) => {
        const senderId = event.senderId as string;
        const player = context.players[senderId];
        if (!player || player.status !== ArcadePhases.AWAITING_DECISION) return;

        // Add player's gold to machine contribution and mark COMPLETED
        enqueue.assign({
          players: {
            ...context.players,
            [senderId]: {
              ...player,
              status: ArcadePhases.COMPLETED,
            },
          },
          goldContribution: context.goldContribution + player.goldReward,
        });

        enqueue.raise({ type: 'PLAYER_COMPLETED', playerId: senderId, silverReward: player.silverReward, goldContribution: player.goldReward } as any);

        // Check if all alive players are now COMPLETED
        const allDone = context.alivePlayers.every((pid: string) =>
          pid === senderId ? true : context.players[pid]?.status === ArcadePhases.COMPLETED
        );
        if (allDone) {
          enqueue.raise({ type: 'ALL_COMPLETE' } as any);
        }
      }),

      retryPlayer: assign(({ context, event }: any) => {
        const senderId = event.senderId as string;
        const player = context.players[senderId];
        if (!player || player.status !== ArcadePhases.AWAITING_DECISION) return {};

        return {
          players: {
            ...context.players,
            [senderId]: {
              ...player,
              status: ArcadePhases.PLAYING,
              previousResult: player.result,
              previousSilverReward: player.silverReward,
              previousGoldReward: player.goldReward,
              retryCount: player.retryCount + 1,
              result: null,
              silverReward: 0,
              goldReward: 0,
              startedAt: 0,
            },
          },
        };
      }),

      finalizeResults: assign(({ context }: any) => {
        const updatedPlayers = { ...context.players };
        let goldContribution = context.goldContribution;

        for (const [pid, player] of Object.entries(updatedPlayers) as [string, ArcadePlayerState][]) {
          if (player.status === ArcadePhases.AWAITING_DECISION) {
            // Auto-submit: use current result/rewards
            goldContribution += player.goldReward;
            updatedPlayers[pid] = { ...player, status: ArcadePhases.COMPLETED };
          } else if (player.status === ArcadePhases.PLAYING) {
            if (player.previousResult) {
              // Mid-retry: fall back to previous result
              updatedPlayers[pid] = {
                ...player,
                result: player.previousResult,
                silverReward: player.previousSilverReward,
                goldReward: player.previousGoldReward,
                status: ArcadePhases.COMPLETED,
              };
              goldContribution += player.previousGoldReward;
            } else {
              // First run, never completed: zero rewards
              updatedPlayers[pid] = {
                ...player,
                silverReward: 0,
                goldReward: 0,
                status: ArcadePhases.COMPLETED,
              };
            }
          } else if (player.status === ArcadePhases.NOT_STARTED) {
            // Never started: zero rewards
            updatedPlayers[pid] = {
              ...player,
              silverReward: 0,
              goldReward: 0,
            };
          }
        }
        return { players: updatedPlayers, goldContribution };
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
      const players: Record<string, { silverReward: number; goldReward: number; result: Record<string, number> | null }> = {};
      for (const [pid, player] of Object.entries(context.players) as [string, ArcadePlayerState][]) {
        if (player.status !== ArcadePhases.COMPLETED) {
          silverRewards[pid] = player.silverReward;
        }
        players[pid] = { silverReward: player.silverReward, goldReward: player.goldReward, result: player.result };
      }
      return {
        gameType: context.gameType,
        silverRewards,
        goldContribution: context.goldContribution,
        goldEmittedPerPlayer: true,
        summary: { players },
      };
    },
    states: {
      active: {
        entry: 'emitSync',
        on: {
          '*': [
            { guard: 'isStartEvent', actions: 'startPlayer' },
            { guard: 'isResultEvent', actions: 'processResult' },
            { guard: 'isSubmitEvent', actions: 'submitPlayer' },
            { guard: 'isRetryEvent', actions: 'retryPlayer' },
          ],
          'PLAYER_COMPLETED': {
            actions: 'emitPlayerGameResult',
          },
          'ALL_COMPLETE': { target: 'completed' },
          [Events.Internal.END_GAME]: { target: 'completed' },
          'SYNC_AFTER_RESULT': { actions: 'emitSync' },
        },
      },
      completed: {
        entry: ['finalizeResults', 'emitSync'],
        type: 'final',
      },
    },
  } as any);
}
