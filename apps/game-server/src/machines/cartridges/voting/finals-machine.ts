import { setup, assign, sendParent } from 'xstate';
import { Events, FactTypes, VotingPhases } from '@pecking-order/shared-types';
import type { VoteResult, VotingCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { BaseVoteContext, VoteEvent } from './_contract';
import { getAlivePlayerIds, getEliminatedPlayerIds } from './_helpers';

interface FinalsContext extends BaseVoteContext {
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  winnerId: string | null;
}

export const finalsMachine = setup({
  types: {
    context: {} as FinalsContext,
    events: {} as VoteEvent,
    input: {} as VotingCartridgeInput,
    output: {} as VoteResult,
  },
  actions: {
    recordVote: assign({
      votes: ({ context, event }) => {
        if (event.type !== 'VOTE.FINALS.CAST') return context.votes;
        if (!context.eligibleVoters.includes(event.senderId)) return context.votes;
        if (!context.eligibleTargets.includes(event.targetId!)) return context.votes;
        return { ...context.votes, [event.senderId]: event.targetId! };
      },
    }),
    emitVoteCastFact: sendParent(({ event }) => {
      if (event.type !== 'VOTE.FINALS.CAST')
        return { type: Events.Fact.RECORD, fact: { type: FactTypes.VOTE_CAST, actorId: '', timestamp: 0 } };
      return {
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.VOTE_CAST,
          actorId: event.senderId,
          targetId: event.targetId,
          payload: { mechanism: 'FINALS' },
          timestamp: Date.now(),
        },
      };
    }),
    calculateResults: assign({
      results: ({ context }) => {
        const alive = context.eligibleTargets;

        // Edge case: 0 eliminated voters → alive player with most silver wins
        if (context.eligibleVoters.length === 0) {
          const winner = alive
            .map(id => ({ id, silver: context.roster[id]?.silver ?? 0 }))
            .sort((a, b) => b.silver - a.silver)[0];
          const winnerId = winner?.id ?? alive[0];
          const losers = alive.filter(id => id !== winnerId);
          return {
            eliminatedId: losers[0] ?? null,
            winnerId,
            mechanism: 'FINALS' as const,
            summary: { voteCounts: {}, tieBreaker: 'highest_silver_no_voters' },
          };
        }

        // Count votes per alive candidate
        const voteCounts: Record<string, number> = {};
        for (const id of alive) {
          voteCounts[id] = 0;
        }
        for (const targetId of Object.values(context.votes)) {
          voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
        }

        const maxVotes = Math.max(...Object.values(voteCounts));
        const tied = Object.entries(voteCounts)
          .filter(([, count]) => count === maxVotes)
          .map(([id]) => id);

        let winnerId: string;
        let tieBreaker: string | undefined;

        if (tied.length === 1) {
          winnerId = tied[0];
        } else {
          // Tie-break: highest silver among tied
          const bySilver = tied
            .map(id => ({ id, silver: context.roster[id]?.silver ?? 0 }))
            .sort((a, b) => b.silver - a.silver);

          if (bySilver[0].silver !== bySilver[1].silver) {
            winnerId = bySilver[0].id;
            tieBreaker = 'highest_silver';
          } else {
            // Still tied → random
            winnerId = tied[Math.floor(Math.random() * tied.length)];
            tieBreaker = 'random';
          }
        }

        const losers = alive.filter(id => id !== winnerId);
        return {
          eliminatedId: losers[0] ?? null,
          winnerId,
          mechanism: 'FINALS' as const,
          summary: { voteCounts, ...(tieBreaker && { tieBreaker }) },
        };
      },
      winnerId: ({ context }) => {
        // Will be set by the results calculation above — re-derive for context sync
        return null; // Placeholder, actual value comes from results
      },
      phase: VotingPhases.WINNER,
    }),
    // After calculateResults runs, extract winnerId from results for context access
    syncWinnerId: assign({
      winnerId: ({ context }) => context.results?.winnerId ?? null,
    }),
    reportResults: sendParent(({ context }) => ({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.GAME_RESULT,
        actorId: 'SYSTEM',
        payload: context.results,
        timestamp: Date.now(),
      },
    })),
  },
}).createMachine({
  id: 'finals-voting',
  context: ({ input }) => {
    const alive = getAlivePlayerIds(input.roster);
    const eliminated = getEliminatedPlayerIds(input.roster);
    return {
      voteType: 'FINALS',
      phase: VotingPhases.VOTING,
      eligibleVoters: eliminated,    // Only eliminated players vote
      eligibleTargets: alive,         // Vote for alive players
      votes: {},
      results: null,
      roster: input.roster,
      dayIndex: input.dayIndex,
      winnerId: null,
    };
  },
  initial: 'active',
  output: ({ context }) => context.results!,
  states: {
    active: {
      on: {
        'VOTE.FINALS.CAST': { actions: ['recordVote', 'emitVoteCastFact'] },
        'INTERNAL.CLOSE_VOTING': { target: 'completed' },
      },
    },
    completed: {
      entry: ['calculateResults', 'syncWinnerId', 'reportResults'],
      type: 'final',
    },
  },
});
