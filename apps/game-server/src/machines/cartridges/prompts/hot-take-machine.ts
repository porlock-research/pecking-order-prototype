/**
 * HOT_TAKE Prompt Machine
 *
 * Statement + N (2–4) mutually-exclusive options. Each player picks one option.
 * Silver: +5 per response, +10 to anyone whose option ties for the minimum
 * non-zero count (when min < max).
 *
 * Legacy bridge: a single release cycle accepts `{stance: 'AGREE'|'DISAGREE'}`
 * payloads when `context.options` equals the legacy fallback `['AGREE','DISAGREE']`.
 */
import { setup, assign, sendParent, type AnyEventObject } from 'xstate';
import {
  Events, FactTypes, PromptPhases, ActivityEvents, Config,
  type PromptCartridgeInput, type SocialPlayer,
} from '@pecking-order/shared-types';
import type { PromptEvent, PromptOutput } from './_contract';
import { getAlivePlayerIds } from '../voting/_helpers';

const SILVER_PER_RESPONSE = Config.prompt.silverParticipation;
const SILVER_MINORITY_BONUS = Config.prompt.silverMinorityBonus;
const LEGACY_OPTIONS: readonly string[] = ['AGREE', 'DISAGREE'] as const;

interface HotTakeContext {
  promptType: 'HOT_TAKE';
  promptText: string;
  promptId?: string;
  options: string[];
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  stances: Record<string, number>;
  results: any;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

function normalizeOptionIndex(
  event: any,
  options: string[],
): number | null {
  if (typeof event.optionIndex === 'number') {
    const i = event.optionIndex;
    if (Number.isInteger(i) && i >= 0 && i < options.length) return i;
    return null;
  }
  // Legacy bridge (one release cycle) — only when options is the legacy default.
  if (
    typeof event.stance === 'string' &&
    options.length === LEGACY_OPTIONS.length &&
    options.every((o, i) => o === LEGACY_OPTIONS[i])
  ) {
    if (event.stance === 'AGREE') return 0;
    if (event.stance === 'DISAGREE') return 1;
  }
  return null;
}

function resolveResults(
  stances: Record<string, number>,
  options: string[],
  statement: string,
  promptId: string | undefined,
) {
  const tally = options.map(() => 0);
  for (const idx of Object.values(stances)) tally[idx]++;

  const nonZero = tally.filter((c) => c > 0);
  const minCount = nonZero.length > 0 ? Math.min(...nonZero) : 0;
  const maxCount = tally.length > 0 ? Math.max(...tally) : 0;
  const hasRealMinority = minCount > 0 && minCount < maxCount;

  const minorityIndices: number[] = hasRealMinority
    ? tally.map((c, i) => (c === minCount ? i : -1)).filter((i) => i >= 0)
    : [];

  const silverRewards: Record<string, number> = {};
  for (const [voterId, idx] of Object.entries(stances)) {
    silverRewards[voterId] = SILVER_PER_RESPONSE;
    if (hasRealMinority && minorityIndices.includes(idx)) {
      silverRewards[voterId] += SILVER_MINORITY_BONUS;
    }
  }

  return {
    statement,
    promptId,
    options,
    tally,
    minorityIndices,
    hasRealMinority,
    silverRewards,
  };
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
    // Runs on entry to `active` — heals legacy hydrated snapshots.
    hydrateLegacyContext: assign(({ context }) => {
      const patch: Partial<HotTakeContext> = {};
      if (!Array.isArray(context.options) || context.options.length === 0) {
        patch.options = [...LEGACY_OPTIONS];
      }
      const firstVal = Object.values(context.stances ?? {})[0] as any;
      if (typeof firstVal === 'string') {
        const migrated: Record<string, number> = {};
        for (const [pid, v] of Object.entries(context.stances)) {
          migrated[pid] = v === ('AGREE' as any) ? 0 : 1;
        }
        patch.stances = migrated;
      }
      return patch;
    }),
    recordStance: assign(({ context, event }) => {
      if (event.type !== ActivityEvents.HOTTAKE.RESPOND) return {};
      const { senderId } = event as any;
      if (!senderId) return {};
      if (!context.eligibleVoters.includes(senderId)) return {};
      if (senderId in context.stances) return {};
      const idx = normalizeOptionIndex(event, context.options);
      if (idx === null) return {};
      return { stances: { ...context.stances, [senderId]: idx } };
    }),
    calculateResults: assign(({ context }) => ({
      phase: PromptPhases.RESULTS,
      results: resolveResults(context.stances, context.options, context.promptText, context.promptId),
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
    const options: string[] =
      Array.isArray(input.options) && input.options.length >= 2
        ? input.options
        : [...LEGACY_OPTIONS];
    return {
      promptType: 'HOT_TAKE' as const,
      promptText: input.promptText,
      promptId: input.promptId,
      options,
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
      entry: 'hydrateLegacyContext',
      on: {
        [ActivityEvents.HOTTAKE.RESPOND]: [
          {
            guard: ({ context, event }: any) => {
              const senderId = event.senderId;
              if (!senderId || senderId in context.stances) return false;
              if (!context.eligibleVoters.includes(senderId)) return false;
              if (normalizeOptionIndex(event, context.options) === null) return false;
              return context.eligibleVoters.every(
                (id: string) => id === senderId || id in context.stances,
              );
            },
            actions: ['recordStance', 'calculateResults'],
            target: 'completed',
          },
          { actions: 'recordStance' },
        ],
        [Events.Internal.END_ACTIVITY]: {
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
