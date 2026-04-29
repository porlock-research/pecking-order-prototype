import { setup, assign, sendTo, raise } from 'xstate';
import type { AnyActorRef } from 'xstate';
import { dailySessionMachine } from './l3-session';
import { pregameMachine } from './l3-pregame';
import { postGameMachine } from './l4-post-game';
import { SocialPlayer, Roster, GameManifest, Fact, SocialEvent, VoteResult, DmRejectedEvent, GameHistoryEntry, DailyManifest, Events, PlayerStatuses, QaEntry, type DilemmaOutput } from '@pecking-order/shared-types';
import type { GameOutput } from '@pecking-order/game-cartridges';
import type { PromptOutput } from '@pecking-order/cartridges';
import { log } from '../log';

import { l2InitializationActions } from './actions/l2-initialization';
import { l2TimelineActions } from './actions/l2-timeline';
import { l2EliminationActions } from './actions/l2-elimination';
import { l2EconomyActions } from './actions/l2-economy';
import { l2FactsActions } from './actions/l2-facts';
import { l2DayResolutionActions, l2DayResolutionGuards } from './actions/l2-day-resolution';
import { createGameMasterMachine } from './game-master';

// --- Types ---
export interface GameContext {
  gameId: string;
  inviteCode: string;
  roster: Record<string, SocialPlayer>;
  manifest: GameManifest | null;
  dayIndex: number;
  lastProcessedTime: number;
  restoredChatLog?: any[]; // For rehydration only
  lastJournalEntry: number; // Triggers state change for syncing
  goldPool: number;
  pendingElimination: VoteResult | null;
  winner: { playerId: string; mechanism: 'FINALS'; summary: Record<string, any> } | null;
  goldPayouts: Array<{ playerId: string; amount: number; reason: string }>;
  gameHistory: GameHistoryEntry[];
  completedPhases: Array<{
    kind: 'voting' | 'game' | 'prompt' | 'dilemma';
    dayIndex: number;
    completedAt: number;
    [key: string]: any;
  }>;
  // Game Master (dynamic mode only)
  gameMasterRef: AnyActorRef | null;
}

export type GameEvent =
  | { type: 'SYSTEM.INIT'; payload: { roster: Roster; manifest: GameManifest }; gameId: string; inviteCode: string }
  | { type: 'SYSTEM.PLAYER_JOINED'; player: { id: string; realUserId: string; personaName: string; avatarUrl: string; bio: string; silver: number; gold: number; qaAnswers?: QaEntry[] } }
  | { type: 'SYSTEM.WAKEUP' }
  | { type: 'SYSTEM.PAUSE' }
  | { type: 'ADMIN.NEXT_STAGE' }
  | { type: 'ADMIN.INJECT_TIMELINE_EVENT'; payload: { action: string; payload?: any } }
  | { type: 'ADMIN.ELIMINATE_PLAYER'; playerId: string; reason?: string }
  | { type: 'ADMIN.UPDATE_PUSH_CONFIG'; pushConfig: Record<string, boolean> }
  | { type: 'FACT.RECORD'; fact: Fact }
  | { type: 'INTERNAL.READY' }
  | { type: `VOTE.${string}`; senderId: string; targetId?: string; [key: string]: any }
  | { type: `GAME.${string}`; senderId: string; [key: string]: any }
  | { type: 'CARTRIDGE.VOTE_RESULT'; result: VoteResult }
  | { type: 'CARTRIDGE.GAME_RESULT'; result: GameOutput }
  | { type: 'CARTRIDGE.PLAYER_GAME_RESULT'; playerId: string; silverReward: number; goldContribution?: number }
  | { type: 'CARTRIDGE.PROMPT_RESULT'; result: PromptOutput; promptType?: string; promptText?: string; participantCount?: number; results?: any }
  | { type: 'CARTRIDGE.DILEMMA_RESULT'; result: DilemmaOutput }
  | { type: `ACTIVITY.${string}`; senderId: string; [key: string]: any }
  | { type: `DILEMMA.${string}`; senderId: string; [key: string]: any }
  | { type: 'ECONOMY.CREDIT_SILVER'; rewards: Record<string, number> }
  | { type: 'ECONOMY.CONTRIBUTE_GOLD'; amount: number; source: string }
  | { type: 'SOCIAL.USE_PERK'; senderId: string; perkType: string; targetId?: string }
  | { type: 'PERK.RESULT'; senderId: string; result: any }
  | { type: 'PERK.REJECTED'; senderId: string; reason: string }
  | { type: 'SILVER_TRANSFER.REJECTED'; senderId: string; reason: string }
  | { type: 'CHANNEL.REJECTED'; reason: string; senderId: string }
  | { type: 'PUSH.PHASE'; trigger: string }
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
    ...l2DayResolutionActions,
  } as any,
  guards: {
    ...l2DayResolutionGuards,
  } as any,
  actors: {
    dailySessionMachine,
    pregameMachine,
    postGameMachine,
    gameMasterMachine: createGameMasterMachine(),
  }
// XState v5 setup() can't infer action string names from externally-defined
// action objects, so we cast the machine config. Runtime behavior is correct.
}).createMachine({
  id: 'pecking-order-l2',
  initial: 'uninitialized',
  // Top-level error handler for the spawned game-master actor. Without this,
  // a GM crash (e.g. resolveDay throwing on a bad manifest) silently wedges
  // L2 in `activeSession.waitingForChild` — events continue to arrive but
  // transitions no-op. Consuming the error event here keeps L2 live and
  // surfaces the failure in Axiom. See
  // memory/reference_schedule_preset_required.md for the diagnosis.
  on: {
    'xstate.error.actor.game-master': {
      actions: ({ event }: any) =>
        log('error', 'L2', 'Game master actor errored', {
          error: String((event as any)?.error ?? (event as any)?.data ?? 'unknown'),
          stack: (event as any)?.error?.stack,
        }),
    },
    // Live patch of manifest.pushConfig — admin-driven, accepts a partial map
    // of trigger → boolean and merges into the existing pushConfig (missing
    // entries fall back to DEFAULT_PUSH_CONFIG via isPushEnabled). Available
    // in every state so the playtest host can quiet noisy notifications
    // without needing to re-init the DO.
    'ADMIN.UPDATE_PUSH_CONFIG': {
      actions: [
        assign({
          manifest: ({ context, event }: any) => {
            if (!context.manifest) return context.manifest;
            return {
              ...context.manifest,
              pushConfig: { ...(context.manifest.pushConfig ?? {}), ...event.pushConfig },
            };
          },
        }),
        ({ event }: any) =>
          log('info', 'L2', 'pushConfig patched', {
            keys: Object.keys(event.pushConfig ?? {}).join(','),
          }),
      ],
    },
  },
  context: {
    gameId: '',
    inviteCode: '',
    roster: {},
    manifest: null,
    dayIndex: 0,
    lastProcessedTime: 0,
    lastJournalEntry: 0,
    goldPool: 0,
    goldPayouts: [],
    pendingElimination: null,
    winner: null,
    gameHistory: [],
    completedPhases: [],
    gameMasterRef: null,
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
      entry: ['spawnGameMasterIfDynamic'],
      invoke: {
        id: 'l3-pregame',
        src: 'pregameMachine',
      },
      on: {
        'SYSTEM.WAKEUP': { target: 'dayLoop' },
        'ADMIN.NEXT_STAGE': { target: 'dayLoop' },
        'SYSTEM.PLAYER_JOINED': {
          actions: [
            assign({
              roster: ({ context, event }: any) => ({
                ...context.roster,
                [event.player.id]: {
                  id: event.player.id,
                  personaName: event.player.personaName,
                  avatarUrl: event.player.avatarUrl,
                  bio: event.player.bio || '',
                  status: 'ALIVE',
                  silver: event.player.silver,
                  gold: event.player.gold,
                  realUserId: event.player.realUserId,
                  qaAnswers: event.player.qaAnswers,
                }
              })
            }),
            sendTo('l3-pregame', ({ event }: any) => event),
          ],
        },
        // Player opened the WS for the first time. l3-pregame uses this as the
        // trigger for the auto-reveal "first impression" beat. Idempotent —
        // l3-pregame's handler checks firstConnectedAt and only fires once.
        // Sent unconditionally from L1 for every connect; only handled here
        // (in preGame). After dayLoop, no l3-pregame exists and the wildcard
        // would otherwise route nowhere — explicit handler keeps semantics clear.
        'SYSTEM.PLAYER_CONNECTED': {
          actions: sendTo('l3-pregame', ({ event }: any) => event),
        },
        'FACT.RECORD': {
          actions: ['updateJournalTimestamp', 'applyFactToRoster', 'persistFactToD1'],
        },
        '*': [
          {
            guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Pregame.PREFIX),
            actions: sendTo('l3-pregame', ({ event }: any) => event),
          },
          {
            // Pregame social allowlist: group chat is open (SEND_MSG + REACT on
            // MAIN), whispers are intrigue-only, nudges ping a specific player
            // ("hey you, I see you" before Day 1). Silver/DM stay closed —
            // the pregame MAIN channel doesn't carry those capabilities and the
            // pregame actor has no handler, so those events silently no-op.
            guard: ({ event }: any) =>
              event.type === Events.Social.WHISPER ||
              event.type === Events.Social.SEND_MSG ||
              event.type === Events.Social.REACT ||
              event.type === Events.Social.NUDGE,
            actions: sendTo('l3-pregame', ({ event }: any) => event),
          },
        ],
      }
    },
    dayLoop: {
      initial: 'morningBriefing',
      states: {
        morningBriefing: {
          entry: ['incrementDay', 'sendAndCaptureGameMasterDay', 'resolveCurrentDay', 'clearRestoredChatLog', raise({ type: 'PUSH.PHASE', trigger: 'DAY_START' } as any)],
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
              actions: () => console.log(JSON.stringify({ level: 'info', component: 'L2', event: 'l3.done' }))
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
              entry: ['processTimelineEvent'],
              on: {
                'SYSTEM.WAKEUP': {
                   actions: ['processTimelineEvent']
                }
              }
            }
          },
          on: {
            'ADMIN.NEXT_STAGE': { target: 'nightSummary' },
            'FACT.RECORD': {
                actions: ['updateJournalTimestamp', 'applyFactToRoster', 'persistFactToD1', 'forwardFactToGameMaster'],
                target: undefined,
                reenter: false,
                internal: true
            },
            'CARTRIDGE.VOTE_RESULT': { actions: ['storeVoteResult'] },
            'CARTRIDGE.GAME_RESULT': { actions: ['recordGameResult', 'recordCompletedGame', 'emitGameResultFact', 'raiseGameEconomyEvents'] },
            'CARTRIDGE.PLAYER_GAME_RESULT': { actions: ['emitPlayerGameResultFact', 'raisePlayerGameEconomyEvent'] },
            'CARTRIDGE.PROMPT_RESULT': { actions: ['recordCompletedPrompt', 'emitPromptResultFact', 'raisePromptEconomyEvents'] },
            'CARTRIDGE.DILEMMA_RESULT': { actions: ['emitDilemmaResultFact', 'raiseDilemmaEconomyEvents', 'recordCompletedDilemma'] },
            'ADMIN.ELIMINATE_PLAYER': { actions: 'adminEliminatePlayer' },
            'ECONOMY.CREDIT_SILVER': { actions: 'applySilverCredit' },
            'ECONOMY.CONTRIBUTE_GOLD': { actions: 'applyGoldContribution' },
            'DM.REJECTED': { actions: 'sendDmRejection' },
            'SILVER_TRANSFER.REJECTED': { actions: 'sendSilverTransferRejection' },
            'CHANNEL.REJECTED': { actions: 'sendChannelRejection' },
            'PERK.RESULT': { actions: 'deliverPerkResult' },
            'PERK.REJECTED': { actions: 'deliverPerkResult' },
            'PUSH.PHASE': { actions: 'broadcastPhasePush' },
            '*': [
              {
                guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Social.PREFIX),
                actions: sendTo('l3-session', ({ event }: any) => event),
              },
              {
                guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Vote.PREFIX),
                actions: sendTo('l3-session', ({ event }: any) => event),
              },
              {
                guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Game.PREFIX),
                actions: sendTo('l3-session', ({ event }: any) => event),
              },
              {
                guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Activity.PREFIX),
                actions: sendTo('l3-session', ({ event }: any) => event),
              },
              {
                guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Dilemma.PREFIX),
                actions: sendTo('l3-session', ({ event }: any) => event),
              },
              {
                guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Confession.PREFIX),
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
                // ELIMINATE: schedulable timeline event that applies the pending
                // voting elimination early (before END_DAY), enabling a post-vote
                // chat window with status already flipped. Both actions are
                // idempotent — pendingElimination is cleared by processNightSummary,
                // so the same actions in nightSummary entry no-op the second time.
                // Presets that don't schedule ELIMINATE keep the original behavior:
                // elim applies at END_DAY when nightSummary entry fires.
                guard: ({ event }: any) => event.payload?.action === 'ELIMINATE',
                actions: [
                  'logAdminInject',
                  'recordCompletedVoting',
                  'processNightSummary',
                ],
              },
              {
                // Ruleset gate: skip START_CONFESSION_CHAT when confessions.enabled !== true.
                guard: ({ context, event }: any) =>
                  event.payload?.action === 'START_CONFESSION_CHAT' &&
                  (context.manifest as any)?.ruleset?.confessions?.enabled !== true,
                actions: ({ event }: any) => log('info', 'confession', 'skip-start', {
                  reason: 'ruleset-disabled',
                  action: event.payload?.action,
                }),
              },
              {
                // Alive-count guard: at least 2 alive players required.
                guard: ({ context, event }: any) => {
                  if (event.payload?.action !== 'START_CONFESSION_CHAT') return false;
                  const aliveCount = Object.values(context.roster || {})
                    .filter((p: any) => p?.status === PlayerStatuses.ALIVE).length;
                  return aliveCount < 2;
                },
                actions: ({ context }: any) => log('info', 'confession', 'skip-start', {
                  reason: 'insufficient-players',
                  aliveCount: Object.values(context.roster || {})
                    .filter((p: any) => p?.status === PlayerStatuses.ALIVE).length,
                }),
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
          entry: ['recordCompletedVoting', 'processNightSummary', 'processGameMasterActions', 'sendDayEndedToGameMaster', raise({ type: 'PUSH.PHASE', trigger: 'NIGHT_SUMMARY' } as any)],
          always: [
            { guard: 'isGameComplete', target: '#pecking-order-l2.gameSummary' },
          ],
          on: {
            'ADMIN.NEXT_STAGE': [
              { guard: 'isGameComplete', target: '#pecking-order-l2.gameSummary' },
              { target: 'morningBriefing' },
            ],
            'SYSTEM.WAKEUP': [
              { guard: 'isGameComplete', target: '#pecking-order-l2.gameSummary' },
              { target: 'morningBriefing' },
            ],
            'ADMIN.INJECT_TIMELINE_EVENT': {
              actions: ({ event }: any) =>
                console.warn(JSON.stringify({
                  level: 'warn', component: 'L2', event: 'admin.inject.dropped',
                  reason: 'nightSummary has no L3', action: event.payload?.action,
                })),
            },
            'FACT.RECORD': {
              actions: ['updateJournalTimestamp', 'applyFactToRoster', 'persistFactToD1'],
            },
            'ADMIN.ELIMINATE_PLAYER': { actions: 'adminEliminatePlayer' },
            'ECONOMY.CREDIT_SILVER': { actions: 'applySilverCredit' },
            'ECONOMY.CONTRIBUTE_GOLD': { actions: 'applyGoldContribution' },
            'PUSH.PHASE': { actions: 'broadcastPhasePush' },
          }
        }
      },
      always: [
        { guard: 'isDayIndexPastEnd', target: 'gameSummary' }
      ]
    },
    gameSummary: {
      entry: ['sendGameEndedToGameMaster'],
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
