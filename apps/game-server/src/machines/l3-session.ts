import { setup, assign, sendParent, sendTo } from 'xstate';
import { ChatMessage, SocialPlayer, SocialEvent, AdminEvent, DailyManifest, Fact } from '@pecking-order/shared-types';
import { votingMachine } from './cartridges/voting-machine';

// 1. Define strict types
export interface DailyContext {
  dayIndex: number;
  chatLog: ChatMessage[];
  roster: Record<string, SocialPlayer>;
  manifest: DailyManifest | undefined;
}

export type DailyEvent =
  | (SocialEvent & { senderId: string }) // Inject senderId in server.ts
  | { type: 'INTERNAL.END_DAY' }
  | { type: 'INTERNAL.START_CARTRIDGE'; payload: any }
  | { type: 'INTERNAL.OPEN_VOTING'; payload: any }
  | { type: 'INTERNAL.INJECT_PROMPT'; payload: any }
  | { type: 'GAME.VOTE'; senderId: string; targetId: string }
  | { type: 'FACT.RECORD'; fact: Fact }
  | AdminEvent;

export const dailySessionMachine = setup({
  types: {
    input: {} as { dayIndex: number; roster: Record<string, SocialPlayer>; manifest?: DailyManifest }, 
    context: {} as DailyContext,
    events: {} as DailyEvent,
    output: {} as { reason: string }
  },
  actions: {
    processMessage: assign({
      chatLog: ({ context, event }) => {
        if (event.type !== 'SOCIAL.SEND_MSG') return context.chatLog;
        
        const sender = context.roster[event.senderId];
        if (!sender) return context.chatLog;

        const isDM = !!event.targetId;
        
        // Create message object
        const newMessage: ChatMessage = {
          id: crypto.randomUUID(),
          senderId: event.senderId,
          timestamp: Date.now(),
          content: event.content,
          channel: isDM ? 'DM' : 'MAIN',
          targetId: event.targetId
        };

        // Emit Fact for Journaling [ADR-005]
        sendParent({ 
          type: 'FACT.RECORD', 
          fact: {
            type: isDM ? 'DM_SENT' : 'CHAT_MSG',
            actorId: event.senderId,
            targetId: event.targetId,
            payload: { content: event.content, messageId: newMessage.id },
            timestamp: newMessage.timestamp
          }
        });

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
    transferSilver: assign({
      roster: ({ context, event }) => {
        if (event.type !== 'SOCIAL.SEND_SILVER') return context.roster;
        
        const sender = context.roster[event.senderId];
        const target = context.roster[event.targetId];
        
        if (!sender || !target || sender.silver < event.amount) return context.roster;

        // Emitting Fact to Parent (L2) for journaling
        sendParent({ 
          type: 'FACT.RECORD', 
          fact: {
            type: 'SILVER_TRANSFER',
            actorId: event.senderId,
            targetId: event.targetId,
            payload: { amount: event.amount },
            timestamp: Date.now()
          }
        });

        return {
          ...context.roster,
          [event.senderId]: { ...sender, silver: sender.silver - event.amount },
          [event.targetId]: { ...target, silver: target.silver + event.amount }
        };
      }
    }),
    forwardToL2: sendParent(({ event }) => event),
    forwardToChild: sendTo('activeCartridge', ({ event }) => event)
  },
  actors: {
    votingMachine
  }
}).createMachine({
  id: 'l3-daily-session',
  context: ({ input }) => ({
    dayIndex: input.dayIndex || 0,
    chatLog: [],
    roster: input.roster || {},
    manifest: input.manifest
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
                'SOCIAL.SEND_MSG': { actions: 'processMessage' },
                'SOCIAL.SEND_SILVER': { actions: 'transferSilver' }
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
              invoke: {
                id: 'activeCartridge',
                src: 'votingMachine',
                input: ({ context }) => ({ voteType: context.manifest?.voteType || "EXECUTIONER" }),
                onDone: { target: 'groupChat' }
              },
              on: {
                'GAME.VOTE': { actions: 'forwardToChild' }
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