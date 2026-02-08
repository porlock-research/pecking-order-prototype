import { setup, assign, sendParent } from 'xstate';

export interface VoteContext {
  voteType: string;
  votes: Record<string, string>; // voterId -> targetId
}

export type VoteEvent = 
  | { type: 'GAME.VOTE'; senderId: string; targetId: string }
  | { type: 'INTERNAL.TIME_UP' };

export const votingMachine = setup({
  types: {
    context: {} as VoteContext,
    events: {} as VoteEvent,
    input: {} as { voteType: string }
  },
  actions: {
    recordVote: assign({
      votes: ({ context, event }) => {
        if (event.type !== 'GAME.VOTE') return context.votes;
        // In a real implementation, we'd check validity (isAlive, etc)
        return {
          ...context.votes,
          [event.senderId]: event.targetId
        };
      }
    }),
    calculateAndReport: ({ context }) => {
      // Stub calculation logic
      const results = Object.values(context.votes).reduce((acc, target) => {
        acc[target] = (acc[target] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`[VotingCartridge] Results (${context.voteType}):`, results);
      
      // Send result back to parent (L3) which will send to L2
      // We use a generic FACT.RECORD structure
      sendParent({ 
        type: 'FACT.RECORD', 
        fact: {
          type: 'GAME_RESULT',
          actorId: 'SYSTEM',
          payload: { results },
          timestamp: Date.now()
        }
      });
    }
  }
}).createMachine({
  id: 'voting-cartridge',
  context: ({ input }) => ({
    voteType: input.voteType,
    votes: {}
  }),
  initial: 'active',
  states: {
    active: {
      on: {
        'GAME.VOTE': { actions: 'recordVote' },
        'INTERNAL.TIME_UP': { target: 'completed' }
      }
    },
    completed: {
      entry: 'calculateAndReport',
      type: 'final'
    }
  }
});
