/**
 * Sync Decision Machine Factory
 *
 * Generic lifecycle machine for synchronous, all-players-at-once decision games.
 * All players submit a decision simultaneously, then results are revealed.
 *
 * Pattern: COLLECTING -> (INTERNAL.END_GAME) -> REVEAL (final)
 *
 * Usage:
 *   const myGame = createSyncDecisionMachine({
 *     gameType: 'MY_GAME',
 *     getEligiblePlayers: (roster) => getAlivePlayerIds(roster),
 *     calculateResults: (decisions, ctx) => ({ silverRewards: {}, goldContribution: 0, summary: {} }),
 *   });
 */
import { setup, assign, sendParent, enqueueActions, type AnyEventObject } from 'xstate';
import type { GameCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import type { GameEvent, GameOutput } from '../contracts';
import { getAlivePlayerIds } from '../helpers/alive-players';

// --- Config ---

export interface SyncDecisionConfig<TDecision = Record<string, any>> {
  gameType: string;
  /** Which players can submit decisions */
  getEligiblePlayers: (roster: Record<string, SocialPlayer>, dayIndex: number) => string[];
  /** Validate a player's decision before storing */
  validateDecision?: (
    decision: TDecision,
    playerId: string,
    context: SyncDecisionContext,
  ) => boolean;
  /** Compute final results from all collected decisions */
  calculateResults: (
    decisions: Record<string, TDecision>,
    context: SyncDecisionContext,
  ) => SyncDecisionResult;
  /** Extra initial context (e.g. vault amount for KINGS_RANSOM) */
  initExtra?: (roster: Record<string, SocialPlayer>, dayIndex: number) => Record<string, any>;
}

// --- Context ---

export interface SyncDecisionContext {
  gameType: string;
  phase: 'COLLECTING' | 'REVEAL';
  eligiblePlayers: string[];
  decisions: Record<string, any>;
  submitted: Record<string, boolean>;
  results: SyncDecisionResult | null;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  [key: string]: any;
}

// --- Result ---

export interface SyncDecisionResult {
  silverRewards: Record<string, number>;
  goldContribution: number;
  shieldWinnerId?: string | null;
  summary: Record<string, any>;
}

// --- Factory ---

export function createSyncDecisionMachine<TDecision = Record<string, any>>(
  config: SyncDecisionConfig<TDecision>,
) {
  const { gameType, getEligiblePlayers, validateDecision, calculateResults, initExtra } = config;
  const SUBMIT_EVENT = `GAME.${gameType}.SUBMIT`;

  return setup({
    types: {
      context: {} as SyncDecisionContext,
      events: {} as GameEvent,
      input: {} as GameCartridgeInput,
      output: {} as GameOutput,
    },
    guards: {
      isSubmitEvent: ({ event }: any) => event.type === SUBMIT_EVENT,
    } as any,
    actions: {
      validateAndStore: enqueueActions(({ enqueue, context, event }: any) => {
        const senderId = event.senderId as string;

        // Reject if not eligible
        if (!context.eligiblePlayers.includes(senderId)) return;

        // Reject if already submitted
        if (context.submitted[senderId]) return;

        // Extract decision payload (everything except type/senderId)
        const { type: _t, senderId: _s, ...decision } = event;

        // Validate if validator provided
        if (validateDecision && !validateDecision(decision as TDecision, senderId, context)) return;

        enqueue.assign({
          decisions: { ...context.decisions, [senderId]: decision },
          submitted: { ...context.submitted, [senderId]: true },
        });

        // Check if all eligible players have submitted
        const allSubmitted = context.eligiblePlayers.every((pid: string) =>
          pid === senderId ? true : context.submitted[pid],
        );
        if (allSubmitted) {
          enqueue.raise({ type: 'ALL_SUBMITTED' } as any);
        }
      }),

      emitDecisionFact: sendParent(({ event }: any): AnyEventObject => ({
        type: 'FACT.RECORD',
        fact: {
          type: 'GAME_DECISION' as any,
          actorId: event.senderId,
          payload: { gameType },
          timestamp: Date.now(),
        },
      })),

      computeResults: assign(({ context }: any) => {
        const results = calculateResults(
          context.decisions as Record<string, TDecision>,
          context,
        );
        return { results, phase: 'REVEAL' as const };
      }),

      reportResults: sendParent(({ context }: any): AnyEventObject => ({
        type: 'FACT.RECORD',
        fact: {
          type: 'GAME_RESULT' as any,
          actorId: 'SYSTEM',
          payload: {
            gameType,
            goldContribution: context.results?.goldContribution ?? 0,
            silverRewards: context.results?.silverRewards ?? {},
            summary: context.results?.summary ?? {},
          },
          timestamp: Date.now(),
        },
      })),

      emitSync: sendParent((): AnyEventObject => ({
        type: 'FACT.RECORD',
        fact: {
          type: 'GAME_ROUND' as any,
          actorId: 'SYSTEM',
          payload: {},
          timestamp: Date.now(),
        },
      })),

      emitAllSubmitted: sendParent((): AnyEventObject => ({
        type: 'FACT.RECORD',
        fact: {
          type: 'ALL_SUBMITTED' as any,
          actorId: 'SYSTEM',
          payload: { gameType },
          timestamp: Date.now(),
        },
      })),
    } as any,
  }).createMachine({
    id: `${gameType.toLowerCase().replace(/_/g, '-')}-game`,
    context: ({ input }: any) => {
      const eligible = getEligiblePlayers(input.roster, input.dayIndex);
      const submitted: Record<string, boolean> = {};
      for (const pid of eligible) {
        submitted[pid] = false;
      }

      const extra = initExtra ? initExtra(input.roster, input.dayIndex) : {};

      return {
        gameType,
        phase: 'COLLECTING' as const,
        eligiblePlayers: eligible,
        decisions: {},
        submitted,
        results: null,
        roster: input.roster,
        dayIndex: input.dayIndex,
        ...extra,
      };
    },
    initial: 'active',
    output: ({ context }: any) => ({
      gameType: context.gameType,
      silverRewards: context.results?.silverRewards ?? {},
      goldContribution: context.results?.goldContribution ?? 0,
      summary: context.results?.summary ?? {},
    }),
    states: {
      active: {
        entry: 'emitSync',
        on: {
          '*': [
            { guard: 'isSubmitEvent', actions: ['validateAndStore', 'emitDecisionFact'] },
          ],
          'ALL_SUBMITTED': {
            actions: 'emitAllSubmitted',
          },
          'INTERNAL.END_GAME': { target: 'completed' },
        },
      },
      completed: {
        entry: ['computeResults', 'emitSync'],
        type: 'final',
      },
    },
  } as any);
}
