import { setup, assign } from 'xstate';
import { ChatMessage, SocialPlayer, SocialEvent } from '@pecking-order/shared-types';

// 1. Define strict types
export interface DailyContext {
  dayIndex: number;
  chatLog: ChatMessage[];
  roster: Record<string, SocialPlayer>;
}

export type DailyEvent =
  | (SocialEvent & { senderId: string }) // Inject senderId in server.ts
  | { type: 'INTERNAL.END_DAY' };

export const dailySessionMachine = setup({
  types: {
    input: {} as { dayIndex: number; roster: Record<string, SocialPlayer> }, 
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

        return [...context.chatLog, newMessage];
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

        console.log(`[L3] FACT.RECORD: ${sender.personaName} sent ${event.amount} silver to ${target.personaName}`);

        return {
          ...context.roster,
          [event.senderId]: { ...sender, silver: sender.silver - event.amount },
          [event.targetId]: { ...target, silver: target.silver + event.amount }
        };
      }
    })
  }
}).createMachine({
  id: 'l3-daily-session',
  context: ({ input }) => ({
    dayIndex: input.dayIndex || 0,
    chatLog: [],
    roster: input.roster || {}
  }),
  initial: 'running',
  states: {
    running: {
      type: 'parallel',
      states: {
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
        mainStage: {
          initial: 'idle',
          states: {
            idle: {
              after: {
                20000: { actions: ({ self }) => self.send({ type: 'INTERNAL.END_DAY' }) }
              }
            }
          }
        }
      },
      on: {
        'INTERNAL.END_DAY': { target: 'finishing' }
      }
    },
    finishing: {
      type: 'final',
      output: () => ({ reason: "Time Limit Reached" })
    }
  }
});
