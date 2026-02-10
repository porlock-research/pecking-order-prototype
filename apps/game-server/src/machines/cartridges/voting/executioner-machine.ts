import { setup, assign, sendParent } from 'xstate';
import type { VoteResult, VotingCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { BaseVoteContext, VoteEvent } from './_contract';
import { getAlivePlayerIds, getTop3SilverIds } from './_helpers';

interface ExecutionerContext extends BaseVoteContext {
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  executionerId: string | null;
  electionVotes: Record<string, string>;
  electionTallies: Record<string, number>;
}

export const executionerMachine = setup({
  types: {
    context: {} as ExecutionerContext,
    events: {} as VoteEvent,
    input: {} as VotingCartridgeInput,
    output: {} as VoteResult,
  },
  guards: {
    isExecutioner: ({ context, event }) => {
      if (event.type !== 'VOTE.EXECUTIONER.PICK') return false;
      return event.senderId === context.executionerId;
    },
  },
  actions: {
    recordElectionVote: assign({
      electionVotes: ({ context, event }) => {
        if (event.type !== 'VOTE.EXECUTIONER.ELECT') return context.electionVotes;
        if (!context.eligibleVoters.includes(event.senderId)) return context.electionVotes;
        if (!context.eligibleTargets.includes(event.targetId!)) return context.electionVotes;
        return { ...context.electionVotes, [event.senderId]: event.targetId! };
      },
      votes: ({ context, event }) => {
        if (event.type !== 'VOTE.EXECUTIONER.ELECT') return context.votes;
        if (!context.eligibleVoters.includes(event.senderId)) return context.votes;
        if (!context.eligibleTargets.includes(event.targetId!)) return context.votes;
        return { ...context.votes, [event.senderId]: event.targetId! };
      },
    }),
    emitVoteCastFact: sendParent(({ event }) => {
      if (event.type !== 'VOTE.EXECUTIONER.ELECT')
        return { type: 'FACT.RECORD', fact: { type: 'VOTE_CAST', actorId: '', timestamp: 0 } };
      return {
        type: 'FACT.RECORD',
        fact: {
          type: 'VOTE_CAST',
          actorId: event.senderId,
          targetId: event.targetId,
          payload: { mechanism: 'EXECUTIONER', phase: 'election' },
          timestamp: Date.now(),
        },
      };
    }),
    resolveElection: assign(({ context }) => {
      const tallies: Record<string, number> = {};
      for (const targetId of Object.values(context.electionVotes)) {
        tallies[targetId] = (tallies[targetId] || 0) + 1;
      }

      const maxVotes = Math.max(0, ...Object.values(tallies));
      let executionerId: string | null = null;

      if (maxVotes > 0) {
        const tied = Object.entries(tallies)
          .filter(([, count]) => count === maxVotes)
          .map(([id]) => id);

        executionerId = tied.reduce((lowest, id) => {
          const lowestSilver = context.roster[lowest]?.silver ?? Infinity;
          const currentSilver = context.roster[id]?.silver ?? Infinity;
          return currentSilver < lowestSilver ? id : lowest;
        });
      }

      const top3 = getTop3SilverIds(context.roster);
      const pickTargets = getAlivePlayerIds(context.roster)
        .filter(id => id !== executionerId && !top3.includes(id));

      return {
        executionerId,
        electionTallies: tallies,
        phase: 'EXECUTIONER_PICKING' as const,
        eligibleVoters: executionerId ? [executionerId] : [],
        eligibleTargets: pickTargets,
        votes: {},
      };
    }),
    recordPick: assign({
      results: ({ context, event }) => {
        if (event.type !== 'VOTE.EXECUTIONER.PICK') return context.results;
        return {
          eliminatedId: event.targetId!,
          mechanism: 'EXECUTIONER' as const,
          summary: {
            executionerId: context.executionerId,
            electionTallies: context.electionTallies,
          },
        };
      },
      votes: ({ context, event }) => {
        if (event.type !== 'VOTE.EXECUTIONER.PICK') return context.votes;
        return { [event.senderId]: event.targetId! };
      },
      phase: 'REVEAL' as const,
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
  id: 'executioner-voting',
  context: ({ input }) => {
    const alive = getAlivePlayerIds(input.roster);
    return {
      voteType: 'EXECUTIONER',
      phase: 'VOTING',
      eligibleVoters: alive,
      eligibleTargets: alive,
      votes: {},
      results: null,
      roster: input.roster,
      dayIndex: input.dayIndex,
      executionerId: null,
      electionVotes: {},
      electionTallies: {},
    };
  },
  initial: 'electing',
  output: ({ context }) => context.results!,
  states: {
    electing: {
      on: {
        'VOTE.EXECUTIONER.ELECT': { actions: ['recordElectionVote', 'emitVoteCastFact'] },
        'INTERNAL.CLOSE_VOTING': {
          target: 'executionerPicking',
          actions: 'resolveElection',
        },
      },
    },
    executionerPicking: {
      on: {
        'VOTE.EXECUTIONER.PICK': {
          guard: 'isExecutioner',
          target: 'completed',
          actions: 'recordPick',
        },
      },
    },
    completed: {
      entry: ['reportResults'],
      type: 'final',
    },
  },
});
