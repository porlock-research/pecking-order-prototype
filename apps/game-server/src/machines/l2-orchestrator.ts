import { setup, assign, fromPromise } from 'xstate';
import { dailySessionMachine } from './l3-session';
import { SocialPlayer, Roster } from '@pecking-order/shared-types';

// --- Types (Local definition to ensure self-containment) ---
export interface GameContext {
  gameId: string;
  roster: Record<string, SocialPlayer>;
  manifest: any;
  dayIndex: number;
  nextWakeup: number | null;
}

export type GameEvent = 
  | { type: 'SYSTEM.INIT'; payload: { roster: Roster; manifest: any }; gameId: string }
  | { type: 'SYSTEM.WAKEUP' }
  | { type: 'SYSTEM.PAUSE' }
  | { type: 'ADMIN.NEXT_STAGE' };

// --- The L2 Orchestrator Machine ---
export const orchestratorMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  actions: {
    initializeContext: assign({
      gameId: ({ event }) => (event.type === 'SYSTEM.INIT' ? event.gameId : ''),
      roster: ({ event }) => {
        if (event.type !== 'SYSTEM.INIT') return {};
        const internalRoster: Record<string, SocialPlayer> = {};
        for (const [id, p] of Object.entries(event.payload.roster)) {
          internalRoster[id] = {
            id,
            personaName: p.personaName,
            avatarUrl: p.avatarUrl,
            status: p.isAlive ? "ALIVE" : "ELIMINATED",
            silver: p.silver
          };
        }
        return internalRoster;
      },
      manifest: ({ event }) => (event.type === 'SYSTEM.INIT' ? event.payload.manifest : {}),
      dayIndex: 0,
    }),
    incrementDay: assign({
      dayIndex: ({ context }) => context.dayIndex + 1
    }),
    scheduleMorningAlarm: assign({
      nextWakeup: ({ context }) => {
        // LOGIC: Set wakeup for 30 seconds from now (Simulating "Tomorrow Morning")
        return Date.now() + 30000; 
      }
    }),
    logTransition: ({ context, event }) => {
      console.log(`[L2 Logic] Processing: ${event.type} | Current Day: ${context.dayIndex}`);
    }
  },
  actors: {
    dailySessionMachine
  }
}).createMachine({
  id: 'pecking-order-l2',
  initial: 'uninitialized',
  context: {
    gameId: '',
    roster: {},
    manifest: {},
    dayIndex: 0,
    nextWakeup: null
  },
  states: {
    uninitialized: {
      on: {
        'SYSTEM.INIT': {
          target: 'preGame',
          actions: ['initializeContext', 'logTransition']
        }
      }
    },
    preGame: {
      entry: ['scheduleMorningAlarm'], 
      on: {
        'SYSTEM.WAKEUP': { target: 'dayLoop' },
        'ADMIN.NEXT_STAGE': { target: 'dayLoop' }
      }
    },
    dayLoop: {
      initial: 'morningBriefing',
      states: {
        morningBriefing: {
          entry: ['incrementDay', 'logTransition'],
          on: {
            'ADMIN.NEXT_STAGE': { target: 'activeSession' }
          }
        },
        activeSession: {
          // SPAWN THE CHILD
          invoke: {
            id: 'l3-session',
            src: 'dailySessionMachine',
            input: ({ context }) => ({
              dayIndex: context.dayIndex,
              roster: context.roster
            }),
            onDone: {
              // When L3 finishes, go to Night Summary
              target: 'nightSummary',
              actions: ({ event }) => {
                const output = (event as any).output;
                const reason = output ? output.reason : "Unknown";
                console.log(`[L2] Day Ended. Reason: ${reason}`);
              }
            }
          },
          on: {
            'SYSTEM.WAKEUP': { target: 'nightSummary' }
          }
        },
        nightSummary: {
          entry: ['logTransition'],
          on: {
            'ADMIN.NEXT_STAGE': { target: 'morningBriefing' }
          }
        }
      },
      always: [
        { guard: ({ context }) => context.dayIndex >= 7, target: 'gameOver' }
      ]
    },
    gameOver: {
      type: 'final'
    }
  }
});