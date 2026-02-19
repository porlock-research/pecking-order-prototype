/**
 * Sync Decision Machine Factory
 *
 * Generic lifecycle machine for synchronous, all-players-at-once decision games.
 * All players submit a decision simultaneously, then results are revealed.
 *
 * Single-round pattern: COLLECTING -> (INTERNAL.END_GAME) -> REVEAL (final)
 * Multi-round pattern:  COLLECTING -> ROUND_REVEAL -> COLLECTING -> ... -> completed (final)
 *
 * Usage (single-round):
 *   const myGame = createSyncDecisionMachine({
 *     gameType: 'MY_GAME',
 *     getEligiblePlayers: (roster) => getAlivePlayerIds(roster),
 *     calculateResults: (decisions, ctx) => ({ silverRewards: {}, goldContribution: 0, summary: {} }),
 *   });
 *
 * Usage (multi-round):
 *   const myGame = createSyncDecisionMachine({
 *     gameType: 'MY_GAME',
 *     getEligiblePlayers: (roster) => getAlivePlayerIds(roster),
 *     rounds: {
 *       totalRounds: 5,
 *       revealDurationMs: 8000,
 *       calculateRoundResults: (decisions, ctx, roundIndex) => ({ silverRewards: {}, goldContribution: 0, summary: {} }),
 *       calculateFinalResults: (roundResults, ctx) => ({ silverRewards: {}, goldContribution: 0, summary: {} }),
 *     },
 *   });
 */
import { setup, assign, sendParent, enqueueActions, type AnyEventObject } from 'xstate';
import type { GameCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';
import { Events, FactTypes, SyncDecisionPhases } from '@pecking-order/shared-types';
import type { GameEvent, GameOutput } from '../contracts';
import { getAlivePlayerIds } from '../helpers/alive-players';

// --- Round Result ---

export interface RoundResult {
  silverRewards: Record<string, number>;
  goldContribution: number;
  summary: Record<string, any>;
}

// --- Multi-Round Config ---

export interface MultiRoundConfig<TDecision> {
  /** Total rounds — number or function of (roster, dayIndex) */
  totalRounds: number | ((roster: Record<string, SocialPlayer>, dayIndex: number) => number);
  /** How long to show round results before advancing */
  revealDurationMs: number;
  /** Compute results for a single round */
  calculateRoundResults: (
    decisions: Record<string, TDecision>,
    context: SyncDecisionContext,
    roundIndex: number,
  ) => RoundResult;
  /** Optional: initialize extra context at the start of each round */
  initRound?: (context: SyncDecisionContext, roundIndex: number) => Record<string, any>;
  /** Compute final aggregate results from all round results */
  calculateFinalResults: (
    roundResults: RoundResult[],
    context: SyncDecisionContext,
  ) => SyncDecisionResult;
  /** Optional: override which players are eligible for a specific round */
  getEligiblePlayersForRound?: (context: SyncDecisionContext, roundIndex: number) => string[];
}

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
  /** Compute final results from all collected decisions (single-round only) */
  calculateResults?: (
    decisions: Record<string, TDecision>,
    context: SyncDecisionContext,
  ) => SyncDecisionResult;
  /** Extra initial context (e.g. vault amount for KINGS_RANSOM) */
  initExtra?: (roster: Record<string, SocialPlayer>, dayIndex: number) => Record<string, any>;
  /** Multi-round configuration (optional — enables multi-round mode) */
  rounds?: MultiRoundConfig<TDecision>;
}

// --- Context ---

export interface SyncDecisionContext {
  gameType: string;
  phase: 'COLLECTING' | 'ROUND_REVEAL' | 'REVEAL';
  eligiblePlayers: string[];
  decisions: Record<string, any>;
  submitted: Record<string, boolean>;
  results: SyncDecisionResult | null;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  // Multi-round fields (always present, defaults for single-round)
  currentRound: number;
  totalRounds: number;
  roundResults: RoundResult[];
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
  const { gameType, getEligiblePlayers, validateDecision, calculateResults, initExtra, rounds } = config;
  const SUBMIT_EVENT = Events.Game.event(gameType, 'SUBMIT');
  const isMultiRound = !!rounds;

  return setup({
    types: {
      context: {} as SyncDecisionContext,
      events: {} as GameEvent,
      input: {} as GameCartridgeInput,
      output: {} as GameOutput,
    },
    guards: {
      isSubmitEvent: ({ event }: any) => event.type === SUBMIT_EVENT,
      isMultiRound: () => isMultiRound,
      hasMoreRounds: ({ context }: any) => context.currentRound + 1 < context.totalRounds,
    } as any,
    delays: {
      ROUND_REVEAL_DELAY: rounds?.revealDurationMs ?? 5000,
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
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.GAME_DECISION as any,
          actorId: event.senderId,
          payload: { gameType },
          timestamp: Date.now(),
        },
      })),

      computeResults: assign(({ context }: any) => {
        let results: SyncDecisionResult;
        if (isMultiRound && rounds) {
          // Multi-round: aggregate from accumulated roundResults
          results = rounds.calculateFinalResults(context.roundResults, context);
        } else if (calculateResults) {
          // Single-round: compute from decisions
          results = calculateResults(
            context.decisions as Record<string, TDecision>,
            context,
          );
        } else {
          results = { silverRewards: {}, goldContribution: 0, summary: {} };
        }
        return { results, phase: SyncDecisionPhases.REVEAL };
      }),

      computeRoundResults: assign(({ context }: any) => {
        if (!rounds) return {};
        const roundResult = rounds.calculateRoundResults(
          context.decisions as Record<string, TDecision>,
          context,
          context.currentRound,
        );
        return {
          roundResults: [...context.roundResults, roundResult],
          phase: SyncDecisionPhases.ROUND_REVEAL,
        };
      }),

      advanceRound: assign(({ context }: any) => {
        if (!rounds) return {};
        const nextRound = context.currentRound + 1;

        // Determine eligible players for the next round
        const eligible = rounds.getEligiblePlayersForRound
          ? rounds.getEligiblePlayersForRound(context, nextRound)
          : context.eligiblePlayers;

        const submitted: Record<string, boolean> = {};
        for (const pid of eligible) {
          submitted[pid] = false;
        }

        // Get any round-specific extra context
        const roundExtra = rounds.initRound ? rounds.initRound(context, nextRound) : {};

        return {
          currentRound: nextRound,
          eligiblePlayers: eligible,
          decisions: {},
          submitted,
          phase: SyncDecisionPhases.COLLECTING,
          ...roundExtra,
        };
      }),

      reportResults: sendParent(({ context }: any): AnyEventObject => ({
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.GAME_RESULT as any,
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
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.GAME_ROUND as any,
          actorId: 'SYSTEM',
          payload: {},
          timestamp: Date.now(),
        },
      })),

      emitAllSubmitted: sendParent((): AnyEventObject => ({
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.ALL_SUBMITTED as any,
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

      // Resolve totalRounds
      let totalRounds = 1;
      if (rounds) {
        totalRounds = typeof rounds.totalRounds === 'function'
          ? rounds.totalRounds(input.roster, input.dayIndex)
          : rounds.totalRounds;
      }

      // For multi-round, allow first-round eligible override + initRound
      let initialEligible = eligible;
      let roundExtra: Record<string, any> = {};
      if (rounds) {
        if (rounds.getEligiblePlayersForRound) {
          initialEligible = rounds.getEligiblePlayersForRound(
            { ...extra, roster: input.roster, dayIndex: input.dayIndex, eligiblePlayers: eligible } as any,
            0,
          );
          // Rebuild submitted for initial eligible
          const initialSubmitted: Record<string, boolean> = {};
          for (const pid of initialEligible) {
            initialSubmitted[pid] = false;
          }
          Object.assign(submitted, initialSubmitted);
          // Clear any old keys
          for (const pid of eligible) {
            if (!initialEligible.includes(pid)) {
              delete submitted[pid];
            }
          }
        }
        if (rounds.initRound) {
          roundExtra = rounds.initRound(
            { ...extra, roster: input.roster, dayIndex: input.dayIndex, eligiblePlayers: initialEligible } as any,
            0,
          );
        }
      }

      return {
        gameType,
        phase: SyncDecisionPhases.COLLECTING,
        eligiblePlayers: initialEligible,
        decisions: {},
        submitted: rounds ? (() => { const s: Record<string, boolean> = {}; for (const pid of initialEligible) { s[pid] = false; } return s; })() : submitted,
        results: null,
        roster: input.roster,
        dayIndex: input.dayIndex,
        currentRound: 0,
        totalRounds,
        roundResults: [],
        ...extra,
        ...roundExtra,
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
          'ALL_SUBMITTED': [
            ...(isMultiRound ? [{ guard: 'isMultiRound' as const, target: 'roundReveal' as const }] : []),
            { actions: 'emitAllSubmitted' as const },
          ],
          'INTERNAL.END_GAME': { target: 'completed' },
        },
      },
      ...(isMultiRound ? {
        roundReveal: {
          entry: ['computeRoundResults', 'emitSync'],
          after: {
            ROUND_REVEAL_DELAY: [
              { guard: 'hasMoreRounds', target: 'active', actions: ['advanceRound', 'emitSync'] },
              { target: 'completed' },
            ],
          },
          on: {
            'INTERNAL.END_GAME': { target: 'completed' },
          },
        },
      } : {}),
      completed: {
        entry: ['computeResults', 'emitSync'],
        type: 'final' as const,
      },
    },
  } as any);
}
