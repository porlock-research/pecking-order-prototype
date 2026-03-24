import { setup, assign, sendParent, enqueueActions } from 'xstate';
import { ChatMessage, SocialPlayer, SocialEvent, AdminEvent, DailyManifest, Fact, VoteType, GameType, PromptType, Channel, Events, FactTypes, GAME_MASTER_ID, DM_MAX_CHARS_PER_DAY, DM_MAX_PARTNERS_PER_DAY } from '@pecking-order/shared-types';
import { VOTE_REGISTRY } from './cartridges/voting/_registry';
import { GAME_REGISTRY } from '@pecking-order/game-cartridges';
import { PROMPT_REGISTRY } from './cartridges/prompts/_registry';
import { DILEMMA_REGISTRY } from './cartridges/dilemmas/_registry';
import type { AnyActorRef } from 'xstate';

import { l3SocialActions, l3SocialGuards } from './actions/l3-social';
import { l3VotingActions } from './actions/l3-voting';
import { l3GameActions } from './actions/l3-games';
import { l3ActivityActions } from './actions/l3-activity';
import { l3DilemmaActions } from './actions/l3-dilemma';
import { l3PerkActions, l3PerkGuards } from './actions/l3-perks';
import { buildChatMessage, appendToChatLog, resolveExistingChannel } from './actions/social-helpers';

// 1. Define strict types
export interface DailyContext {
  dayIndex: number;
  chatLog: ChatMessage[];
  roster: Record<string, SocialPlayer>;
  manifest: DailyManifest | undefined;
  activeVotingCartridgeRef: AnyActorRef | null;
  activeGameCartridgeRef: AnyActorRef | null;
  activePromptCartridgeRef: AnyActorRef | null;
  activeDilemmaCartridgeRef: AnyActorRef | null;
  dmsOpen: boolean;
  dmPartnersByPlayer: Record<string, string[]>;
  dmCharsByPlayer: Record<string, number>;
  dmCharsLimit: number;
  dmPartnersLimit: number;
  perkOverrides: Record<string, { extraPartners: number; extraChars: number }>;
  channels: Record<string, Channel>;
  groupChatOpen: boolean;
  dmGroupsByPlayer: Record<string, string[]>;
  slotsUsedByPlayer: Record<string, number>;
  dmSlotsPerPlayer: number;
  requireDmInvite: boolean;
}

export type DailyEvent =
  | (SocialEvent & { senderId: string })
  | { type: 'SOCIAL.SEND_MSG'; senderId: string; content: string; channelId?: string; recipientIds?: string[]; targetId?: string }
  | { type: 'SOCIAL.ADD_MEMBER'; senderId: string; channelId: string; memberIds: string[]; message?: string }
  | { type: 'INTERNAL.END_DAY' }
  | { type: 'INTERNAL.START_CARTRIDGE'; payload: any }
  | { type: 'INTERNAL.OPEN_VOTING'; payload: any }
  | { type: 'INTERNAL.CLOSE_VOTING' }
  | { type: 'INTERNAL.OPEN_DMS' }
  | { type: 'INTERNAL.CLOSE_DMS' }
  | { type: 'INTERNAL.OPEN_GROUP_CHAT' }
  | { type: 'INTERNAL.CLOSE_GROUP_CHAT' }
  | { type: 'GAME.CHANNEL.CREATE'; channelId: string; memberIds: string[]; gameType: string; label?: string; capabilities?: string[] }
  | { type: 'GAME.CHANNEL.DESTROY' }
  | { type: 'INTERNAL.INJECT_PROMPT'; payload: any }
  | { type: 'INTERNAL.START_GAME'; payload?: any }
  | { type: 'INTERNAL.END_GAME' }
  | { type: 'INTERNAL.START_ACTIVITY'; payload: any }
  | { type: 'INTERNAL.END_ACTIVITY' }
  | { type: 'INTERNAL.START_DILEMMA' }
  | { type: 'INTERNAL.END_DILEMMA' }
  | { type: `VOTE.${string}`; senderId: string; targetId?: string; [key: string]: any }
  | { type: `GAME.${string}`; senderId: string; [key: string]: any }
  | { type: `ACTIVITY.${string}`; senderId: string; [key: string]: any }
  | { type: 'SOCIAL.ACCEPT_DM'; senderId: string; channelId: string }
  | { type: 'SOCIAL.DECLINE_DM'; senderId: string; channelId: string }
  | { type: 'FACT.RECORD'; fact: Fact }
  | AdminEvent;

/** Extracted so tests can verify context initialization without XState entry actions. */
export function buildL3Context(input: { dayIndex: number; roster: Record<string, SocialPlayer>; manifest?: DailyManifest; initialChatLog?: ChatMessage[] }): DailyContext {
  return {
    dayIndex: input.dayIndex || 0,
    chatLog: input.initialChatLog || [],
    roster: input.roster || {},
    manifest: input.manifest,
    activeVotingCartridgeRef: null,
    activeGameCartridgeRef: null,
    activePromptCartridgeRef: null,
    activeDilemmaCartridgeRef: null,
    dmsOpen: false,
    dmPartnersByPlayer: {},
    dmCharsByPlayer: {},
    dmCharsLimit: input.manifest?.dmCharsPerPlayer ?? DM_MAX_CHARS_PER_DAY,
    dmPartnersLimit: input.manifest?.dmPartnersPerPlayer ?? DM_MAX_PARTNERS_PER_DAY,
    perkOverrides: {},
    channels: {
      'MAIN': {
        id: 'MAIN', type: 'MAIN' as const,
        memberIds: Object.keys(input.roster || {}),
        createdBy: 'SYSTEM', createdAt: Date.now(),
        capabilities: ['CHAT', 'REACTIONS'] as const,
      },
    },
    groupChatOpen: false,
    dmGroupsByPlayer: {},
    slotsUsedByPlayer: {},
    requireDmInvite: input.manifest?.requireDmInvite ?? false,
    dmSlotsPerPlayer: input.manifest?.dmSlotsPerPlayer ?? 5,
  };
}

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
    ...l3DilemmaActions,
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
    ...DILEMMA_REGISTRY,
  }
// XState v5 setup() can't infer action string names from externally-defined
// action objects, so we cast the machine config. Runtime behavior is correct.
}).createMachine({
  id: 'l3-daily-session',
  context: ({ input }: any) => buildL3Context(input),
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
                    guard: 'isChannelMessageAllowed',
                    actions: ['processChannelMessage', 'emitChatFact'],
                  },
                  {
                    guard: ({ context, event }: any) => {
                      const chId = resolveExistingChannel(context.channels, event);
                      return chId !== 'MAIN';
                    },
                    actions: ['rejectChannelMessage'],
                  },
                  {
                    actions: ['rejectChannelMessage'],  // MAIN closed fallback
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
                'SOCIAL.CREATE_CHANNEL': [
                  { guard: 'isGroupDmCreationAllowed', actions: ['createGroupDmChannel'] },
                  { actions: ['rejectGroupDmCreation'] }
                ],
                'SOCIAL.ADD_MEMBER': [
                  { guard: 'canAddMember', actions: ['addMemberToChannel', 'recordAddMemberFact'] },
                  { actions: ['rejectAddMember'] }
                ],
                'SOCIAL.ACCEPT_DM': [
                  { guard: 'canAcceptDm', actions: ['acceptDmInvite', 'recordInviteAcceptedFact'] },
                  { actions: ['rejectDmAccept'] }
                ],
                'SOCIAL.DECLINE_DM': [
                  { guard: 'canDeclineDm', actions: ['declineDmInvite', 'recordInviteDeclinedFact'] },
                ],
                'INTERNAL.OPEN_DMS': { actions: [assign({ dmsOpen: true }), sendParent({ type: 'PUSH.PHASE', trigger: 'OPEN_DMS' } as any)] },
                'INTERNAL.CLOSE_DMS': { actions: [assign({ dmsOpen: false }), sendParent({ type: 'PUSH.PHASE', trigger: 'CLOSE_DMS' } as any)] },
                'INTERNAL.OPEN_GROUP_CHAT': { actions: [assign({ groupChatOpen: true }), sendParent({ type: 'PUSH.PHASE', trigger: 'OPEN_GROUP_CHAT' } as any)] },
                'INTERNAL.CLOSE_GROUP_CHAT': { actions: [assign({ groupChatOpen: false }), sendParent({ type: 'PUSH.PHASE', trigger: 'CLOSE_GROUP_CHAT' } as any)] },
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
              }
            },
            dailyGame: {
              entry: ['spawnGameCartridge', sendParent({ type: 'PUSH.PHASE', trigger: 'DAILY_GAME' } as any)],
              exit: 'cleanupGameCartridge',
              on: {
                'xstate.done.actor.activeGameCartridge': {
                  target: 'groupChat',
                  actions: ['applyGameRewardsLocally', 'forwardGameResultToL2']
                },
                'CARTRIDGE.PLAYER_GAME_RESULT': {
                  actions: ['applyPlayerGameRewardLocally', 'forwardPlayerGameResultToL2']
                },
                'GAME.CHANNEL.CREATE': { actions: 'createGameChannel' },
                'GAME.CHANNEL.DESTROY': { actions: 'destroyGameChannels' },
                'INTERNAL.END_GAME': { actions: ['forwardToGameChild', sendParent({ type: 'PUSH.PHASE', trigger: 'END_GAME' } as any)] },
                '*': {
                  guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Game.PREFIX) && !event.type.startsWith(Events.Game.CHANNEL_PREFIX),
                  actions: 'forwardToGameChild',
                }
              }
            },
            voting: {
              entry: ['spawnVotingCartridge', sendParent({ type: 'PUSH.PHASE', trigger: 'VOTING' } as any)],
              exit: 'cleanupVotingCartridge',
              on: {
                'xstate.done.actor.activeVotingCartridge': {
                  target: 'groupChat',
                  actions: 'forwardVoteResultToL2'
                },
                'INTERNAL.CLOSE_VOTING': { actions: 'forwardToVotingChild' },
                '*': {
                  guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Vote.PREFIX),
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
              entry: ['spawnPromptCartridge', sendParent({ type: 'PUSH.PHASE', trigger: 'ACTIVITY' } as any)],
              on: {
                // Natural completion: all players responded → child reaches final state
                'xstate.done.actor.activePromptCartridge': {
                  target: 'completed',
                  actions: ['applyPromptRewardsLocally', 'forwardPromptResultToL2']
                },
                // Forced termination: forward to child so it can calculateResults,
                // then transition to completed. The child's done event will be
                // handled by completed's xstate.done.actor handler.
                'INTERNAL.END_ACTIVITY': {
                  target: 'completed',
                  actions: ['forwardToPromptChild', sendParent({ type: 'PUSH.PHASE', trigger: 'END_ACTIVITY' } as any)],
                },
                '*': {
                  guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Activity.PREFIX),
                  actions: 'forwardToPromptChild',
                }
              }
            },
            completed: {
              on: {
                // Natural path: child completed during playing, END_ACTIVITY cleans up
                'INTERNAL.END_ACTIVITY': {
                  target: 'idle',
                  actions: 'cleanupPromptCartridge',
                },
                // Forced path: child finishes after END_ACTIVITY pushed us here
                'xstate.done.actor.activePromptCartridge': {
                  target: 'idle',
                  actions: ['applyPromptRewardsLocally', 'forwardPromptResultToL2', 'cleanupPromptCartridge'],
                }
              }
            }
          }
        },
        // REGION D: DILEMMA LAYER
        dilemmaLayer: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                'INTERNAL.START_DILEMMA': { target: 'dilemmaActive' }
              }
            },
            dilemmaActive: {
              entry: ['spawnDilemmaCartridge', 'injectDilemmaGmMessage', sendParent({ type: 'PUSH.PHASE', trigger: 'DILEMMA' } as any)],
              on: {
                'xstate.done.actor.activeDilemmaCartridge': {
                  target: 'completed',
                  actions: ['applyDilemmaRewardsLocally', 'forwardDilemmaResultToL2']
                },
                'INTERNAL.END_DILEMMA': {
                  target: 'completed',
                  actions: ['forwardToDilemmaChild', sendParent({ type: 'PUSH.PHASE', trigger: 'END_DILEMMA' } as any)]
                },
                '*': {
                  guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Dilemma.PREFIX),
                  actions: 'forwardToDilemmaChild',
                }
              }
            },
            completed: {
              on: {
                'INTERNAL.END_DILEMMA': { target: 'idle', actions: 'cleanupDilemmaCartridge' },
                'xstate.done.actor.activeDilemmaCartridge': {
                  target: 'idle',
                  actions: ['applyDilemmaRewardsLocally', 'forwardDilemmaResultToL2', 'cleanupDilemmaCartridge'],
                }
              }
            }
          }
        }
      },
      on: {
        'INTERNAL.END_DAY': { target: 'finishing' },
        'FACT.RECORD': { actions: 'forwardToL2' },
        'INTERNAL.INJECT_PROMPT': {
          actions: enqueueActions(({ context, event, enqueue }: any) => {
            const text = event.payload?.text || event.payload?.msg || 'The Game Master speaks...';
            const targetId = event.payload?.targetId;

            // For targeted GM messages, find existing GM↔player channel or create one
            let channelId = 'MAIN';
            if (targetId) {
              // Look for existing GM↔player DM channel
              const existing = Object.values(context.channels).find(
                (ch: any) => ch.type === 'DM' && ch.memberIds.includes(GAME_MASTER_ID) && ch.memberIds.includes(targetId)
              ) as Channel | undefined;
              channelId = existing?.id ?? crypto.randomUUID();
            }

            const msg = buildChatMessage(GAME_MASTER_ID, text, channelId);

            // Lazy-create DM channel for GM→player messages so SYNC includes them
            if (targetId && !context.channels[channelId]) {
              const newChannel: Channel = {
                id: channelId,
                type: 'DM',
                memberIds: [GAME_MASTER_ID, targetId],
                createdBy: GAME_MASTER_ID,
                createdAt: Date.now(),
                capabilities: ['CHAT'],
              };
              enqueue.assign({ channels: { ...context.channels, [channelId]: newChannel } });
            }

            enqueue.assign({ chatLog: appendToChatLog(context.chatLog, msg) });
            // Emit DM_SENT fact for targeted messages so push notifications fire
            if (targetId) {
              enqueue.raise({
                type: Events.Fact.RECORD,
                fact: {
                  type: FactTypes.DM_SENT,
                  actorId: GAME_MASTER_ID,
                  targetId,
                  payload: { content: text, channelId },
                  timestamp: Date.now(),
                },
              });
            }
          })
        }
      }
    },
    finishing: {
      type: 'final',
      output: () => ({ reason: "Manual Trigger" })
    }
  }
} as any);
