/**
 * PREDICTION Prompt Machine
 *
 * "Who will be eliminated tonight?" — each player predicts a target.
 * Silver rewards: +5 per response, +10 for picking the most-predicted player (consensus).
 */
import { setup, assign, sendParent, type AnyEventObject } from 'xstate';
import { Events, FactTypes, PromptPhases, ActivityEvents, Config, type PromptCartridgeInput, type SocialPlayer } from '@pecking-order/shared-types';
import type { PromptEvent, PromptOutput } from './_contract';
import { getAlivePlayerIds } from '../voting/_helpers';

const SILVER_PER_RESPONSE = Config.prompt.silverParticipation;
const SILVER_CONSENSUS_BONUS = Config.prompt.silverConsensusBonus;

interface PredictionContext {
  promptType: 'PREDICTION';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  responses: Record<string, string>; // voterId → predictedPlayerId
  results: any;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

function resolveResults(responses: Record<string, string>) {
  const pickCounts: Record<string, number> = {};
  for (const targetId of Object.values(responses)) {
    pickCounts[targetId] = (pickCounts[targetId] || 0) + 1;
  }

  let mostPicked: { playerId: string; count: number } | null = null;
  let maxCount = 0;
  for (const [playerId, count] of Object.entries(pickCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostPicked = { playerId, count };
    }
  }

  // Consensus voters = those who picked the most-predicted player
  const consensusVoters = mostPicked
    ? Object.entries(responses)
        .filter(([_, target]) => target === mostPicked!.playerId)
        .map(([voterId]) => voterId)
    : [];

  const silverRewards: Record<string, number> = {};
  for (const voterId of Object.keys(responses)) {
    silverRewards[voterId] = SILVER_PER_RESPONSE;
  }
  for (const voterId of consensusVoters) {
    silverRewards[voterId] = (silverRewards[voterId] || 0) + SILVER_CONSENSUS_BONUS;
  }

  return { mostPicked, consensusVoters, silverRewards };
}

export const predictionMachine = setup({
  types: {
    context: {} as PredictionContext,
    events: {} as PromptEvent,
    input: {} as PromptCartridgeInput,
    output: {} as PromptOutput,
  },
  guards: {} as any,
  actions: {
    recordResponse: assign(({ context, event }) => {
      if (event.type !== ActivityEvents.PROMPT.SUBMIT) return {};
      const { senderId, targetId } = event as any;
      if (!senderId || !targetId) return {};
      if (!context.eligibleVoters.includes(senderId)) return {};
      if (senderId in context.responses) return {};
      if (senderId === targetId) return {};
      return { responses: { ...context.responses, [senderId]: targetId } };
    }),
    calculateResults: assign(({ context }) => ({
      phase: PromptPhases.RESULTS,
      results: resolveResults(context.responses),
    })),
    emitPromptResultFact: sendParent(({ context }): AnyEventObject => ({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.PROMPT_RESULT as any,
        actorId: 'SYSTEM',
        payload: {
          promptType: 'PREDICTION',
          promptText: context.promptText,
          results: context.results,
        },
        timestamp: Date.now(),
      },
    })),
  },
}).createMachine({
  id: 'prediction-prompt',
  context: ({ input }: any) => {
    const alive = getAlivePlayerIds(input.roster);
    return {
      promptType: 'PREDICTION' as const,
      promptText: input.promptText,
      phase: PromptPhases.ACTIVE,
      eligibleVoters: alive,
      responses: {},
      results: null,
      roster: input.roster,
      dayIndex: input.dayIndex,
    };
  },
  initial: 'active',
  output: ({ context }: any) => ({
    silverRewards: context.results?.silverRewards || {},
  }),
  states: {
    active: {
      on: {
        [ActivityEvents.PROMPT.SUBMIT]: [
          {
            guard: ({ context, event }: any) => {
              const senderId = event.senderId;
              if (!senderId || senderId in context.responses) return false;
              if (!context.eligibleVoters.includes(senderId)) return false;
              return context.eligibleVoters.every(
                (id: string) => id === senderId || id in context.responses
              );
            },
            actions: ['recordResponse', 'calculateResults'],
            target: 'completed',
          },
          { actions: 'recordResponse' },
        ],
        'INTERNAL.END_ACTIVITY': {
          target: 'completed',
          actions: 'calculateResults',
        },
      },
    },
    completed: {
      entry: 'emitPromptResultFact',
      type: 'final',
    },
  },
} as any);
