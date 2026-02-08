import { setup, assign } from 'xstate';

// 1. Define strict types
export interface DailyContext {
  dayIndex: number;
  chatLog: Array<{ sender: string; message: string }>;
  silver: Record<string, number>;
}

export type DailyEvent =
  | { type: 'SOCIAL.DM'; sender: string; message: string }
  | { type: 'INTERNAL.END_DAY' };

export const dailySessionMachine = setup({
  types: {
    // CRITICAL: We must explicitly define 'input' for it to be accepted from L2
    input: {} as { dayIndex: number }, 
    context: {} as DailyContext,
    events: {} as DailyEvent,
    output: {} as { reason: string }
  },
  actions: {
    logMessage: assign({
      chatLog: ({ context, event }) => {
        if (event.type !== 'SOCIAL.DM') return context.chatLog;
        return [...context.chatLog, { sender: event.sender, message: event.message }];
      }
    })
  }
}).createMachine({
  id: 'l3-daily-session',
  // 2. Hydrate Context from Input
  context: ({ input }) => ({
    dayIndex: input.dayIndex || 0,
    chatLog: [],
    silver: {}
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
              on: { 'SOCIAL.DM': { actions: 'logMessage' } }
            }
          }
        },
        mainStage: {
          initial: 'idle',
          states: {
            idle: {
              // 3. Shorten timer to 5s for faster debugging
              after: {
                5000: { actions: ({ self }) => self.send({ type: 'INTERNAL.END_DAY' }) }
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
      // 4. Return Output as a Function (Safer)
      output: () => ({ reason: "Time Limit Reached" })
    }
  }
});