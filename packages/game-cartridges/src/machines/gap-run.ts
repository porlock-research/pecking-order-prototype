/**
 * Gap Run Machine
 *
 * Async per-player side-scrolling minigame. Each player runs independently
 * within the game window. No external API — seed generated at init.
 * Client handles all rendering; server validates results.
 */
import { setup, assign, sendParent, enqueueActions, type AnyEventObject } from 'xstate';
import type { GameCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { GameEvent, GameOutput } from '../contracts';
import { getAlivePlayerIds } from '../helpers/alive-players';

// --- Constants ---
const TIME_LIMIT_MS = 45_000;
const SILVER_PER_100_DISTANCE = 1;
const MAX_DISTANCE_SILVER = 15;
const SURVIVAL_BONUS = 5;
const GOLD_PER_500_DISTANCE = 1;

// --- Per-Player State ---

export interface PlayerGapRunState {
  status: 'NOT_STARTED' | 'PLAYING' | 'COMPLETED';
  startedAt: number;
  distance: number;
  jumps: number;
  timeElapsed: number;
  silverReward: number;
}

function createPlayerState(): PlayerGapRunState {
  return {
    status: 'NOT_STARTED',
    startedAt: 0,
    distance: 0,
    jumps: 0,
    timeElapsed: 0,
    silverReward: 0,
  };
}

function computeRewards(distance: number, timeElapsed: number) {
  const distanceSilver = Math.min(MAX_DISTANCE_SILVER, Math.floor(distance / 100));
  const survivalBonus = timeElapsed >= TIME_LIMIT_MS - 1000 ? SURVIVAL_BONUS : 0;
  const silver = distanceSilver + survivalBonus;
  const gold = Math.floor(distance / 500);
  return { silver, gold };
}

// --- Machine Context ---

export interface GapRunContext {
  gameType: 'GAP_RUN';
  players: Record<string, PlayerGapRunState>;
  goldContribution: number;
  alivePlayers: string[];
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  seed: number;
  timeLimit: number;
  ready: boolean;
}

// --- Machine ---

export const gapRunMachine = setup({
  types: {
    context: {} as GapRunContext,
    events: {} as GameEvent,
    input: {} as GameCartridgeInput,
    output: {} as GameOutput,
  },
  guards: {},
  actions: {
    startPlayer: assign(({ context, event }) => {
      if (event.type !== 'GAME.GAP_RUN.START') return {};
      const senderId = (event as any).senderId as string;
      const player = context.players[senderId];
      if (!player || player.status !== 'NOT_STARTED') return {};

      return {
        players: {
          ...context.players,
          [senderId]: {
            ...player,
            status: 'PLAYING' as const,
            startedAt: Date.now(),
          },
        },
      };
    }),

    processResult: enqueueActions(({ enqueue, context, event }) => {
      if (event.type !== 'GAME.GAP_RUN.RESULT') return;
      const { senderId, distance, jumps, timeElapsed } = event as any;
      const player = context.players[senderId];
      if (!player || player.status !== 'PLAYING') return;

      // Validate time limit (1s grace for latency)
      const serverElapsed = Date.now() - player.startedAt;
      if (serverElapsed < 0) return;

      const clampedDistance = Math.max(0, Math.floor(distance || 0));
      const clampedJumps = Math.max(0, Math.floor(jumps || 0));
      const clampedTime = Math.min(TIME_LIMIT_MS, Math.max(0, timeElapsed || 0));

      const { silver, gold } = computeRewards(clampedDistance, clampedTime);

      enqueue.assign({
        players: {
          ...context.players,
          [senderId]: {
            ...player,
            status: 'COMPLETED' as const,
            distance: clampedDistance,
            jumps: clampedJumps,
            timeElapsed: clampedTime,
            silverReward: silver,
          },
        },
        goldContribution: context.goldContribution + gold,
      });

      // Emit per-player reward
      enqueue.raise({ type: 'PLAYER_COMPLETED', playerId: senderId, silverReward: silver } as any);

      // Check if all alive players are done
      const allDone = context.alivePlayers.every(pid =>
        pid === senderId ? true : context.players[pid]?.status === 'COMPLETED'
      );
      if (allDone) {
        enqueue.raise({ type: 'ALL_COMPLETE' } as any);
      }
    }),

    finalizeResults: assign(({ context }) => {
      const updatedPlayers = { ...context.players };
      for (const [pid, player] of Object.entries(updatedPlayers)) {
        if (player.status !== 'COMPLETED') {
          // Partial credit: compute from current distance (0 if never started)
          const { silver } = computeRewards(player.distance, player.timeElapsed);
          updatedPlayers[pid] = { ...player, silverReward: silver };
        }
      }
      return { players: updatedPlayers };
    }),

    reportResults: sendParent(({ context }): AnyEventObject => ({
      type: 'FACT.RECORD',
      fact: {
        type: 'GAME_RESULT' as any,
        actorId: 'SYSTEM',
        payload: {
          gameType: 'GAP_RUN',
          goldContribution: context.goldContribution,
          players: Object.fromEntries(
            Object.entries(context.players).map(([pid, p]) => [
              pid,
              { distance: p.distance, jumps: p.jumps, timeElapsed: p.timeElapsed, silverReward: p.silverReward },
            ])
          ),
        },
        timestamp: Date.now(),
      },
    })),

    emitSync: sendParent((): AnyEventObject => ({
      type: 'FACT.RECORD',
      fact: {
        type: 'GAME_ROUND' as any,
        actorId: 'SYSTEM',
        payload: {},
        timestamp: Date.now(),
      },
    })),

    emitPlayerGameResult: sendParent(({ event }): AnyEventObject => ({
      type: 'CARTRIDGE.PLAYER_GAME_RESULT',
      playerId: (event as any).playerId,
      silverReward: (event as any).silverReward,
    })),
  },
}).createMachine({
  id: 'gap-run-game',
  context: ({ input }) => {
    const alive = getAlivePlayerIds(input.roster);
    const players: Record<string, PlayerGapRunState> = {};
    for (const pid of alive) {
      players[pid] = createPlayerState();
    }

    // Deterministic seed from time + day index
    const seed = (Date.now() ^ (input.dayIndex * 2654435761)) >>> 0;

    return {
      gameType: 'GAP_RUN' as const,
      players,
      goldContribution: 0,
      alivePlayers: alive,
      roster: input.roster,
      dayIndex: input.dayIndex,
      seed,
      timeLimit: TIME_LIMIT_MS,
      ready: true,
    };
  },
  initial: 'active',
  output: ({ context }) => {
    const silverRewards: Record<string, number> = {};
    for (const [pid, player] of Object.entries(context.players)) {
      if (player.status !== 'COMPLETED') {
        silverRewards[pid] = player.silverReward;
      }
    }
    return { silverRewards, goldContribution: context.goldContribution };
  },
  states: {
    active: {
      entry: 'emitSync',
      on: {
        'GAME.GAP_RUN.START': { target: 'active', reenter: true, actions: 'startPlayer' },
        'GAME.GAP_RUN.RESULT': { target: 'active', reenter: true, actions: 'processResult' },
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
});
