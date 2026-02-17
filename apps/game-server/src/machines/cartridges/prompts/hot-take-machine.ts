/**
 * HOT_TAKE Prompt Machine
 *
 * "Agree or disagree: <statement>" — each player picks a stance.
 * Silver rewards: +5 per response, +10 for minority stance (null if tied).
 */
import { setup, assign, sendParent, type AnyEventObject } from 'xstate';
import { Events, FactTypes, PromptPhases, ActivityEvents, Config, type PromptCartridgeInput, type SocialPlayer } from '@pecking-order/shared-types';
import type { PromptEvent, PromptOutput } from './_contract';
import { getAlivePlayerIds } from '../voting/_helpers';

const SILVER_PER_RESPONSE = Config.prompt.silverParticipation;
const SILVER_MINORITY_BONUS = Config.prompt.silverMinorityBonus;

interface HotTakeContext {
  promptType: 'HOT_TAKE';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  stances: Record<string, 'AGREE' | 'DISAGREE'>;
  results: any;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

function resolveResults(stances: Record<string, 'AGREE' | 'DISAGREE'>, promptText: string) {
  let agreeCount = 0;
  let disagreeCount = 0;
  for (const stance of Object.values(stances)) {
    if (stance === 'AGREE') agreeCount++;
    else disagreeCount++;
  }

  const minorityStance = agreeCount < disagreeCount ? 'AGREE' : disagreeCount < agreeCount ? 'DISAGREE' : null;

  const silverRewards: Record<string, number> = {};
  for (const [voterId, stance] of Object.entries(stances)) {
    silverRewards[voterId] = SILVER_PER_RESPONSE;
    if (minorityStance && stance === minorityStance) {
      silverRewards[voterId] += SILVER_MINORITY_BONUS;
    }
  }

  return { statement: promptText, agreeCount, disagreeCount, minorityStance, silverRewards };
}

export const hotTakeMachine = setup({
  types: {
    context: {} as HotTakeContext,
    events: {} as PromptEvent,
    input: {} as PromptCartridgeInput,
    output: {} as PromptOutput,
  },
  guards: {} as any,
  actions: {
    recordStance: assign(({ context, event }) => {
      if (event.type !== ActivityEvents.HOTTAKE.RESPOND) return {};
      const { senderId, stance } = event as any;
      if (!senderId || !stance) return {};
      if (!context.eligibleVoters.includes(senderId)) return {};
      if (senderId in context.stances) return {};
      if (stance !== 'AGREE' && stance !== 'DISAGREE') return {};
      return { stances: { ...context.stances, [senderId]: stance } };
    }),
    calculateResults: assign(({ context }) => ({
      phase: PromptPhases.RESULTS,
      results: resolveResults(context.stances, context.promptText),
    })),
    emitPromptResultFact: sendParent(({ context }): AnyEventObject => ({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.PROMPT_RESULT as any,
        actorId: 'SYSTEM',
        payload: {
          promptType: 'HOT_TAKE',
          promptText: context.promptText,
          results: context.results,
        },
        timestamp: Date.now(),
      },
    })),
  },
}).createMachine({
  id: 'hot-take-prompt',
  context: ({ input }: any) => {
    const alive = getAlivePlayerIds(input.roster);
    return {
      promptType: 'HOT_TAKE' as const,
      promptText: input.promptText,
      phase: PromptPhases.ACTIVE,
      eligibleVoters: alive,
      stances: {},
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
        [ActivityEvents.HOTTAKE.RESPOND]: [
          {
            guard: ({ context, event }: any) => {
              const senderId = event.senderId;
              if (!senderId || senderId in context.stances) return false;
              if (!context.eligibleVoters.includes(senderId)) return false;
              return context.eligibleVoters.every(
                (id: string) => id === senderId || id in context.stances
              );
            },
            actions: ['recordStance', 'calculateResults'],
            target: 'completed',
          },
          { actions: 'recordStance' },
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
