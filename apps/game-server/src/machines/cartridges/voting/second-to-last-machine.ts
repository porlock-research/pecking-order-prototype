import { setup, assign, sendParent } from 'xstate';
import type { VoteResult, VotingCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { BaseVoteContext, VoteEvent } from './_contract';
import { getSilverRanking } from './_helpers';

interface SecondToLastContext extends BaseVoteContext {
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  silverRanking: Array<{ id: string; silver: number }>;
}

export const secondToLastMachine = setup({
  types: {
    context: {} as SecondToLastContext,
    events: {} as VoteEvent,
    input: {} as VotingCartridgeInput,
    output: {} as VoteResult,
  },
  actions: {
    calculateResults: assign({
      results: ({ context }) => {
        const ranking = context.silverRanking;
        if (ranking.length < 2) {
          return {
            eliminatedId: null,
            mechanism: 'SECOND_TO_LAST' as const,
            summary: { silverRanking: ranking },
          };
        }

        // 2nd-to-last = second from bottom (index length - 2)
        const secondToLast = ranking[ranking.length - 2];

        return {
          eliminatedId: secondToLast.id,
          mechanism: 'SECOND_TO_LAST' as const,
          summary: { silverRanking: ranking },
        };
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
  id: 'second-to-last-voting',
  context: ({ input }) => {
    const ranking = getSilverRanking(input.roster);
    return {
      voteType: 'SECOND_TO_LAST',
      phase: 'VOTING',
      eligibleVoters: [],
      eligibleTargets: [],
      votes: {},
      results: null,
      roster: input.roster,
      dayIndex: input.dayIndex,
      silverRanking: ranking,
    };
  },
  initial: 'calculating',
  output: ({ context }) => context.results!,
  states: {
    calculating: {
      entry: ['calculateResults'],
      always: 'completed',
    },
    completed: {
      entry: ['reportResults'],
      type: 'final',
    },
  },
});
