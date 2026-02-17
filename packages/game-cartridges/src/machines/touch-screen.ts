/**
 * Touch Screen Machine
 *
 * Mode-driven live game pattern. One machine handles both SOLO and LIVE modes
 * via guard-based routing at the `init` state.
 *
 * SOLO: init → waitingForStart → countdown → active → completed
 * LIVE: init → ready → countdown → active → completed
 *
 * Solo mode: single player clicks Start, then touches to hold, releases to finish.
 * Live mode: all ready players compete, last one holding wins.
 *
 * Events:
 *   GAME.TOUCH_SCREEN.START — launch the game (solo only, WAITING_FOR_START → countdown)
 *   GAME.TOUCH_SCREEN.READY — ready up (live only)
 *   GAME.TOUCH_SCREEN.TOUCH — start holding (player presses down during ACTIVE phase)
 *   GAME.TOUCH_SCREEN.RELEASE — stop holding (player lifts finger/mouse)
 *
 * All hold state is public (broadcast projection path — no `players`/`decisions`/`submitted` keys).
 */
import { setup, assign, sendParent, enqueueActions, type AnyEventObject } from 'xstate';
import type { GameCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import { Events, FactTypes, LiveGamePhases, Config } from '@pecking-order/shared-types';
import type { GameEvent, GameOutput } from '../contracts';
import { getAlivePlayerIds } from '../helpers/alive-players';

// --- Delays ---
const READY_TIMEOUT = Config.game.touchScreen.readyTimeoutMs;
const COUNTDOWN_DURATION = Config.game.touchScreen.countdownMs;
const MAX_HOLD_TIME = Config.game.touchScreen.maxHoldTimeMs;

// --- Context ---

export interface HoldState {
  holdStart: number;
  holdEnd: number | null;
  duration: number;
}

export interface TouchScreenResults {
  silverRewards: Record<string, number>;
  goldContribution: number;
  shieldWinnerId?: string | null;
  summary: Record<string, any>;
}

export interface TouchScreenContext {
  gameType: 'TOUCH_SCREEN';
  mode: 'SOLO' | 'LIVE';
  phase: 'INIT' | 'WAITING_FOR_START' | 'READY' | 'COUNTDOWN' | 'ACTIVE' | 'COMPLETED';
  eligiblePlayers: string[];
  readyPlayers: string[];
  /** In solo mode, the player who clicked Start */
  startedBy: string | null;
  countdownStartedAt: number | null;
  playStartedAt: number | null;
  holdStates: Record<string, HoldState>;
  stillHolding: number;
  results: TouchScreenResults | null;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

// --- Reward tiers by rank (0-indexed) ---
const SILVER_BY_RANK = Config.game.touchScreen.silverByRank;

function computeRewards(holdStates: Record<string, HoldState>): TouchScreenResults {
  const now = Date.now();
  // Auto-complete anyone still holding
  const finalized: Record<string, HoldState> = {};
  for (const [pid, hs] of Object.entries(holdStates)) {
    if (hs.holdEnd === null) {
      const duration = now - hs.holdStart;
      finalized[pid] = { ...hs, holdEnd: now, duration };
    } else {
      finalized[pid] = hs;
    }
  }

  // Rank by duration descending
  const ranked = Object.entries(finalized)
    .sort(([, a], [, b]) => b.duration - a.duration);

  const silverRewards: Record<string, number> = {};
  for (let i = 0; i < ranked.length; i++) {
    const [pid] = ranked[i];
    silverRewards[pid] = SILVER_BY_RANK[Math.min(i, SILVER_BY_RANK.length - 1)];
  }

  const totalDuration = Object.values(finalized).reduce((sum, hs) => sum + hs.duration, 0);

  return {
    silverRewards,
    goldContribution: Math.floor(totalDuration / Config.game.touchScreen.msPerGoldUnit),
    shieldWinnerId: ranked.length > 0 ? ranked[0][0] : null,
    summary: {
      rankings: ranked.map(([pid, hs]) => ({ playerId: pid, duration: hs.duration })),
      holdStates: finalized,
    },
  };
}

// --- Machine ---

export const touchScreenMachine = setup({
  types: {
    context: {} as TouchScreenContext,
    events: {} as GameEvent | { type: 'ALL_READY' } | { type: 'GAME_OVER' },
    input: {} as GameCartridgeInput,
    output: {} as GameOutput,
  },
  guards: {
    isLiveMode: ({ context }: any) => context.mode === 'LIVE',
    isStartEvent: ({ event }: any) => event.type === Events.Game.start('TOUCH_SCREEN'),
    isReadyEvent: ({ event }: any) => event.type === Events.Game.event('TOUCH_SCREEN', 'READY'),
    isTouchEvent: ({ event }: any) => event.type === Events.Game.event('TOUCH_SCREEN', 'TOUCH'),
    isReleaseEvent: ({ event }: any) => event.type === Events.Game.event('TOUCH_SCREEN', 'RELEASE'),
    anyReady: ({ context }: any) => context.readyPlayers.length > 0,
  } as any,
  delays: {
    READY_TIMEOUT,
    COUNTDOWN_DURATION,
    MAX_HOLD_TIME,
  },
  actions: {
    recordStarter: assign(({ event }: any) => ({
      startedBy: event.senderId as string,
    })),

    addReadyPlayer: enqueueActions(({ enqueue, context, event }: any) => {
      const senderId = event.senderId as string;
      if (!context.eligiblePlayers.includes(senderId)) return;
      if (context.readyPlayers.includes(senderId)) return;

      const newReady = [...context.readyPlayers, senderId];
      enqueue.assign({ readyPlayers: newReady });

      if (newReady.length >= context.eligiblePlayers.length) {
        enqueue.raise({ type: 'ALL_READY' });
      }
    }),

    setCountdownStart: assign({
      countdownStartedAt: () => Date.now(),
      phase: () => LiveGamePhases.COUNTDOWN,
    }),

    // Sets up the active phase — no hold entries yet (those come from TOUCH events)
    initActivePhase: assign({
      playStartedAt: () => Date.now(),
      phase: () => LiveGamePhases.ACTIVE,
    }),

    // Player starts holding (on TOUCH event)
    processTouchStart: enqueueActions(({ enqueue, context, event }: any) => {
      const senderId = event.senderId as string;
      // Already touching or released? Ignore.
      if (context.holdStates[senderId]) return;

      // Check eligibility: solo = starter only, live = ready players
      const eligible = context.mode === 'LIVE'
        ? context.readyPlayers
        : (context.startedBy ? [context.startedBy] : []);
      if (!eligible.includes(senderId)) return;

      const now = Date.now();
      enqueue.assign({
        holdStates: {
          ...context.holdStates,
          [senderId]: { holdStart: now, holdEnd: null, duration: 0 },
        },
        stillHolding: context.stillHolding + 1,
      });
    }),

    processRelease: enqueueActions(({ enqueue, context, event }: any) => {
      const senderId = event.senderId as string;
      const hs = context.holdStates[senderId];
      if (!hs || hs.holdEnd !== null) return; // not holding or already released

      const now = Date.now();
      const duration = now - hs.holdStart;
      const newHoldStates = {
        ...context.holdStates,
        [senderId]: { ...hs, holdEnd: now, duration },
      };
      const newStillHolding = context.stillHolding - 1;

      enqueue.assign({
        holdStates: newHoldStates,
        stillHolding: newStillHolding,
      });

      // Game over conditions: solo → 0 holding, live → 1 or fewer holding
      const threshold = context.mode === 'LIVE' ? 1 : 0;
      if (newStillHolding <= threshold) {
        enqueue.raise({ type: 'GAME_OVER' });
      }
    }),

    computeResults: assign(({ context }: any) => ({
      results: computeRewards(context.holdStates),
      phase: LiveGamePhases.COMPLETED,
    })),

    reportResults: sendParent(({ context }: any): AnyEventObject => ({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.GAME_RESULT as any,
        actorId: 'SYSTEM',
        payload: {
          gameType: 'TOUCH_SCREEN',
          goldContribution: context.results?.goldContribution ?? 0,
          silverRewards: context.results?.silverRewards ?? {},
          summary: context.results?.summary ?? {},
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
  } as any,
}).createMachine({
  id: 'touch-screen-game',
  context: ({ input }: any) => {
    const eligible = getAlivePlayerIds(input.roster);
    return {
      gameType: 'TOUCH_SCREEN' as const,
      mode: (input.mode ?? 'SOLO') as 'SOLO' | 'LIVE',
      phase: LiveGamePhases.INIT,
      eligiblePlayers: eligible,
      readyPlayers: [],
      startedBy: null,
      countdownStartedAt: null,
      playStartedAt: null,
      holdStates: {},
      stillHolding: 0,
      results: null,
      roster: input.roster,
      dayIndex: input.dayIndex,
    };
  },
  initial: 'init',
  output: ({ context }: any) => ({
    gameType: 'TOUCH_SCREEN',
    silverRewards: context.results?.silverRewards ?? {},
    goldContribution: context.results?.goldContribution ?? 0,
    summary: context.results?.summary ?? {},
  }),
  states: {
    init: {
      always: [
        { guard: 'isLiveMode', target: 'ready' },
        { target: 'waitingForStart' },
      ],
    },

    // Solo mode: wait for the player to click Start
    waitingForStart: {
      entry: assign({ phase: () => LiveGamePhases.WAITING_FOR_START }),
      on: {
        '*': [
          { guard: 'isStartEvent', actions: ['recordStarter'], target: 'countdown' },
        ],
        'INTERNAL.END_GAME': { target: 'completed' },
      },
    },

    // Live mode: wait for players to ready up
    ready: {
      entry: assign({ phase: () => LiveGamePhases.READY }),
      on: {
        '*': [
          { guard: 'isReadyEvent', actions: ['addReadyPlayer', 'emitSync'] },
        ],
        'ALL_READY': { target: 'countdown' },
        'INTERNAL.END_GAME': { target: 'completed' },
      },
      after: {
        READY_TIMEOUT: [
          { guard: 'anyReady', target: 'countdown' },
          { target: 'completed' },
        ],
      },
    },

    countdown: {
      entry: ['setCountdownStart', 'emitSync'],
      after: {
        COUNTDOWN_DURATION: { target: 'active' },
      },
      on: {
        'INTERNAL.END_GAME': { target: 'completed' },
      },
    },

    // Core game: players TOUCH to start holding, RELEASE to let go
    active: {
      entry: ['initActivePhase', 'emitSync'],
      on: {
        '*': [
          { guard: 'isTouchEvent', actions: ['processTouchStart', 'emitSync'] },
          { guard: 'isReleaseEvent', actions: ['processRelease', 'emitSync'] },
        ],
        'GAME_OVER': { target: 'completed' },
        'INTERNAL.END_GAME': { target: 'completed' },
      },
      after: {
        MAX_HOLD_TIME: { target: 'completed' },
      },
    },

    completed: {
      entry: ['computeResults', 'reportResults', 'emitSync'],
      type: 'final',
    },
  },
} as any);
