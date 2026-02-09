import { setup, assign, sendParent } from 'xstate';

export interface VoteContext {
  voteType: string;
  votes: Record<string, string>; // voterId -> targetId
  results: Record<string, number>; // targetId -> voteCount
}

export type VoteEvent = 
  | { type: 'GAME.VOTE'; senderId: string; targetId: string }
  | { type: 'INTERNAL.CLOSE_VOTING' };

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
        return {
          ...context.votes,
          [event.senderId]: event.targetId
        };
      }
    }),
    emitVoteCastFact: sendParent(({ event }) => {
      if (event.type !== 'GAME.VOTE') return { type: 'FACT.RECORD', fact: { type: 'VOTE_CAST', actorId: '', timestamp: 0 } };
      return {
        type: 'FACT.RECORD',
        fact: {
          type: 'VOTE_CAST',
          actorId: event.senderId,
          targetId: event.targetId,
          payload: {},
          timestamp: Date.now()
        }
      };
    }),
    calculateResults: assign({
      results: ({ context }) => {
        const results = Object.values(context.votes).reduce((acc, target) => {
          acc[target] = (acc[target] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        console.log(`[VotingCartridge] Results (${context.voteType}):`, results);
        return results;
      }
    }),
    reportResults: sendParent(({ context }) => ({
      type: 'FACT.RECORD',
      fact: {
        type: 'GAME_RESULT',
        actorId: 'SYSTEM',
        payload: { results: context.results },
        timestamp: Date.now()
      }
    }))
  }
}).createMachine({
  id: 'voting-cartridge',
  context: ({ input }) => ({
    voteType: input.voteType,
    votes: {},
    results: {}
  }),
  initial: 'active',
  states: {
    active: {
      on: {
        'GAME.VOTE': { actions: ['recordVote', 'emitVoteCastFact'] },
        'INTERNAL.CLOSE_VOTING': { target: 'completed' }
      }
    },
    completed: {
      entry: ['calculateResults', 'reportResults'],
      type: 'final'
    }
  }
});
