import { setup, assign, sendParent } from 'xstate';
import { ChatMessage, SocialPlayer, SocialEvent, AdminEvent, DailyManifest, Fact, VoteType, GameType, PromptType } from '@pecking-order/shared-types';
import { VOTE_REGISTRY } from './cartridges/voting/_registry';
import { GAME_REGISTRY } from './cartridges/games/_registry';
import { PROMPT_REGISTRY } from './cartridges/prompts/_registry';
import type { AnyActorRef } from 'xstate';

import { l3SocialActions, l3SocialGuards } from './actions/l3-social';
import { l3VotingActions } from './actions/l3-voting';
import { l3GameActions } from './actions/l3-games';
import { l3ActivityActions } from './actions/l3-activity';
import { l3PerkActions, l3PerkGuards } from './actions/l3-perks';

// 1. Define strict types
export interface DailyContext {
  dayIndex: number;
  chatLog: ChatMessage[];
  roster: Record<string, SocialPlayer>;
  manifest: DailyManifest | undefined;
  activeVotingCartridgeRef: AnyActorRef | null;
  activeGameCartridgeRef: AnyActorRef | null;
  activePromptCartridgeRef: AnyActorRef | null;
  dmsOpen: boolean;
  dmPartnersByPlayer: Record<string, string[]>;
  dmCharsByPlayer: Record<string, number>;
  perkOverrides: Record<string, { extraPartners: number; extraChars: number }>;
}

export type DailyEvent =
  | (SocialEvent & { senderId: string })
  | { type: 'INTERNAL.END_DAY' }
  | { type: 'INTERNAL.START_CARTRIDGE'; payload: any }
  | { type: 'INTERNAL.OPEN_VOTING'; payload: any }
  | { type: 'INTERNAL.CLOSE_VOTING' }
  | { type: 'INTERNAL.OPEN_DMS' }
  | { type: 'INTERNAL.CLOSE_DMS' }
  | { type: 'INTERNAL.INJECT_PROMPT'; payload: any }
  | { type: 'INTERNAL.START_GAME'; payload?: any }
  | { type: 'INTERNAL.END_GAME' }
  | { type: 'INTERNAL.START_ACTIVITY'; payload: any }
  | { type: 'INTERNAL.END_ACTIVITY' }
  | { type: `VOTE.${string}`; senderId: string; targetId?: string; [key: string]: any }
  | { type: `GAME.${string}`; senderId: string; [key: string]: any }
  | { type: `ACTIVITY.${string}`; senderId: string; [key: string]: any }
  | { type: 'FACT.RECORD'; fact: Fact }
  | AdminEvent;

export const dailySessionMachine = setup({
  types: {
    input: {} as { dayIndex: number; roster: Record<string, SocialPlayer>; manifest?: DailyManifest; initialChatLog?: ChatMessage[] },
    context: {} as DailyContext,
    events: {} as DailyEvent,
    output: {} as { reason: string }
  },
  actions: {
    ...l3SocialActions,
    ...l3VotingActions,
    ...l3GameActions,
    ...l3ActivityActions,
    ...l3PerkActions,
  } as any,
  guards: {
    ...l3SocialGuards,
    ...l3PerkGuards,
  } as any,
  actors: {
    ...VOTE_REGISTRY,
    ...GAME_REGISTRY,
    ...PROMPT_REGISTRY,
  }
// XState v5 setup() can't infer action string names from externally-defined
// action objects, so we cast the machine config. Runtime behavior is correct.
}).createMachine({
  id: 'l3-daily-session',
  context: ({ input }: any) => ({
    dayIndex: input.dayIndex || 0,
    chatLog: input.initialChatLog || [],
    roster: input.roster || {},
    manifest: input.manifest,
    activeVotingCartridgeRef: null,
    activeGameCartridgeRef: null,
    activePromptCartridgeRef: null,
    dmsOpen: false,
    dmPartnersByPlayer: {},
    dmCharsByPlayer: {},
    perkOverrides: {},
  }),
  entry: [
    sendParent({ type: 'INTERNAL.READY' })
  ],
  initial: 'running',
  states: {
    running: {
      type: 'parallel',
      states: {
        // REGION A: SOCIAL OS
        social: {
          initial: 'active',
          states: {
            active: {
              on: {
                'SOCIAL.SEND_MSG': [
                  {
                    guard: 'isDmAllowed',
                    actions: ['processDm', 'emitChatFact'],
                  },
                  {
                    guard: ({ event }: any) => !!event.targetId,
                    actions: ['rejectDm'],
                  },
                  {
                    actions: ['processMessage', 'emitChatFact'],
                  }
                ],
                'SOCIAL.SEND_SILVER': [
                  { guard: 'isSilverTransferAllowed', actions: ['transferSilver', 'emitSilverFact'] },
                  { actions: ['rejectSilverTransfer'] }
                ],
                'SOCIAL.USE_PERK': [
                  { guard: 'canAffordPerk', actions: ['deductPerkCost', 'recordPerkOverride', 'emitPerkFact'] },
                  { actions: ['rejectPerk'] }
                ],
                'INTERNAL.OPEN_DMS': { actions: assign({ dmsOpen: true }) },
                'INTERNAL.CLOSE_DMS': { actions: assign({ dmsOpen: false }) },
              }
            }
          }
        },
        // REGION B: MAIN STAGE
        mainStage: {
          initial: 'groupChat',
          states: {
            groupChat: {
              on: {
                'INTERNAL.START_CARTRIDGE': 'dailyGame',
                'INTERNAL.START_GAME': 'dailyGame',
                'INTERNAL.OPEN_VOTING': 'voting',
                'INTERNAL.INJECT_PROMPT': { actions: ({ event }: any) => console.log('Prompt:', event.payload) }
              }
            },
            dailyGame: {
              entry: 'spawnGameCartridge',
              exit: 'cleanupGameCartridge',
              on: {
                'xstate.done.actor.activeGameCartridge': {
                  target: 'groupChat',
                  actions: ['applyGameRewardsLocally', 'forwardGameResultToL2']
                },
                'CARTRIDGE.PLAYER_GAME_RESULT': {
                  actions: ['applyPlayerGameRewardLocally', 'forwardPlayerGameResultToL2']
                },
                'INTERNAL.END_GAME': { actions: 'forwardToGameChild' },
                '*': {
                  guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith('GAME.'),
                  actions: 'forwardToGameChild',
                }
              }
            },
            voting: {
              entry: 'spawnVotingCartridge',
              exit: 'cleanupVotingCartridge',
              on: {
                'xstate.done.actor.activeVotingCartridge': {
                  target: 'groupChat',
                  actions: 'forwardVoteResultToL2'
                },
                'INTERNAL.CLOSE_VOTING': { actions: 'forwardToVotingChild' },
                '*': {
                  guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith('VOTE.'),
                  actions: 'forwardToVotingChild',
                }
              }
            }
          }
        },
        // REGION C: ACTIVITY LAYER (Popups)
        activityLayer: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                'INTERNAL.START_ACTIVITY': {
                  target: 'playing',
                }
              }
            },
            playing: {
              entry: 'spawnPromptCartridge',
              on: {
                'xstate.done.actor.activePromptCartridge': {
                  target: 'completed',
                  actions: ['applyPromptRewardsLocally', 'forwardPromptResultToL2']
                },
                'INTERNAL.END_ACTIVITY': { actions: 'forwardToPromptChild' },
                '*': {
                  guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith('ACTIVITY.'),
                  actions: 'forwardToPromptChild',
                }
              }
            },
            completed: {
              // Cartridge stays alive so results remain visible in SYSTEM.SYNC.
              // Only END_ACTIVITY cleans up and returns to idle.
              on: {
                'INTERNAL.END_ACTIVITY': {
                  target: 'idle',
                  actions: 'cleanupPromptCartridge',
                }
              }
            }
          }
        }
      },
      on: {
        'INTERNAL.END_DAY': { target: 'finishing' },
        'FACT.RECORD': { actions: 'forwardToL2' }
      }
    },
    finishing: {
      type: 'final',
      output: () => ({ reason: "Manual Trigger" })
    }
  }
} as any);
