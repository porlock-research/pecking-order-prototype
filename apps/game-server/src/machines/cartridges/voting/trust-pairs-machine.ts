import { setup, assign, sendParent } from 'xstate';
import type { VoteResult, VotingCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { BaseVoteContext, VoteEvent } from './_contract';
import { getAlivePlayerIds } from './_helpers';

interface TrustPairsContext extends BaseVoteContext {
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  trustPicks: Record<string, string>;
  votePicks: Record<string, string>;
  mutualPairs: string[][];
  immunePlayerIds: string[];
}

export const trustPairsMachine = setup({
  types: {
    context: {} as TrustPairsContext,
    events: {} as VoteEvent,
    input: {} as VotingCartridgeInput,
    output: {} as VoteResult,
  },
  actions: {
    recordTrust: assign({
      trustPicks: ({ context, event }) => {
        if (event.type !== 'VOTE.TRUST_PAIRS.TRUST') return context.trustPicks;
        if (!context.eligibleVoters.includes(event.senderId)) return context.trustPicks;
        // Can't trust self
        if (event.targetId === event.senderId) return context.trustPicks;
        if (!context.eligibleTargets.includes(event.targetId!)) return context.trustPicks;
        return { ...context.trustPicks, [event.senderId]: event.targetId! };
      },
    }),
    emitTrustFact: sendParent(({ event }) => {
      if (event.type !== 'VOTE.TRUST_PAIRS.TRUST')
        return { type: 'FACT.RECORD', fact: { type: 'VOTE_CAST', actorId: '', timestamp: 0 } };
      return {
        type: 'FACT.RECORD',
        fact: {
          type: 'VOTE_CAST',
          actorId: event.senderId,
          targetId: event.targetId,
          payload: { mechanism: 'TRUST_PAIRS', slot: 'trust' },
          timestamp: Date.now(),
        },
      };
    }),
    recordEliminate: assign({
      votePicks: ({ context, event }) => {
        if (event.type !== 'VOTE.TRUST_PAIRS.ELIMINATE') return context.votePicks;
        if (!context.eligibleVoters.includes(event.senderId)) return context.votePicks;
        if (!context.eligibleTargets.includes(event.targetId!)) return context.votePicks;
        return { ...context.votePicks, [event.senderId]: event.targetId! };
      },
      // Mirror to votes for BaseVoteContext compat
      votes: ({ context, event }) => {
        if (event.type !== 'VOTE.TRUST_PAIRS.ELIMINATE') return context.votes;
        if (!context.eligibleVoters.includes(event.senderId)) return context.votes;
        if (!context.eligibleTargets.includes(event.targetId!)) return context.votes;
        return { ...context.votes, [event.senderId]: event.targetId! };
      },
    }),
    emitEliminateFact: sendParent(({ event }) => {
      if (event.type !== 'VOTE.TRUST_PAIRS.ELIMINATE')
        return { type: 'FACT.RECORD', fact: { type: 'VOTE_CAST', actorId: '', timestamp: 0 } };
      return {
        type: 'FACT.RECORD',
        fact: {
          type: 'VOTE_CAST',
          actorId: event.senderId,
          targetId: event.targetId,
          payload: { mechanism: 'TRUST_PAIRS', slot: 'eliminate' },
          timestamp: Date.now(),
        },
      };
    }),
    calculateResults: assign(({ context }) => {
      // 1. Find mutual pairs
      const mutualPairs: string[][] = [];
      const immuneSet = new Set<string>();
      const processed = new Set<string>();

      for (const [a, b] of Object.entries(context.trustPicks)) {
        if (processed.has(a)) continue;
        if (context.trustPicks[b] === a) {
          mutualPairs.push([a, b]);
          immuneSet.add(a);
          immuneSet.add(b);
          processed.add(a);
          processed.add(b);
        }
      }

      const immunePlayerIds = Array.from(immuneSet);

      // 2. Count elimination votes targeting non-immune players only
      const tallies: Record<string, number> = {};
      for (const targetId of Object.values(context.votePicks)) {
        if (immuneSet.has(targetId)) continue;
        tallies[targetId] = (tallies[targetId] || 0) + 1;
      }

      const maxVotes = Math.max(0, ...Object.values(tallies));
      let eliminatedId: string | null = null;

      if (maxVotes > 0) {
        const tied = Object.entries(tallies)
          .filter(([, count]) => count === maxVotes)
          .map(([id]) => id);

        if (tied.length === 1) {
          eliminatedId = tied[0];
        } else {
          // Tiebreaker: lowest silver
          eliminatedId = tied.reduce((lowest, id) => {
            const lowestSilver = context.roster[lowest]?.silver ?? Infinity;
            const currentSilver = context.roster[id]?.silver ?? Infinity;
            return currentSilver < lowestSilver ? id : lowest;
          });
        }
      }

      return {
        mutualPairs,
        immunePlayerIds,
        results: {
          eliminatedId,
          mechanism: 'TRUST_PAIRS' as const,
          summary: { tallies, mutualPairs, immunePlayerIds },
        },
        phase: 'REVEAL' as const,
      };
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
  id: 'trust-pairs-voting',
  context: ({ input }) => {
    const alive = getAlivePlayerIds(input.roster);
    return {
      voteType: 'TRUST_PAIRS',
      phase: 'VOTING',
      eligibleVoters: alive,
      eligibleTargets: alive,
      votes: {},
      results: null,
      roster: input.roster,
      dayIndex: input.dayIndex,
      trustPicks: {},
      votePicks: {},
      mutualPairs: [],
      immunePlayerIds: [],
    };
  },
  initial: 'active',
  output: ({ context }) => context.results!,
  states: {
    active: {
      on: {
        'VOTE.TRUST_PAIRS.TRUST': { actions: ['recordTrust', 'emitTrustFact'] },
        'VOTE.TRUST_PAIRS.ELIMINATE': { actions: ['recordEliminate', 'emitEliminateFact'] },
        'INTERNAL.CLOSE_VOTING': { target: 'completed' },
      },
    },
    completed: {
      entry: ['calculateResults', 'reportResults'],
      type: 'final',
    },
  },
});
