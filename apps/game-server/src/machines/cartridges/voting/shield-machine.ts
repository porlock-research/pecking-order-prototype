import { setup, assign, sendParent } from 'xstate';
import { Events, FactTypes, VotingPhases, VoteEvents } from '@pecking-order/shared-types';
import type { VoteResult, VotingCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { BaseVoteContext, VoteEvent } from './_contract';
import { getAlivePlayerIds } from './_helpers';

interface ShieldContext extends BaseVoteContext {
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

export const shieldMachine = setup({
  types: {
    context: {} as ShieldContext,
    events: {} as VoteEvent,
    input: {} as VotingCartridgeInput,
    output: {} as VoteResult,
  },
  actions: {
    recordVote: assign({
      votes: ({ context, event }) => {
        if (event.type !== VoteEvents.SHIELD.SAVE) return context.votes;
        if (!context.eligibleVoters.includes(event.senderId)) return context.votes;
        if (!context.eligibleTargets.includes(event.targetId!)) return context.votes;
        return { ...context.votes, [event.senderId]: event.targetId! };
      },
    }),
    emitVoteCastFact: sendParent(({ event }) => {
      if (event.type !== VoteEvents.SHIELD.SAVE)
        return { type: Events.Fact.RECORD, fact: { type: FactTypes.VOTE_CAST, actorId: '', timestamp: 0 } };
      return {
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.VOTE_CAST,
          actorId: event.senderId,
          targetId: event.targetId,
          payload: { mechanism: 'SHIELD' },
          timestamp: Date.now(),
        },
      };
    }),
    calculateResults: assign({
      results: ({ context }) => {
        // Count saves per player (init all eligible at 0)
        const saveCounts: Record<string, number> = {};
        for (const id of context.eligibleTargets) {
          saveCounts[id] = 0;
        }
        for (const targetId of Object.values(context.votes)) {
          saveCounts[targetId] = (saveCounts[targetId] || 0) + 1;
        }

        const minSaves = Math.min(...Object.values(saveCounts));
        const tied = Object.entries(saveCounts)
          .filter(([, count]) => count === minSaves)
          .map(([id]) => id);

        let eliminatedId: string;
        if (tied.length === 0) {
          return {
            eliminatedId: null,
            mechanism: 'SHIELD' as const,
            summary: { saveCounts },
          };
        } else if (tied.length === 1) {
          eliminatedId = tied[0];
        } else {
          // Spec says random for SHIELD ties
          eliminatedId = tied[Math.floor(Math.random() * tied.length)];
        }

        return {
          eliminatedId,
          mechanism: 'SHIELD' as const,
          summary: { saveCounts },
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
  id: 'shield-voting',
  context: ({ input }) => {
    const alive = getAlivePlayerIds(input.roster);
    return {
      voteType: 'SHIELD',
      phase: VotingPhases.VOTING,
      eligibleVoters: alive,
      eligibleTargets: alive, // Can save anyone including self
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
        [VoteEvents.SHIELD.SAVE]: { actions: ['recordVote', 'emitVoteCastFact'] },
        'INTERNAL.CLOSE_VOTING': { target: 'completed' },
      },
    },
    completed: {
      entry: ['calculateResults', 'reportResults'],
      type: 'final',
    },
  },
});
