import { setup, assign, sendParent } from 'xstate';
import type { VoteResult, VotingCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { BaseVoteContext, VoteEvent } from './_contract';

interface ExecutionerContext extends BaseVoteContext {
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  executionerId: string | null;
  electionVotes: Record<string, string>;
  electionTallies: Record<string, number>;
}

function getAlivePlayerIds(roster: Record<string, SocialPlayer>): string[] {
  return Object.entries(roster)
    .filter(([, p]) => p.status === 'ALIVE')
    .map(([id]) => id);
}

function getTop3SilverIds(roster: Record<string, SocialPlayer>): string[] {
  return Object.entries(roster)
    .filter(([, p]) => p.status === 'ALIVE')
    .sort(([, a], [, b]) => b.silver - a.silver)
    .slice(0, 3)
    .map(([id]) => id);
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
      if (event.type !== 'GAME.EXECUTIONER_PICK') return false;
      return event.senderId === context.executionerId;
    },
  },
  actions: {
    recordElectionVote: assign({
      electionVotes: ({ context, event }) => {
        if (event.type !== 'GAME.VOTE') return context.electionVotes;
        if (!context.eligibleVoters.includes(event.senderId)) return context.electionVotes;
        if (!context.eligibleTargets.includes(event.targetId)) return context.electionVotes;
        return { ...context.electionVotes, [event.senderId]: event.targetId };
      },
      // Also mirror to public votes for client rendering
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
          payload: { mechanism: 'EXECUTIONER', phase: 'election' },
          timestamp: Date.now(),
        },
      };
    }),
    resolveElection: assign(({ context }) => {
      // Tally election votes
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

        // Tiebreaker: lowest silver
        executionerId = tied.reduce((lowest, id) => {
          const lowestSilver = context.roster[lowest]?.silver ?? Infinity;
          const currentSilver = context.roster[id]?.silver ?? Infinity;
          return currentSilver < lowestSilver ? id : lowest;
        });
      }

      // Executioner can pick anyone alive EXCEPT top 3 silver AND themselves
      const top3 = getTop3SilverIds(context.roster);
      const pickTargets = getAlivePlayerIds(context.roster)
        .filter(id => id !== executionerId && !top3.includes(id));

      return {
        executionerId,
        electionTallies: tallies,
        phase: 'EXECUTIONER_PICKING' as const,
        eligibleVoters: executionerId ? [executionerId] : [],
        eligibleTargets: pickTargets,
        votes: {}, // Clear votes for the picking phase
      };
    }),
    recordPick: assign({
      results: ({ context, event }) => {
        if (event.type !== 'GAME.EXECUTIONER_PICK') return context.results;
        return {
          eliminatedId: event.targetId,
          mechanism: 'EXECUTIONER' as const,
          summary: {
            executionerId: context.executionerId,
            electionTallies: context.electionTallies,
          },
        };
      },
      votes: ({ context, event }) => {
        if (event.type !== 'GAME.EXECUTIONER_PICK') return context.votes;
        return { [event.senderId]: event.targetId };
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
        'GAME.VOTE': { actions: ['recordElectionVote', 'emitVoteCastFact'] },
        'INTERNAL.CLOSE_VOTING': {
          target: 'executionerPicking',
          actions: 'resolveElection',
        },
      },
    },
    executionerPicking: {
      on: {
        'GAME.EXECUTIONER_PICK': {
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
