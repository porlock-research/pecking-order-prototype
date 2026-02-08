import { setup, assign, fromPromise, sendTo } from 'xstate';
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
        // LOGIC: Set wakeup for 5 seconds from now
        return Date.now() + 5000; 
      }
    }),
    scheduleNextStage: assign({
      nextWakeup: ({ context }) => Date.now() + 5000
    }),
    logTransition: ({ context, event }) => {
      console.log(`[L2 Logic] Processing: ${event.type} | Current Day: ${context.dayIndex}`);
    },
    forwardToSession: ({ context, event, self }) => {
        const child = self.getSnapshot().children['l3-session'];
        if (child) {
            child.send(event);
        } else {
            console.warn("[L2] Child 'l3-session' not found (Zombie State). Skipping day.");
            self.send({ type: 'SYSTEM.WAKEUP' }); 
        }
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
          entry: ['incrementDay', 'logTransition', 'scheduleNextStage'],
          on: {
            'ADMIN.NEXT_STAGE': { target: 'activeSession' },
            'SYSTEM.WAKEUP': { target: 'activeSession' }
          }
        },
        activeSession: {
          entry: ['logTransition', 'scheduleNextStage'],
          // SPAWN THE CHILD
          invoke: {
            id: 'l3-session',
            src: 'dailySessionMachine',
            input: ({ context }) => ({
              dayIndex: context.dayIndex,
              roster: context.roster
            }),
            onDone: {
              target: 'nightSummary',
              actions: ({ event }) => console.log(`[L2] L3 Finished naturally.`)
            }
          },
          on: {
            'SYSTEM.WAKEUP': { target: 'nightSummary' },
            'ADMIN.NEXT_STAGE': { actions: 'forwardToSession' }
          }
        },
        nightSummary: {
          entry: ['logTransition', 'scheduleNextStage'],
          on: {
            'ADMIN.NEXT_STAGE': { target: 'morningBriefing' },
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