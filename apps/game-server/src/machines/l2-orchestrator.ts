import { setup, assign, fromPromise, sendTo } from 'xstate';
import { dailySessionMachine } from './l3-session';
import { SocialPlayer, Roster, GameManifest, Fact } from '@pecking-order/shared-types';

// --- Types ---
export interface GameContext {
  gameId: string;
  roster: Record<string, SocialPlayer>;
  manifest: GameManifest | null;
  dayIndex: number;
  nextWakeup: number | null;
  lastProcessedTime: number;
}

export type GameEvent = 
  | { type: 'SYSTEM.INIT'; payload: { roster: Roster; manifest: GameManifest }; gameId: string }
  | { type: 'SYSTEM.WAKEUP' }
  | { type: 'SYSTEM.PAUSE' }
  | { type: 'ADMIN.NEXT_STAGE' }
  | { type: 'ADMIN.INJECT_TIMELINE_EVENT'; payload: { action: string; payload?: any } }
  | { type: 'FACT.RECORD'; fact: Fact }
  | { type: 'INTERNAL.READY' };

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
      manifest: ({ event }) => (event.type === 'SYSTEM.INIT' ? event.payload.manifest : null),
      dayIndex: 0,
      lastProcessedTime: 0,
    }),
    incrementDay: assign({
      dayIndex: ({ context }) => context.dayIndex + 1
    }),
    scheduleGameStart: assign({
      nextWakeup: ({ context }) => {
        if (context.manifest?.gameMode === 'DEBUG_PECKING_ORDER') {
          console.log("[L2] Debug Mode: Skipping Game Start Alarm. Waiting for Admin trigger.");
          return null;
        }
        console.log("[L2] Scheduling Game Start (1s)...");
        return Date.now() + 1000;
      }
    }),
    scheduleNextTimelineEvent: assign({
      nextWakeup: ({ context }) => {
        if (!context.manifest) return null;
        
        // Manual Mode Check
        if (context.manifest.gameMode === 'DEBUG_PECKING_ORDER') {
           console.log("[L2] Debug Mode: Skipping automatic scheduling.");
           return null;
        }

        const currentDay = context.manifest.days.find(d => d.dayIndex === context.dayIndex);
        if (!currentDay) {
          console.warn(`[L2] Day ${context.dayIndex} not found in manifest.`);
          return null; 
        }

        const now = Date.now();
        const effectiveNow = Math.max(now, context.lastProcessedTime);
        const nextEvent = currentDay.timeline.find(e => new Date(e.time).getTime() > effectiveNow + 100);

        if (nextEvent) {
          console.log(`[L2] Scheduling next event: ${nextEvent.action} at ${nextEvent.time}`);
          return new Date(nextEvent.time).getTime();
        } else {
          console.log(`[L2] No more events for Day ${context.dayIndex}.`);
          return null; 
        }
      }
    }),
    processTimelineEvent: assign(({ context, self }) => {
      if (!context.manifest) return {};
      const currentDay = context.manifest.days.find(d => d.dayIndex === context.dayIndex);
      if (!currentDay) return {};

      const now = Date.now();
      let newProcessedTime = context.lastProcessedTime;
      
      const recentEvents = currentDay.timeline.filter(e => {
        const t = new Date(e.time).getTime();
        return t > context.lastProcessedTime && t <= now + 2000 && t > now - 10000;
      });

      if (recentEvents.length === 0) return {};

      // Child is GUARANTEED to exist because we are in 'running' state which waits for INTERNAL.READY
      const child = self.getSnapshot().children['l3-session'];

      for (const e of recentEvents) {
        if (e.action === 'END_DAY') {
             console.log(`[L2] Processing Timeline Event (Self): ${e.action}`);
             self.send({ type: 'ADMIN.NEXT_STAGE' }); 
             newProcessedTime = Math.max(newProcessedTime, new Date(e.time).getTime());
        } else {
             if (child) {
               console.log(`[L2] Processing Timeline Event (Child): ${e.action}`);
               child.send({ type: `INTERNAL.${e.action}`, payload: e.payload });
               newProcessedTime = Math.max(newProcessedTime, new Date(e.time).getTime());
             } else {
               // This should theoretically never happen now
               console.error(`[L2] 💥 CRITICAL: Child missing in 'running' state.`);
             }
        }
      }
      
      return { lastProcessedTime: newProcessedTime };
    }),
    logToJournal: ({ event }) => {
      if (event.type !== 'FACT.RECORD') return;
      console.log(`[L2 Journal] ✍️ Writing Fact to D1: ${event.fact.type} by ${event.fact.actorId}`);
      // TODO: Actual D1 Insert
    },
    // New Action for Manual Injection
    injectAdminEvent: ({ event, self }) => {
      if (event.type !== 'ADMIN.INJECT_TIMELINE_EVENT') return;
      
      console.log(`[L2] 💉 Admin Injecting Event: ${event.payload.action}`);
      
      if (event.payload.action === 'END_DAY') {
        self.send({ type: 'ADMIN.NEXT_STAGE' });
      } else {
        const child = self.getSnapshot().children['l3-session'];
        if (child) {
          child.send({ type: `INTERNAL.${event.payload.action}`, payload: event.payload.payload });
        } else {
          console.warn(`[L2] Cannot inject event. Child session not ready.`);
        }
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
    manifest: null,
    dayIndex: 0,
    nextWakeup: null,
    lastProcessedTime: 0
  },
  states: {
    uninitialized: {
      on: {
        'SYSTEM.INIT': {
          target: 'preGame',
          actions: ['initializeContext']
        }
      }
    },
    preGame: {
      entry: ['scheduleGameStart'], 
      on: {
        'SYSTEM.WAKEUP': { target: 'dayLoop' },
        'ADMIN.NEXT_STAGE': { target: 'dayLoop' }
      }
    },
    dayLoop: {
      initial: 'morningBriefing',
      states: {
        morningBriefing: {
          entry: ['incrementDay', 'scheduleNextTimelineEvent'],
          on: {
            'ADMIN.NEXT_STAGE': { target: 'activeSession' },
            'SYSTEM.WAKEUP': { 
               target: 'activeSession' 
            }
          }
        },
        activeSession: {
          invoke: {
            id: 'l3-session',
            src: 'dailySessionMachine',
            input: ({ context }) => ({
              dayIndex: context.dayIndex,
              roster: context.roster,
              manifest: context.manifest?.days.find(d => d.dayIndex === context.dayIndex)
            }),
            onDone: {
              target: 'nightSummary',
              actions: ({ event }) => console.log(`[L2] L3 Finished naturally.`)
            }
          },
          initial: 'waitingForChild',
          states: {
            waitingForChild: {
              on: {
                'INTERNAL.READY': { target: 'running' }
              }
            },
            running: {
              entry: ['processTimelineEvent', 'scheduleNextTimelineEvent'],
              on: {
                'SYSTEM.WAKEUP': { 
                   actions: ['processTimelineEvent', 'scheduleNextTimelineEvent']
                }
              }
            }
          },
          on: {
            'ADMIN.NEXT_STAGE': { target: 'nightSummary' },
            'FACT.RECORD': { actions: 'logToJournal' },
            'INTERNAL.READY': { actions: ({ self }) => self.send({ type: 'INTERNAL.READY' }) },
            'ADMIN.INJECT_TIMELINE_EVENT': { actions: 'injectAdminEvent' }
          }
        },
        nightSummary: {
          entry: ['scheduleNextTimelineEvent'],
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