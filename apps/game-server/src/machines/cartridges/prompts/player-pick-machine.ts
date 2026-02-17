/**
 * PLAYER_PICK Prompt Machine
 *
 * "Pick your bestie" — each player picks another player.
 * Silver rewards: +5 per response, +10 per mutual pick (both players).
 */
import { setup, assign, sendParent, type AnyEventObject } from 'xstate';
import { Events, FactTypes, PromptPhases, ActivityEvents, type PromptCartridgeInput, type SocialPlayer } from '@pecking-order/shared-types';
import type { PromptEvent, PromptOutput, PromptResult } from './_contract';
import { getAlivePlayerIds } from '../voting/_helpers';

const SILVER_PER_RESPONSE = 5;
const SILVER_MUTUAL_BONUS = 10;

interface PlayerPickContext {
  promptType: 'PLAYER_PICK';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  responses: Record<string, string>; // voterId → targetId
  results: PromptResult | null;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

function resolveResults(responses: Record<string, string>): PromptResult {
  // Count picks per target
  const pickCounts: Record<string, number> = {};
  for (const targetId of Object.values(responses)) {
    pickCounts[targetId] = (pickCounts[targetId] || 0) + 1;
  }

  // Find most-picked
  let mostPicked: PromptResult['mostPicked'] = null;
  let maxCount = 0;
  for (const [playerId, count] of Object.entries(pickCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostPicked = { playerId, count };
    }
  }

  // Detect mutual picks (A picked B AND B picked A)
  const mutualPicks: Array<[string, string]> = [];
  const checked = new Set<string>();
  for (const [voterId, targetId] of Object.entries(responses)) {
    const key = [voterId, targetId].sort().join('-');
    if (checked.has(key)) continue;
    checked.add(key);
    if (responses[targetId] === voterId) {
      mutualPicks.push([voterId, targetId]);
    }
  }

  // Calculate silver rewards
  const silverRewards: Record<string, number> = {};
  for (const voterId of Object.keys(responses)) {
    silverRewards[voterId] = (silverRewards[voterId] || 0) + SILVER_PER_RESPONSE;
  }
  for (const [a, b] of mutualPicks) {
    silverRewards[a] = (silverRewards[a] || 0) + SILVER_MUTUAL_BONUS;
    silverRewards[b] = (silverRewards[b] || 0) + SILVER_MUTUAL_BONUS;
  }

  return { mostPicked, mutualPicks, silverRewards };
}

export const playerPickMachine = setup({
  types: {
    context: {} as PlayerPickContext,
    events: {} as PromptEvent,
    input: {} as PromptCartridgeInput,
    output: {} as PromptOutput,
  },
  guards: {
    allResponded: ({ context }: any) =>
      context.eligibleVoters.every((id: string) => id in context.responses),
  },
  actions: {
    recordResponse: assign(({ context, event }) => {
      if (event.type !== ActivityEvents.PROMPT.SUBMIT) return {};
      const { senderId, targetId } = event as any;
      if (!senderId || !targetId) return {};
      if (!context.eligibleVoters.includes(senderId)) return {};
      if (senderId in context.responses) return {}; // already responded
      if (senderId === targetId) return {}; // can't pick yourself
      return {
        responses: { ...context.responses, [senderId]: targetId },
      };
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
          promptType: 'PLAYER_PICK',
          promptText: context.promptText,
          results: context.results,
        },
        timestamp: Date.now(),
      },
    })),
  },
}).createMachine({
  id: 'player-pick-prompt',
  context: ({ input }: any) => {
    const alive = getAlivePlayerIds(input.roster);
    return {
      promptType: 'PLAYER_PICK' as const,
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
              // Check if this response would make all responded
              const senderId = event.senderId;
              if (!senderId || senderId in context.responses) return false;
              if (!context.eligibleVoters.includes(senderId)) return false;
              const wouldBeComplete = context.eligibleVoters.every(
                (id: string) => id === senderId || id in context.responses
              );
              return wouldBeComplete;
            },
            actions: ['recordResponse', 'calculateResults'],
            target: 'completed',
          },
          {
            actions: 'recordResponse',
          },
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
