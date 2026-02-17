/**
 * WOULD_YOU_RATHER Prompt Machine
 *
 * "Would you rather A or B?" — each player picks a side.
 * Silver rewards: +5 per response, +10 for minority choice (null if tied).
 */
import { setup, assign, sendParent, type AnyEventObject } from 'xstate';
import { Events, FactTypes, PromptPhases, type PromptCartridgeInput, type SocialPlayer } from '@pecking-order/shared-types';
import type { PromptEvent, PromptOutput } from './_contract';
import { getAlivePlayerIds } from '../voting/_helpers';

const SILVER_PER_RESPONSE = 5;
const SILVER_MINORITY_BONUS = 10;

interface WyrContext {
  promptType: 'WOULD_YOU_RATHER';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  optionA: string;
  optionB: string;
  eligibleVoters: string[];
  choices: Record<string, 'A' | 'B'>;
  results: any;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

function resolveResults(choices: Record<string, 'A' | 'B'>, optionA: string, optionB: string) {
  let countA = 0;
  let countB = 0;
  for (const choice of Object.values(choices)) {
    if (choice === 'A') countA++;
    else countB++;
  }

  const minorityChoice = countA < countB ? 'A' : countB < countA ? 'B' : null;

  const silverRewards: Record<string, number> = {};
  for (const [voterId, choice] of Object.entries(choices)) {
    silverRewards[voterId] = SILVER_PER_RESPONSE;
    if (minorityChoice && choice === minorityChoice) {
      silverRewards[voterId] += SILVER_MINORITY_BONUS;
    }
  }

  return { optionA, optionB, countA, countB, minorityChoice, silverRewards };
}

export const wyrMachine = setup({
  types: {
    context: {} as WyrContext,
    events: {} as PromptEvent,
    input: {} as PromptCartridgeInput,
    output: {} as PromptOutput,
  },
  guards: {} as any,
  actions: {
    recordChoice: assign(({ context, event }) => {
      if (event.type !== 'ACTIVITY.WYR.CHOOSE') return {};
      const { senderId, choice } = event as any;
      if (!senderId || !choice) return {};
      if (!context.eligibleVoters.includes(senderId)) return {};
      if (senderId in context.choices) return {};
      if (choice !== 'A' && choice !== 'B') return {};
      return { choices: { ...context.choices, [senderId]: choice } };
    }),
    calculateResults: assign(({ context }) => ({
      phase: PromptPhases.RESULTS,
      results: resolveResults(context.choices, context.optionA, context.optionB),
    })),
    emitPromptResultFact: sendParent(({ context }): AnyEventObject => ({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.PROMPT_RESULT as any,
        actorId: 'SYSTEM',
        payload: {
          promptType: 'WOULD_YOU_RATHER',
          promptText: context.promptText,
          results: context.results,
        },
        timestamp: Date.now(),
      },
    })),
  },
}).createMachine({
  id: 'wyr-prompt',
  context: ({ input }: any) => {
    const alive = getAlivePlayerIds(input.roster);
    return {
      promptType: 'WOULD_YOU_RATHER' as const,
      promptText: input.promptText,
      phase: PromptPhases.ACTIVE,
      optionA: input.optionA || 'Option A',
      optionB: input.optionB || 'Option B',
      eligibleVoters: alive,
      choices: {},
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
        'ACTIVITY.WYR.CHOOSE': [
          {
            guard: ({ context, event }: any) => {
              const senderId = event.senderId;
              if (!senderId || senderId in context.choices) return false;
              if (!context.eligibleVoters.includes(senderId)) return false;
              return context.eligibleVoters.every(
                (id: string) => id === senderId || id in context.choices
              );
            },
            actions: ['recordChoice', 'calculateResults'],
            target: 'completed',
          },
          { actions: 'recordChoice' },
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
