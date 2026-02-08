import { setup, assign, fromPromise } from 'xstate';
import { dailySessionMachine } from './l3-session';

// --- Types (Local definition to ensure self-containment) ---
export interface GameContext {
  gameId: string;
  roster: Record<string, any>;
  manifest: any;
  dayIndex: number;
  nextWakeup: number | null;
}

export type GameEvent = 
  | { type: 'SYSTEM.INIT'; payload: { roster: any; manifest: any }; gameId: string }
  | { type: 'SYSTEM.WAKEUP' }
  | { type: 'SYSTEM.PAUSE' };

// --- The L2 Orchestrator Machine ---
export const orchestratorMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  actions: {
    initializeContext: assign({
      gameId: ({ event }) => (event.type === 'SYSTEM.INIT' ? event.gameId : ''),
      roster: ({ event }) => (event.type === 'SYSTEM.INIT' ? event.payload.roster : {}),
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
    // Placeholder for L3 Daily Session (Phase 3)
    dailySession: fromPromise(async () => {
      return { status: "Day Complete" }; 
    })
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
        'SYSTEM.WAKEUP': { target: 'dayLoop' }
      }
    },
    dayLoop: {
      initial: 'morningBriefing',
      states: {
        morningBriefing: {
          entry: ['incrementDay', 'logTransition'],
          after: {
            5000: 'activeSession' // 5s delay for "Morning Announcements"
          }
        },
        activeSession: {
          // SPAWN THE CHILD
          invoke: {
            id: 'l3-session',
            src: dailySessionMachine,
            input: ({ context }) => ({
              dayIndex: context.dayIndex
            }),
            onDone: {
              // When L3 finishes (after 20s), go to Night Summary
              target: 'nightSummary',
              actions: ({ event }) => {
                // DEFENSIVE CODING: Check if output exists
                const reason = event.output ? event.output.reason : "Unknown";
                console.log(`[L2] Day Ended. Reason: ${reason}`);
              }
            }
          },
          on: {
            'SYSTEM.WAKEUP': { target: 'nightSummary' }
          }
        },
        nightSummary: {
          entry: ['scheduleMorningAlarm', 'logTransition'],
          on: {
            'SYSTEM.WAKEUP': { target: 'morningBriefing' }
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
