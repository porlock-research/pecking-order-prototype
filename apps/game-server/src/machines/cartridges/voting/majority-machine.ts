import { setup, assign, sendParent } from 'xstate';
import type { VoteResult, VotingCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { BaseVoteContext, VoteEvent } from './_contract';

interface MajorityContext extends BaseVoteContext {
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

function getAlivePlayerIds(roster: Record<string, SocialPlayer>): string[] {
  return Object.entries(roster)
    .filter(([, p]) => p.status === 'ALIVE')
    .map(([id]) => id);
}

export const majorityMachine = setup({
  types: {
    context: {} as MajorityContext,
    events: {} as VoteEvent,
    input: {} as VotingCartridgeInput,
    output: {} as VoteResult,
  },
  actions: {
    recordVote: assign({
      votes: ({ context, event }) => {
        if (event.type !== 'GAME.VOTE') return context.votes;
        if (!context.eligibleVoters.includes(event.senderId)) return context.votes;
        if (!context.eligibleTargets.includes(event.targetId)) return context.votes;
        return { ...context.votes, [event.senderId]: event.targetId };
      },
    }),
    emitVoteCastFact: sendParent(({ event }) => {
      if (event.type !== 'GAME.VOTE')
        return { type: 'FACT.RECORD', fact: { type: 'VOTE_CAST', actorId: '', timestamp: 0 } };
      return {
        type: 'FACT.RECORD',
        fact: {
          type: 'VOTE_CAST',
          actorId: event.senderId,
          targetId: event.targetId,
          payload: { mechanism: 'MAJORITY' },
          timestamp: Date.now(),
        },
      };
    }),
    calculateResults: assign({
      results: ({ context }) => {
        const tallies: Record<string, number> = {};
        for (const targetId of Object.values(context.votes)) {
          tallies[targetId] = (tallies[targetId] || 0) + 1;
        }

        // Find max votes
        const maxVotes = Math.max(0, ...Object.values(tallies));
        if (maxVotes === 0) {
          return { eliminatedId: null, mechanism: 'MAJORITY' as const, summary: { tallies } };
        }

        // Tiebreaker: lowest silver among tied players
        const tied = Object.entries(tallies)
          .filter(([, count]) => count === maxVotes)
          .map(([id]) => id);

        let eliminatedId: string;
        if (tied.length === 1) {
          eliminatedId = tied[0];
        } else {
          eliminatedId = tied.reduce((lowest, id) => {
            const lowestSilver = context.roster[lowest]?.silver ?? Infinity;
            const currentSilver = context.roster[id]?.silver ?? Infinity;
            return currentSilver < lowestSilver ? id : lowest;
          });
        }

        return { eliminatedId, mechanism: 'MAJORITY' as const, summary: { tallies } };
      },
      phase: 'REVEAL',
    }),
    reportResults: sendParent(({ context }) => ({
      type: 'FACT.RECORD',
      fact: {
        type: 'GAME_RESULT',
        actorId: 'SYSTEM',
        payload: context.results,
        timestamp: Date.now(),
      },
    })),
  },
}).createMachine({
  id: 'majority-voting',
  context: ({ input }) => {
    const alive = getAlivePlayerIds(input.roster);
    return {
      voteType: 'MAJORITY',
      phase: 'VOTING',
      eligibleVoters: alive,
      eligibleTargets: alive,
      votes: {},
      results: null,
      roster: input.roster,
      dayIndex: input.dayIndex,
    };
  },
  initial: 'active',
  output: ({ context }) => context.results!,
  states: {
    active: {
      on: {
        'GAME.VOTE': { actions: ['recordVote', 'emitVoteCastFact'] },
        'INTERNAL.CLOSE_VOTING': { target: 'completed' },
      },
    },
    completed: {
      entry: ['calculateResults', 'reportResults'],
      type: 'final',
    },
  },
});
