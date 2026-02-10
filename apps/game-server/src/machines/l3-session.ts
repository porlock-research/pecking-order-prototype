import { setup, assign, sendParent, sendTo, type AnyActorRef, enqueueActions } from 'xstate';
import { ChatMessage, SocialPlayer, SocialEvent, AdminEvent, DailyManifest, Fact, VoteResult, VoteType, GameType, DmRejectionReason, DM_MAX_PARTNERS_PER_DAY, DM_MAX_CHARS_PER_DAY } from '@pecking-order/shared-types';
import { VOTE_REGISTRY } from './cartridges/voting/_registry';
import { GAME_REGISTRY } from './cartridges/games/_registry';
import type { GameOutput } from './cartridges/games/_contract';

// 1. Define strict types
export interface DailyContext {
  dayIndex: number;
  chatLog: ChatMessage[];
  roster: Record<string, SocialPlayer>;
  manifest: DailyManifest | undefined;
  activeCartridgeRef: AnyActorRef | null;
  activeGameCartridgeRef: AnyActorRef | null;
  dmsOpen: boolean;
  dmPartnersByPlayer: Record<string, string[]>;
  dmCharsByPlayer: Record<string, number>;
}

export type DailyEvent =
  | (SocialEvent & { senderId: string }) // Inject senderId in server.ts
  | { type: 'INTERNAL.END_DAY' }
  | { type: 'INTERNAL.START_CARTRIDGE'; payload: any }
  | { type: 'INTERNAL.OPEN_VOTING'; payload: any }
  | { type: 'INTERNAL.CLOSE_VOTING' }
  | { type: 'INTERNAL.OPEN_DMS' }
  | { type: 'INTERNAL.CLOSE_DMS' }
  | { type: 'INTERNAL.INJECT_PROMPT'; payload: any }
  | { type: 'INTERNAL.START_GAME'; payload?: any }
  | { type: 'INTERNAL.END_GAME' }
  | { type: `VOTE.${string}`; senderId: string; targetId?: string; [key: string]: any }
  | { type: `GAME.${string}`; senderId: string; [key: string]: any }
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
    // Pure context update — adds message to chatLog, deducts silver for DMs
    processMessage: assign({
      chatLog: ({ context, event }) => {
        if (event.type !== 'SOCIAL.SEND_MSG') return context.chatLog;

        const sender = context.roster[event.senderId];
        if (!sender) return context.chatLog;

        const isDM = !!event.targetId;

        const newMessage: ChatMessage = {
          id: crypto.randomUUID(),
          senderId: event.senderId,
          timestamp: Date.now(),
          content: event.content,
          channel: isDM ? 'DM' : 'MAIN',
          targetId: event.targetId
        };

        // Keep only the last 50 messages [ADR-005]
        const updatedLog = [...context.chatLog, newMessage];
        if (updatedLog.length > 50) {
          return updatedLog.slice(-50);
        }
        return updatedLog;
      },
      roster: ({ context, event }) => {
        if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return context.roster;

        const sender = context.roster[event.senderId];
        if (!sender || sender.silver < 1) return context.roster;

        // Deduct 1 silver for DM
        return {
          ...context.roster,
          [event.senderId]: {
            ...sender,
            silver: sender.silver - 1
          }
        };
      }
    }),
    // Side-effect: emit FACT.RECORD to L2 for journaling + sync trigger [ADR-005]
    emitChatFact: sendParent(({ event }) => {
      if (event.type !== 'SOCIAL.SEND_MSG') return { type: 'FACT.RECORD', fact: { type: 'CHAT_MSG', actorId: '', timestamp: 0 } };
      const isDM = !!event.targetId;
      return {
        type: 'FACT.RECORD',
        fact: {
          type: isDM ? 'DM_SENT' : 'CHAT_MSG',
          actorId: event.senderId,
          targetId: event.targetId,
          payload: { content: event.content },
          timestamp: Date.now()
        }
      };
    }),
    // DM approved: add message to chatLog + deduct silver + update tracking
    processDm: assign({
      chatLog: ({ context, event }) => {
        if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return context.chatLog;
        const newMessage: ChatMessage = {
          id: crypto.randomUUID(),
          senderId: event.senderId,
          timestamp: Date.now(),
          content: event.content,
          channel: 'DM',
          targetId: event.targetId,
        };
        const updated = [...context.chatLog, newMessage];
        return updated.length > 50 ? updated.slice(-50) : updated;
      },
      roster: ({ context, event }) => {
        if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return context.roster;
        const sender = context.roster[event.senderId];
        if (!sender) return context.roster;
        return { ...context.roster, [event.senderId]: { ...sender, silver: sender.silver - 1 } };
      },
      dmPartnersByPlayer: ({ context, event }) => {
        if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return context.dmPartnersByPlayer;
        const partners = context.dmPartnersByPlayer[event.senderId] || [];
        if (partners.includes(event.targetId)) return context.dmPartnersByPlayer;
        return { ...context.dmPartnersByPlayer, [event.senderId]: [...partners, event.targetId] };
      },
      dmCharsByPlayer: ({ context, event }) => {
        if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return context.dmCharsByPlayer;
        const used = context.dmCharsByPlayer[event.senderId] || 0;
        return { ...context.dmCharsByPlayer, [event.senderId]: used + event.content.length };
      },
    }),
    // DM rejected: determine reason and notify parent (L2 → L1 → client)
    rejectDm: sendParent(({ context, event }): any => {
      if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return { type: 'NOOP' };
      const senderId = event.senderId;
      const targetId = event.targetId;
      const content = event.content;

      let reason: DmRejectionReason = 'DMS_CLOSED';
      if (!context.dmsOpen) {
        reason = 'DMS_CLOSED';
      } else if (senderId === targetId) {
        reason = 'SELF_DM';
      } else if (context.roster[targetId]?.status === 'ELIMINATED') {
        reason = 'TARGET_ELIMINATED';
      } else if ((context.roster[senderId]?.silver ?? 0) < 1) {
        reason = 'INSUFFICIENT_SILVER';
      } else {
        const partners = context.dmPartnersByPlayer[senderId] || [];
        if (!partners.includes(targetId) && partners.length >= DM_MAX_PARTNERS_PER_DAY) {
          reason = 'PARTNER_LIMIT';
        } else {
          const charsUsed = context.dmCharsByPlayer[senderId] || 0;
          if (charsUsed + content.length > DM_MAX_CHARS_PER_DAY) {
            reason = 'CHAR_LIMIT';
          }
        }
      }

      return { type: 'DM.REJECTED', reason, senderId };
    }),
    // Pure context update — transfers silver between players
    transferSilver: assign({
      roster: ({ context, event }) => {
        if (event.type !== 'SOCIAL.SEND_SILVER') return context.roster;

        const sender = context.roster[event.senderId];
        const target = context.roster[event.targetId];

        if (!sender || !target || sender.silver < event.amount) return context.roster;

        return {
          ...context.roster,
          [event.senderId]: { ...sender, silver: sender.silver - event.amount },
          [event.targetId]: { ...target, silver: target.silver + event.amount }
        };
      }
    }),
    // Side-effect: emit FACT.RECORD for silver transfer [ADR-005]
    emitSilverFact: sendParent(({ event }) => {
      if (event.type !== 'SOCIAL.SEND_SILVER') return { type: 'FACT.RECORD', fact: { type: 'SILVER_TRANSFER', actorId: '', timestamp: 0 } };
      return {
        type: 'FACT.RECORD',
        fact: {
          type: 'SILVER_TRANSFER',
          actorId: event.senderId,
          targetId: event.targetId,
          payload: { amount: event.amount },
          timestamp: Date.now()
        }
      };
    }),
    forwardToL2: sendParent(({ event }) => event),
    forwardToChild: sendTo('activeCartridge', ({ event }) => event),
    // Spawn the correct voting machine from the registry based on manifest voteType.
    // XState v5 setup() restricts spawn to registered actor keys. We register all
    // machines in actors{} and use the voteType string as the key. Type assertion
    // needed because the key is dynamic.
    spawnVotingCartridge: assign({
      activeCartridgeRef: ({ context, spawn }) => {
        const voteType = context.manifest?.voteType || 'MAJORITY';
        const hasKey = voteType in VOTE_REGISTRY;
        const key = hasKey ? voteType : 'MAJORITY';
        if (!hasKey) console.error(`[L3] Unknown voteType: ${voteType}, falling back to MAJORITY`);
        console.log(`[L3] Spawning voting cartridge: ${key}`);
        return (spawn as any)(key, {
          id: 'activeCartridge',
          input: { voteType: key, roster: context.roster, dayIndex: context.dayIndex }
        });
      }
    }),
    forwardVoteResultToL2: sendParent(({ event }) => ({
      type: 'CARTRIDGE.VOTE_RESULT',
      result: (event as any).output as VoteResult
    })),
    cleanupCartridge: assign({
      activeCartridgeRef: () => null
    }),
    // --- Game Cartridge Actions ---
    spawnGameCartridge: assign({
      activeGameCartridgeRef: ({ context, spawn }) => {
        const gameType = context.manifest?.gameType || 'NONE';
        if (gameType === 'NONE') {
          console.log('[L3] No game type for this day, skipping game cartridge');
          return null;
        }
        const hasKey = gameType in GAME_REGISTRY;
        const key = hasKey ? gameType : 'REALTIME_TRIVIA';
        if (!hasKey) console.error(`[L3] Unknown gameType: ${gameType}, falling back to REALTIME_TRIVIA`);
        console.log(`[L3] Spawning game cartridge: ${key}`);
        return (spawn as any)(key, {
          id: 'activeGameCartridge',
          input: { gameType: key, roster: context.roster, dayIndex: context.dayIndex }
        });
      }
    }),
    cleanupGameCartridge: assign({
      activeGameCartridgeRef: () => null
    }),
    forwardGameResultToL2: sendParent(({ event }) => ({
      type: 'CARTRIDGE.GAME_RESULT',
      result: (event as any).output as GameOutput
    })),
    forwardToGameChild: sendTo('activeGameCartridge', ({ event }) => event)
  },
  guards: {
    isDmAllowed: ({ context, event }) => {
      if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return false;
      const { senderId, targetId, content } = event;
      if (!context.dmsOpen) return false;
      if (senderId === targetId) return false;
      if (context.roster[targetId]?.status === 'ELIMINATED') return false;
      if ((context.roster[senderId]?.silver ?? 0) < 1) return false;
      const partners = context.dmPartnersByPlayer[senderId] || [];
      if (!partners.includes(targetId) && partners.length >= DM_MAX_PARTNERS_PER_DAY) return false;
      const charsUsed = context.dmCharsByPlayer[senderId] || 0;
      if (charsUsed + content.length > DM_MAX_CHARS_PER_DAY) return false;
      return true;
    },
  },
  actors: {
    ...VOTE_REGISTRY,
    ...GAME_REGISTRY
  }
}).createMachine({
  id: 'l3-daily-session',
  context: ({ input }) => ({
    dayIndex: input.dayIndex || 0,
    chatLog: input.initialChatLog || [],
    roster: input.roster || {},
    manifest: input.manifest,
    activeCartridgeRef: null,
    activeGameCartridgeRef: null,
    dmsOpen: false,
    dmPartnersByPlayer: {},
    dmCharsByPlayer: {},
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
                    // DM path: allowed
                    guard: 'isDmAllowed',
                    actions: ['processDm', 'emitChatFact'],
                  },
                  {
                    // DM path: rejected (has targetId but guard failed)
                    guard: ({ event }) => !!(event as any).targetId,
                    actions: ['rejectDm'],
                  },
                  {
                    // Broadcast path: no targetId
                    actions: ['processMessage', 'emitChatFact'],
                  }
                ],
                'SOCIAL.SEND_SILVER': { actions: ['transferSilver', 'emitSilverFact'] },
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
                'INTERNAL.INJECT_PROMPT': { actions: ({ event }) => console.log('Prompt:', event.payload) }
              }
            },
            dailyGame: {
              entry: 'spawnGameCartridge',
              exit: 'cleanupGameCartridge',
              on: {
                'xstate.done.actor.activeGameCartridge': {
                  target: 'groupChat',
                  actions: 'forwardGameResultToL2'
                },
                'INTERNAL.END_GAME': { actions: 'forwardToGameChild' },
                '*': {
                  guard: ({ event }) => typeof event.type === 'string' && event.type.startsWith('GAME.'),
                  actions: 'forwardToGameChild',
                }
              }
            },
            voting: {
              // Spawn the correct voting machine dynamically on entry.
              // XState v5 invoke.src does NOT support dynamic string key resolution
              // via functions — it treats the function as actor logic. spawn() is the
              // correct pattern for polymorphic actor dispatch.
              entry: 'spawnVotingCartridge',
              exit: 'cleanupCartridge',
              on: {
                // Spawned actor emits this when it reaches its final state
                'xstate.done.actor.activeCartridge': {
                  target: 'groupChat',
                  actions: 'forwardVoteResultToL2'
                },
                'INTERNAL.CLOSE_VOTING': { actions: 'forwardToChild' },
                '*': {
                  guard: ({ event }) => typeof event.type === 'string' && event.type.startsWith('VOTE.'),
                  actions: 'forwardToChild',
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
                // Future: INTERNAL.START_ACTIVITY
              }
            },
            active: {
              on: {
                // ACTIVITY.SUBMIT
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
});
