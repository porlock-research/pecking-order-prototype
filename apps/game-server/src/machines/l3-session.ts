import { setup, assign, sendParent, sendTo, type AnyActorRef } from 'xstate';
import { ChatMessage, SocialPlayer, SocialEvent, AdminEvent, DailyManifest, Fact, VoteResult, VoteType } from '@pecking-order/shared-types';
import { VOTE_REGISTRY } from './cartridges/voting/_registry';

// 1. Define strict types
export interface DailyContext {
  dayIndex: number;
  chatLog: ChatMessage[];
  roster: Record<string, SocialPlayer>;
  manifest: DailyManifest | undefined;
  activeCartridgeRef: AnyActorRef | null;
}

export type DailyEvent =
  | (SocialEvent & { senderId: string }) // Inject senderId in server.ts
  | { type: 'INTERNAL.END_DAY' }
  | { type: 'INTERNAL.START_CARTRIDGE'; payload: any }
  | { type: 'INTERNAL.OPEN_VOTING'; payload: any }
  | { type: 'INTERNAL.CLOSE_VOTING' }
  | { type: 'INTERNAL.INJECT_PROMPT'; payload: any }
  | { type: 'GAME.VOTE'; senderId: string; targetId: string; slot?: string }
  | { type: 'GAME.EXECUTIONER_PICK'; senderId: string; targetId: string }
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
    })
  },
  actors: {
    ...VOTE_REGISTRY
  }
}).createMachine({
  id: 'l3-daily-session',
  context: ({ input }) => ({
    dayIndex: input.dayIndex || 0,
    chatLog: input.initialChatLog || [],
    roster: input.roster || {},
    manifest: input.manifest,
    activeCartridgeRef: null
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
                'SOCIAL.SEND_MSG': { actions: ['processMessage', 'emitChatFact'] },
                'SOCIAL.SEND_SILVER': { actions: ['transferSilver', 'emitSilverFact'] }
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
                'INTERNAL.OPEN_VOTING': 'voting',
                'INTERNAL.INJECT_PROMPT': { actions: ({ event }) => console.log('Prompt:', event.payload) }
              }
            },
            dailyGame: {
              // Stub for Trivia/Minigames
              on: {
                 'INTERNAL.END_DAY': 'groupChat' // Placeholder exit
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
                'GAME.VOTE': { actions: 'forwardToChild' },
                'GAME.EXECUTIONER_PICK': { actions: 'forwardToChild' },
                'INTERNAL.CLOSE_VOTING': { actions: 'forwardToChild' }
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
