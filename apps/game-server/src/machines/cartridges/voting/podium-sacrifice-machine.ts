import { setup, assign, sendParent } from 'xstate';
import { Events, FactTypes, VotingPhases, VoteEvents } from '@pecking-order/shared-types';
import type { VoteResult, VotingCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { BaseVoteContext, VoteEvent } from './_contract';
import { getAlivePlayerIds, getTop3SilverIds } from './_helpers';

interface PodiumSacrificeContext extends BaseVoteContext {
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  podiumPlayerIds: string[];
}

export const podiumSacrificeMachine = setup({
  types: {
    context: {} as PodiumSacrificeContext,
    events: {} as VoteEvent,
    input: {} as VotingCartridgeInput,
    output: {} as VoteResult,
  },
  actions: {
    recordVote: assign({
      votes: ({ context, event }) => {
        if (event.type !== VoteEvents.PODIUM_SACRIFICE.CAST) return context.votes;
        if (!context.eligibleVoters.includes(event.senderId)) return context.votes;
        if (!context.eligibleTargets.includes(event.targetId!)) return context.votes;
        return { ...context.votes, [event.senderId]: event.targetId! };
      },
    }),
    emitVoteCastFact: sendParent(({ event }) => {
      if (event.type !== VoteEvents.PODIUM_SACRIFICE.CAST)
        return { type: Events.Fact.RECORD, fact: { type: FactTypes.VOTE_CAST, actorId: '', timestamp: 0 } };
      return {
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.VOTE_CAST,
          actorId: event.senderId,
          targetId: event.targetId,
          payload: { mechanism: 'PODIUM_SACRIFICE' },
          timestamp: Date.now(),
        },
      };
    }),
    calculateResults: assign({
      results: ({ context }) => {
        // Count saves per podium player (init all podium at 0)
        const tallies: Record<string, number> = {};
        for (const podiumId of context.podiumPlayerIds) {
          tallies[podiumId] = 0;
        }
        for (const targetId of Object.values(context.votes)) {
          tallies[targetId] = (tallies[targetId] || 0) + 1;
        }

        if (context.podiumPlayerIds.length === 0) {
          // Fallback: lowest silver among all alive players
          const alive = Object.entries(context.roster)
            .filter(([, p]) => p.status === 'ALIVE')
            .map(([id]) => id);
          const fallbackId = alive.reduce((lowest, id) => {
            const lowestSilver = context.roster[lowest]?.silver ?? Infinity;
            const currentSilver = context.roster[id]?.silver ?? Infinity;
            return currentSilver < lowestSilver ? id : lowest;
          }, alive[0]);
          return {
            eliminatedId: fallbackId,
            mechanism: 'PODIUM_SACRIFICE' as const,
            summary: { tallies, podiumPlayerIds: context.podiumPlayerIds },
          };
        }

        // Fewest saves = eliminated (sacrifice the least-saved podium player)
        const minSaves = Math.min(...Object.values(tallies));
        const tied = Object.entries(tallies)
          .filter(([, count]) => count === minSaves)
          .map(([id]) => id);

        let eliminatedId: string;
        if (tied.length === 1) {
          eliminatedId = tied[0];
        } else {
          // Tie-break: lowest silver balance
          eliminatedId = tied.reduce((lowest, id) => {
            const lowestSilver = context.roster[lowest]?.silver ?? Infinity;
            const currentSilver = context.roster[id]?.silver ?? Infinity;
            return currentSilver < lowestSilver ? id : lowest;
          });
        }

        return {
          eliminatedId,
          mechanism: 'PODIUM_SACRIFICE' as const,
          summary: { tallies, podiumPlayerIds: context.podiumPlayerIds },
        };
      },
      phase: VotingPhases.REVEAL,
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
  id: 'podium-sacrifice-voting',
  context: ({ input }) => {
    const alive = getAlivePlayerIds(input.roster);
    const podium = getTop3SilverIds(input.roster);
    const voters = alive.filter(id => !podium.includes(id));
    return {
      voteType: 'PODIUM_SACRIFICE',
      phase: VotingPhases.VOTING,
      eligibleVoters: voters,
      eligibleTargets: podium,
      votes: {},
      results: null,
      roster: input.roster,
      dayIndex: input.dayIndex,
      podiumPlayerIds: podium,
    };
  },
  initial: 'active',
  output: ({ context }) => context.results!,
  states: {
    active: {
      on: {
        [VoteEvents.PODIUM_SACRIFICE.CAST]: { actions: ['recordVote', 'emitVoteCastFact'] },
        'INTERNAL.CLOSE_VOTING': { target: 'completed' },
      },
    },
    completed: {
      entry: ['calculateResults', 'reportResults'],
      type: 'final',
    },
  },
});
