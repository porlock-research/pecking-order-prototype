/**
 * Dilemma Machine Factory
 *
 * Generic lifecycle for dilemma cartridges. All eligible players submit
 * a decision; once all have submitted (or INTERNAL.END_DILEMMA fires),
 * results are calculated and the machine reaches its final state.
 *
 * Pattern: collecting -> completed (final)
 */
import { setup, assign, sendParent, type AnyEventObject } from 'xstate';
import { Events, FactTypes, DilemmaPhases, PlayerStatuses } from '@pecking-order/shared-types';
import type { DilemmaCartridgeInput, DilemmaOutput, DilemmaType, SocialPlayer } from '@pecking-order/shared-types';
import type { DilemmaEvent, DilemmaResults } from './_contract';

// --- Config ---

export interface DilemmaConfig<TDecision> {
  dilemmaType: DilemmaType;
  validateDecision: (decision: TDecision, senderId: string, context: DilemmaContext<TDecision>) => boolean;
  calculateResults: (
    decisions: Record<string, TDecision>,
    roster: Record<string, SocialPlayer>,
    dayIndex: number,
    eligiblePlayers: string[],
  ) => DilemmaResults;
}

// --- Context ---

export interface DilemmaContext<TDecision = Record<string, any>> {
  dilemmaType: DilemmaType;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  eligiblePlayers: string[];
  decisions: Record<string, TDecision>;
  phase: string;
  results: DilemmaResults | null;
}

// --- Factory ---

export function createDilemmaMachine<TDecision>(config: DilemmaConfig<TDecision>) {
  const { dilemmaType, validateDecision, calculateResults } = config;
  const SUBMIT_EVENT = Events.Dilemma.submit(dilemmaType);

  return setup({
    types: {
      context: {} as DilemmaContext<TDecision>,
      events: {} as DilemmaEvent,
      input: {} as DilemmaCartridgeInput,
      output: {} as DilemmaOutput,
    },
    guards: {
      allSubmitted: ({ context }: any) =>
        context.eligiblePlayers.every((pid: string) => pid in context.decisions),
    },
    actions: {
      recordDecision: assign(({ context, event }: any) => {
        const senderId = event.senderId as string;
        if (!context.eligiblePlayers.includes(senderId)) return {};
        if (senderId in context.decisions) return {};
        const { type: _, senderId: _s, ...decision } = event;
        if (!validateDecision(decision as TDecision, senderId, context)) return {};
        return { decisions: { ...context.decisions, [senderId]: decision as TDecision } };
      }),
      finalizeResults: assign(({ context }: any) => {
        const results = calculateResults(context.decisions, context.roster, context.dayIndex, context.eligiblePlayers);
        return { results, phase: DilemmaPhases.REVEAL };
      }),
      finalizeTimeout: assign(({ context }: any) => {
        const results = calculateResults(context.decisions, context.roster, context.dayIndex, context.eligiblePlayers);
        return {
          results: {
            ...results,
            summary: { ...results.summary, timedOut: true, submitted: Object.keys(context.decisions).length, eligible: context.eligiblePlayers.length },
          },
          phase: DilemmaPhases.REVEAL,
        };
      }),
      emitResultFact: sendParent(({ context }: any): AnyEventObject => ({
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.DILEMMA_RESULT as any,
          actorId: 'SYSTEM',
          payload: {
            dilemmaType: context.dilemmaType,
            decisions: context.decisions,
            results: context.results,
          },
          timestamp: Date.now(),
        },
      })),
    },
  }).createMachine({
    id: `${dilemmaType.toLowerCase().replace(/_/g, '-')}-dilemma`,
    context: ({ input }: any) => {
      const eligible = Object.entries(input.roster)
        .filter(([, p]: any) => p.status === PlayerStatuses.ALIVE)
        .map(([id]) => id);
      return {
        dilemmaType: input.dilemmaType,
        roster: input.roster,
        dayIndex: input.dayIndex,
        eligiblePlayers: eligible,
        decisions: {} as Record<string, TDecision>,
        phase: DilemmaPhases.COLLECTING,
        results: null,
      };
    },
    initial: 'collecting',
    output: ({ context }: any) => ({
      dilemmaType: context.dilemmaType,
      silverRewards: context.results?.silverRewards ?? {},
      summary: context.results?.summary ?? {},
    }),
    states: {
      collecting: {
        on: {
          [SUBMIT_EVENT]: [
            {
              guard: ({ context, event }: any) => {
                // Check if this submission would complete collection
                const senderId = event.senderId;
                if (!senderId || senderId in context.decisions) return false;
                if (!context.eligiblePlayers.includes(senderId)) return false;
                const wouldBeComplete = context.eligiblePlayers.every(
                  (id: string) => id === senderId || id in context.decisions,
                );
                return wouldBeComplete;
              },
              actions: 'recordDecision',
              target: 'completed',
            },
            {
              actions: 'recordDecision',
            },
          ],
          'INTERNAL.END_DILEMMA': {
            target: 'timedOut',
          },
        },
      },
      completed: {
        entry: ['finalizeResults'],
        type: 'final',
      },
      timedOut: {
        entry: ['finalizeTimeout'],
        type: 'final',
      },
    },
  } as any);
}
