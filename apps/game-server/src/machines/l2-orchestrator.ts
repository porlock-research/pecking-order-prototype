import { setup, assign, sendTo, enqueueActions, raise } from 'xstate';
import { dailySessionMachine } from './l3-session';
import { SocialPlayer, Roster, GameManifest, Fact, SocialEvent, VoteResult, DmRejectedEvent } from '@pecking-order/shared-types';
import type { GameOutput } from './cartridges/games/_contract';

// --- Types ---
export interface GameContext {
  gameId: string;
  roster: Record<string, SocialPlayer>;
  manifest: GameManifest | null;
  dayIndex: number;
  nextWakeup: number | null;
  lastProcessedTime: number;
  restoredChatLog?: any[]; // For rehydration only
  lastJournalEntry: number; // Triggers state change for syncing
  pendingElimination: VoteResult | null;
}

export type GameEvent =
  | { type: 'SYSTEM.INIT'; payload: { roster: Roster; manifest: GameManifest }; gameId: string }
  | { type: 'SYSTEM.WAKEUP' }
  | { type: 'SYSTEM.PAUSE' }
  | { type: 'ADMIN.NEXT_STAGE' }
  | { type: 'ADMIN.INJECT_TIMELINE_EVENT'; payload: { action: string; payload?: any } }
  | { type: 'FACT.RECORD'; fact: Fact }
  | { type: 'INTERNAL.READY' }
  | { type: `VOTE.${string}`; senderId: string; targetId?: string; [key: string]: any }
  | { type: `GAME.${string}`; senderId: string; [key: string]: any }
  | { type: 'CARTRIDGE.VOTE_RESULT'; result: VoteResult }
  | { type: 'CARTRIDGE.GAME_RESULT'; result: GameOutput }
  | { type: 'CARTRIDGE.PLAYER_GAME_RESULT'; playerId: string; silverReward: number }
  | DmRejectedEvent
  | (SocialEvent & { senderId: string });

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
      lastJournalEntry: 0
    }),
    incrementDay: assign({
      dayIndex: ({ context }) => context.dayIndex + 1
    }),
    clearRestoredChatLog: assign({
      restoredChatLog: undefined
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
    processTimelineEvent: enqueueActions(({ enqueue, context }) => {
      if (!context.manifest) return;
      if (context.manifest.gameMode === 'DEBUG_PECKING_ORDER') return;
      const currentDay = context.manifest.days.find(d => d.dayIndex === context.dayIndex);
      if (!currentDay) return;

      const now = Date.now();
      let newProcessedTime = context.lastProcessedTime;

      const recentEvents = currentDay.timeline.filter(e => {
        const t = new Date(e.time).getTime();
        return t > context.lastProcessedTime && t <= now + 2000 && t > now - 10000;
      });

      if (recentEvents.length === 0) return;

      for (const e of recentEvents) {
        console.log(`[L2] Processing Timeline Event: ${e.action}`);
        if (e.action === 'END_DAY') {
          enqueue.raise({ type: 'ADMIN.NEXT_STAGE' } as any);
        } else {
          // Route through the machine's own ADMIN.INJECT_TIMELINE_EVENT handler
          // which uses declarative sendTo('l3-session', ...) to reach the child
          enqueue.raise({ type: 'ADMIN.INJECT_TIMELINE_EVENT', payload: { action: e.action, payload: e.payload } } as any);
        }
        newProcessedTime = Math.max(newProcessedTime, new Date(e.time).getTime());
      }

      enqueue.assign({ lastProcessedTime: newProcessedTime });
    }),
    updateJournalTimestamp: assign(({ event }) => {
      if (event.type !== 'FACT.RECORD') return {};
      console.log(`[L2 Journal] ✍️ Fact received: ${event.fact.type} by ${event.fact.actorId}`);
      return { lastJournalEntry: Date.now() };
    }),
    persistFactToD1: () => {
      // No-op in L2 — overridden by L1 via .provide() to inject D1 binding
    },
    logAdminInject: ({ event }) => {
      if (event.type === 'ADMIN.INJECT_TIMELINE_EVENT') {
        console.log(`[L2] 💉 Admin Injecting Event: ${event.payload.action}`);
      }
    },
    // Elimination pipeline actions
    storeVoteResult: assign({
      pendingElimination: ({ event }) =>
        event.type === 'CARTRIDGE.VOTE_RESULT' ? event.result : null
    }),
    // Consolidated nightSummary action: apply elimination + emit FACT.RECORD + clear pending.
    // Uses enqueueActions to capture pendingElimination data BEFORE assigns clear it,
    // because XState v5 runs all assigns before effects in a single action batch.
    processNightSummary: enqueueActions(({ enqueue, context }) => {
      const pending = context.pendingElimination;
      if (pending?.eliminatedId) {
        const id = pending.eliminatedId;
        console.log(`[L2] 💀 Eliminating player: ${id}`);
        enqueue.assign({
          roster: {
            ...context.roster,
            [id]: { ...context.roster[id], status: 'ELIMINATED' as const }
          }
        });
        // Emit through the normal fact pipeline (D1 journal + ticker)
        enqueue.raise({
          type: 'FACT.RECORD',
          fact: {
            type: 'ELIMINATION',
            actorId: 'SYSTEM',
            targetId: id,
            payload: { mechanism: pending.mechanism, summary: pending.summary },
            timestamp: Date.now(),
          },
        } as any);
      }
      enqueue.assign({ pendingElimination: null });
    }),
    applyGameRewards: assign({
      roster: ({ context, event }) => {
        if (event.type !== 'CARTRIDGE.GAME_RESULT') return context.roster;
        const result = (event as any).result as GameOutput;
        if (!result?.silverRewards) return context.roster;
        const updated = { ...context.roster };
        for (const [pid, silver] of Object.entries(result.silverRewards)) {
          if (updated[pid]) {
            updated[pid] = { ...updated[pid], silver: updated[pid].silver + silver };
          }
        }
        console.log(`[L2] Applied game silver rewards:`, result.silverRewards);
        return updated;
      }
    }),
    // Raise a FACT.RECORD for game results so it flows through the normal
    // fact pipeline (D1 journal + ticker). We do this here instead of relying
    // on sendParent from the game cartridge's final state, because XState v5
    // deferred effects from a completing child actor may not be delivered.
    emitGameResultFact: raise(({ event }) => {
      const result = (event as any).result as GameOutput;
      return {
        type: 'FACT.RECORD',
        fact: {
          type: 'GAME_RESULT',
          actorId: 'SYSTEM',
          payload: {
            players: Object.fromEntries(
              Object.entries(result.silverRewards || {}).map(([pid, silver]: [string, number]) => [pid, { silverReward: silver }])
            ),
            goldContribution: result.goldContribution || 0,
          },
          timestamp: Date.now(),
        },
      } as any;
    }),
    // Per-player game reward: apply silver to L2 roster immediately
    applyPlayerGameReward: assign({
      roster: ({ context, event }) => {
        const { playerId, silverReward } = event as any;
        if (!playerId || !silverReward) return context.roster;
        const player = context.roster[playerId];
        if (!player) return context.roster;
        return { ...context.roster, [playerId]: { ...player, silver: player.silver + silverReward } };
      }
    }),
    emitPlayerGameResultFact: raise(({ event }) => ({
      type: 'FACT.RECORD',
      fact: {
        type: 'PLAYER_GAME_RESULT',
        actorId: (event as any).playerId,
        payload: { silverReward: (event as any).silverReward },
        timestamp: Date.now(),
      },
    } as any)),
    applyFactToRoster: assign({
      roster: ({ context, event }) => {
        if (event.type !== 'FACT.RECORD') return context.roster;
        const fact = (event as any).fact;
        switch (fact.type) {
          case 'DM_SENT': {
            const sender = context.roster[fact.actorId];
            if (!sender) return context.roster;
            return { ...context.roster, [fact.actorId]: { ...sender, silver: sender.silver - 1 } };
          }
          case 'SILVER_TRANSFER': {
            const from = context.roster[fact.actorId];
            const to = context.roster[fact.targetId];
            if (!from || !to) return context.roster;
            const amount = fact.payload?.amount || 0;
            return {
              ...context.roster,
              [fact.actorId]: { ...from, silver: from.silver - amount },
              [fact.targetId]: { ...to, silver: to.silver + amount },
            };
          }
          default:
            return context.roster;
        }
      }
    }),
    sendDmRejection: () => {
      // No-op in L2. Overridden by L1 via .provide() to send rejection to specific client.
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
    lastProcessedTime: 0,
    lastJournalEntry: 0,
    pendingElimination: null
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
          entry: ['incrementDay', 'clearRestoredChatLog'],
          always: 'activeSession'
        },
        activeSession: {
          invoke: {
            id: 'l3-session',
            src: 'dailySessionMachine',
            input: ({ context }) => ({
              dayIndex: context.dayIndex,
              roster: context.roster,
              manifest: context.manifest?.days.find(d => d.dayIndex === context.dayIndex),
              initialChatLog: context.restoredChatLog
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
            'FACT.RECORD': {
                actions: ['updateJournalTimestamp', 'applyFactToRoster', 'persistFactToD1'],
                // Force state update to trigger persistence/sync
                target: undefined, // Stay in current state
                reenter: false,
                internal: true
            },
            'SOCIAL.SEND_MSG': { actions: sendTo('l3-session', ({ event }) => event) },
            'SOCIAL.SEND_SILVER': { actions: sendTo('l3-session', ({ event }) => event) },
            'CARTRIDGE.VOTE_RESULT': { actions: 'storeVoteResult' },
            'CARTRIDGE.GAME_RESULT': { actions: ['applyGameRewards', 'emitGameResultFact'] },
            'CARTRIDGE.PLAYER_GAME_RESULT': { actions: ['applyPlayerGameReward', 'emitPlayerGameResultFact'] },
            'DM.REJECTED': { actions: 'sendDmRejection' },
            '*': [
              {
                guard: ({ event }) => typeof event.type === 'string' && event.type.startsWith('VOTE.'),
                actions: sendTo('l3-session', ({ event }) => event),
              },
              {
                guard: ({ event }) => typeof event.type === 'string' && event.type.startsWith('GAME.'),
                actions: sendTo('l3-session', ({ event }) => event),
              }
            ],
            'ADMIN.INJECT_TIMELINE_EVENT': [
              {
                guard: ({ event }) => (event as any).payload?.action === 'END_DAY',
                actions: [
                  'logAdminInject',
                  raise({ type: 'ADMIN.NEXT_STAGE' } as any)
                ]
              },
              {
                actions: [
                  'logAdminInject',
                  sendTo('l3-session', ({ event }) => ({
                    type: `INTERNAL.${(event as any).payload.action}`,
                    payload: (event as any).payload.payload
                  }))
                ]
              }
            ]
          }
        },
        nightSummary: {
          entry: ['processNightSummary', 'scheduleNextTimelineEvent'],
          on: {
            'ADMIN.NEXT_STAGE': { target: 'morningBriefing' },
            'SYSTEM.WAKEUP': { target: 'morningBriefing' },
            // Handle FACT.RECORD raised by processNightSummary (elimination facts)
            'FACT.RECORD': {
              actions: ['updateJournalTimestamp', 'applyFactToRoster', 'persistFactToD1'],
            }
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