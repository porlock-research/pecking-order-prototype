import { setup, assign, sendTo, raise } from 'xstate';
import { dailySessionMachine } from './l3-session';
import { postGameMachine } from './l4-post-game';
import { SocialPlayer, Roster, GameManifest, Fact, SocialEvent, VoteResult, DmRejectedEvent, GameHistoryEntry } from '@pecking-order/shared-types';
import type { GameOutput } from '@pecking-order/game-cartridges';
import type { PromptOutput } from './cartridges/prompts/_contract';

import { l2InitializationActions } from './actions/l2-initialization';
import { l2TimelineActions } from './actions/l2-timeline';
import { l2EliminationActions } from './actions/l2-elimination';
import { l2EconomyActions } from './actions/l2-economy';
import { l2FactsActions } from './actions/l2-facts';

// --- Types ---
export interface GameContext {
  gameId: string;
  inviteCode: string;
  roster: Record<string, SocialPlayer>;
  manifest: GameManifest | null;
  dayIndex: number;
  nextWakeup: number | null;
  lastProcessedTime: number;
  restoredChatLog?: any[]; // For rehydration only
  lastJournalEntry: number; // Triggers state change for syncing
  pendingElimination: VoteResult | null;
  winner: { playerId: string; mechanism: 'FINALS'; summary: Record<string, any> } | null;
  gameHistory: GameHistoryEntry[];
}

export type GameEvent =
  | { type: 'SYSTEM.INIT'; payload: { roster: Roster; manifest: GameManifest }; gameId: string; inviteCode: string }
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
  | { type: 'CARTRIDGE.PROMPT_RESULT'; result: PromptOutput }
  | { type: `ACTIVITY.${string}`; senderId: string; [key: string]: any }
  | { type: 'SOCIAL.USE_PERK'; senderId: string; perkType: string; targetId?: string }
  | { type: 'PERK.RESULT'; senderId: string; result: any }
  | { type: 'PERK.REJECTED'; senderId: string; reason: string }
  | { type: 'SILVER_TRANSFER.REJECTED'; senderId: string; reason: string }
  | { type: 'CHANNEL.REJECTED'; reason: string; senderId: string }
  | DmRejectedEvent
  | (SocialEvent & { senderId: string });

// --- The L2 Orchestrator Machine ---
export const orchestratorMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  actions: {
    ...l2InitializationActions,
    ...l2TimelineActions,
    ...l2EliminationActions,
    ...l2EconomyActions,
    ...l2FactsActions,
  } as any,
  actors: {
    dailySessionMachine,
    postGameMachine,
  }
// XState v5 setup() can't infer action string names from externally-defined
// action objects, so we cast the machine config. Runtime behavior is correct.
}).createMachine({
  id: 'pecking-order-l2',
  initial: 'uninitialized',
  context: {
    gameId: '',
    inviteCode: '',
    roster: {},
    manifest: null,
    dayIndex: 0,
    nextWakeup: null,
    lastProcessedTime: 0,
    lastJournalEntry: 0,
    pendingElimination: null,
    winner: null,
    gameHistory: [],
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
            input: ({ context }: any) => ({
              dayIndex: context.dayIndex,
              roster: context.roster,
              manifest: context.manifest?.days.find((d: any) => d.dayIndex === context.dayIndex),
              initialChatLog: context.restoredChatLog
            }),
            onDone: {
              target: 'nightSummary',
              actions: ({ event }: any) => console.log(`[L2] L3 Finished naturally.`)
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
                target: undefined,
                reenter: false,
                internal: true
            },
            'SOCIAL.SEND_MSG': { actions: sendTo('l3-session', ({ event }: any) => event) },
            'SOCIAL.SEND_SILVER': { actions: sendTo('l3-session', ({ event }: any) => event) },
            'CARTRIDGE.VOTE_RESULT': { actions: 'storeVoteResult' },
            'CARTRIDGE.GAME_RESULT': { actions: ['applyGameRewards', 'recordGameResult', 'emitGameResultFact'] },
            'CARTRIDGE.PLAYER_GAME_RESULT': { actions: ['applyPlayerGameReward', 'emitPlayerGameResultFact'] },
            'CARTRIDGE.PROMPT_RESULT': { actions: ['applyPromptRewards', 'emitPromptResultFact'] },
            'DM.REJECTED': { actions: 'sendDmRejection' },
            'SILVER_TRANSFER.REJECTED': { actions: 'sendSilverTransferRejection' },
            'SOCIAL.USE_PERK': { actions: sendTo('l3-session', ({ event }: any) => event) },
            'SOCIAL.CREATE_CHANNEL': { actions: sendTo('l3-session', ({ event }: any) => event) },
            'CHANNEL.REJECTED': { actions: 'sendChannelRejection' },
            'PERK.RESULT': { actions: 'deliverPerkResult' },
            'PERK.REJECTED': { actions: 'deliverPerkResult' },
            '*': [
              {
                guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith('VOTE.'),
                actions: sendTo('l3-session', ({ event }: any) => event),
              },
              {
                guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith('GAME.'),
                actions: sendTo('l3-session', ({ event }: any) => event),
              },
              {
                guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith('ACTIVITY.'),
                actions: sendTo('l3-session', ({ event }: any) => event),
              }
            ],
            'ADMIN.INJECT_TIMELINE_EVENT': [
              {
                guard: ({ event }: any) => event.payload?.action === 'END_DAY',
                actions: [
                  'logAdminInject',
                  raise({ type: 'ADMIN.NEXT_STAGE' } as any)
                ]
              },
              {
                actions: [
                  'logAdminInject',
                  sendTo('l3-session', ({ event }: any) => ({
                    type: `INTERNAL.${event.payload.action}`,
                    payload: event.payload.payload
                  }))
                ]
              }
            ]
          }
        },
        nightSummary: {
          entry: ['processNightSummary', 'scheduleNextTimelineEvent'],
          on: {
            'ADMIN.NEXT_STAGE': [
              { guard: ({ context }: any) => context.winner !== null, target: '#pecking-order-l2.gameSummary' },
              { target: 'morningBriefing' },
            ],
            'SYSTEM.WAKEUP': [
              { guard: ({ context }: any) => context.winner !== null, target: '#pecking-order-l2.gameSummary' },
              { target: 'morningBriefing' },
            ],
            'FACT.RECORD': {
              actions: ['updateJournalTimestamp', 'applyFactToRoster', 'persistFactToD1'],
            }
          }
        }
      },
      always: [
        { guard: ({ context }: any) => context.dayIndex > (context.manifest?.days.length ?? 7), target: 'gameSummary' }
      ]
    },
    gameSummary: {
      invoke: {
        id: 'l3-session', // Same ID so L1 extraction works unchanged
        src: 'postGameMachine',
        input: ({ context }: any) => ({ roster: context.roster, winner: context.winner }),
      },
      on: {
        'FACT.RECORD': { actions: ['updateJournalTimestamp', 'applyFactToRoster', 'persistFactToD1'] },
        'SOCIAL.SEND_MSG': { actions: sendTo('l3-session', ({ event }: any) => event) },
        'ADMIN.NEXT_STAGE': { target: 'gameOver' },
      }
    },
    gameOver: {
      type: 'final'
    }
  }
} as any);
