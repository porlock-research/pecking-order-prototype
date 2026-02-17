import { setup, assign, sendParent } from 'xstate';
import { Events, FactTypes, VotingPhases, VoteEvents } from '@pecking-order/shared-types';
import type { VoteResult, VotingCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { BaseVoteContext, VoteEvent } from './_contract';
import { getAlivePlayerIds, getTop3SilverIds } from './_helpers';

interface BubbleContext extends BaseVoteContext {
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  immunePlayerIds: string[];
}

export const bubbleMachine = setup({
  types: {
    context: {} as BubbleContext,
    events: {} as VoteEvent,
    input: {} as VotingCartridgeInput,
    output: {} as VoteResult,
  },
  actions: {
    recordVote: assign({
      votes: ({ context, event }) => {
        if (event.type !== VoteEvents.BUBBLE.CAST) return context.votes;
        if (!context.eligibleVoters.includes(event.senderId)) return context.votes;
        if (!context.eligibleTargets.includes(event.targetId!)) return context.votes;
        return { ...context.votes, [event.senderId]: event.targetId! };
      },
    }),
    emitVoteCastFact: sendParent(({ event }) => {
      if (event.type !== VoteEvents.BUBBLE.CAST)
        return { type: Events.Fact.RECORD, fact: { type: FactTypes.VOTE_CAST, actorId: '', timestamp: 0 } };
      return {
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.VOTE_CAST,
          actorId: event.senderId,
          targetId: event.targetId,
          payload: { mechanism: 'BUBBLE' },
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

        const maxVotes = Math.max(0, ...Object.values(tallies));
        if (maxVotes === 0) {
          return {
            eliminatedId: null,
            mechanism: 'BUBBLE' as const,
            summary: { tallies, immunePlayerIds: context.immunePlayerIds },
          };
        }

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

        return {
          eliminatedId,
          mechanism: 'BUBBLE' as const,
          summary: { tallies, immunePlayerIds: context.immunePlayerIds },
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
  id: 'bubble-voting',
  context: ({ input }) => {
    const alive = getAlivePlayerIds(input.roster);
    const immune = getTop3SilverIds(input.roster);
    const targets = alive.filter(id => !immune.includes(id));
    return {
      voteType: 'BUBBLE',
      phase: VotingPhases.VOTING,
      eligibleVoters: alive,
      eligibleTargets: targets,
      votes: {},
      results: null,
      roster: input.roster,
      dayIndex: input.dayIndex,
      immunePlayerIds: immune,
    };
  },
  initial: 'active',
  output: ({ context }) => context.results!,
  states: {
    active: {
      on: {
        [VoteEvents.BUBBLE.CAST]: { actions: ['recordVote', 'emitVoteCastFact'] },
        'INTERNAL.CLOSE_VOTING': { target: 'completed' },
      },
    },
    completed: {
      entry: ['calculateResults', 'reportResults'],
      type: 'final',
    },
  },
});
