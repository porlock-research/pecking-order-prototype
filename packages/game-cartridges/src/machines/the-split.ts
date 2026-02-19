/**
 * The Split — Round-Robin Prisoner's Dilemma
 *
 * Every pair of alive players faces off once. Each round, two players secretly
 * choose SPLIT or STEAL:
 *   - Both SPLIT → share the pot evenly
 *   - One STEAL → stealer takes all
 *   - Both STEAL → pot goes to gold pool (neither gets silver)
 *
 * Pot per round: basePot + potIncrement * roundIndex
 * Final: highest cumulative total gets bonus silver; most steals gets shield.
 */
import { Config } from '@pecking-order/shared-types';
import { createSyncDecisionMachine, type SyncDecisionContext, type SyncDecisionResult, type RoundResult } from './sync-decision-machine';
import { getAlivePlayerIds } from '../helpers/alive-players';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface SplitDecision {
  action: 'SPLIT' | 'STEAL';
}

/**
 * Generate all unique pairings from playerIds with deterministic shuffle.
 * Uses Fisher-Yates with a simple seeded PRNG for reproducibility.
 */
function generatePairings(playerIds: string[], seed: number): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      pairs.push([playerIds[i], playerIds[j]]);
    }
  }

  // Seeded shuffle (mulberry32)
  let s = seed | 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }

  return pairs;
}

export const theSplitMachine = createSyncDecisionMachine<SplitDecision>({
  gameType: 'THE_SPLIT',

  getEligiblePlayers: (roster) => getAlivePlayerIds(roster),

  validateDecision: (decision) => {
    return decision.action === 'SPLIT' || decision.action === 'STEAL';
  },

  initExtra: (roster, dayIndex) => {
    const alive = getAlivePlayerIds(roster);
    const pairings = generatePairings(alive, dayIndex * 7919 + 31);
    return {
      pairings,
      runningTotals: Object.fromEntries(alive.map((id) => [id, 0])),
      stealCounts: Object.fromEntries(alive.map((id) => [id, 0])),
    };
  },

  rounds: {
    totalRounds: (roster) => {
      const n = getAlivePlayerIds(roster).length;
      return (n * (n - 1)) / 2;
    },

    revealDurationMs: Config.game.theSplit.revealDurationMs,

    getEligiblePlayersForRound: (ctx, roundIndex) => {
      return ctx.pairings[roundIndex] ?? [];
    },

    initRound: (ctx, roundIndex) => ({
      currentPairing: ctx.pairings[roundIndex] ?? [],
      potAmount: Config.game.theSplit.basePot + Config.game.theSplit.potIncrement * roundIndex,
    }),

    calculateRoundResults: (
      decisions: Record<string, SplitDecision>,
      ctx: SyncDecisionContext,
      roundIndex: number,
    ): RoundResult => {
      const pairing = ctx.pairings[roundIndex] as [string, string];
      const [playerA, playerB] = pairing;
      const potAmount = Config.game.theSplit.basePot + Config.game.theSplit.potIncrement * roundIndex;

      const actionA = decisions[playerA]?.action ?? 'SPLIT';
      const actionB = decisions[playerB]?.action ?? 'SPLIT';

      const silverRewards: Record<string, number> = {};
      let goldContribution = 0;
      let outcome: 'BOTH_SPLIT' | 'A_STEALS' | 'B_STEALS' | 'BOTH_STEAL';

      if (actionA === 'SPLIT' && actionB === 'SPLIT') {
        outcome = 'BOTH_SPLIT';
        const half = Math.floor(potAmount / 2);
        silverRewards[playerA] = half;
        silverRewards[playerB] = half;
      } else if (actionA === 'STEAL' && actionB === 'SPLIT') {
        outcome = 'A_STEALS';
        silverRewards[playerA] = potAmount;
        silverRewards[playerB] = 0;
      } else if (actionA === 'SPLIT' && actionB === 'STEAL') {
        outcome = 'B_STEALS';
        silverRewards[playerA] = 0;
        silverRewards[playerB] = potAmount;
      } else {
        outcome = 'BOTH_STEAL';
        silverRewards[playerA] = 0;
        silverRewards[playerB] = 0;
        goldContribution = potAmount;
      }

      // Update running totals in context (will be picked up via initRound passthrough)
      // Note: we return in summary so advanceRound can read from roundResults
      const newRunningTotals = { ...ctx.runningTotals };
      newRunningTotals[playerA] = (newRunningTotals[playerA] ?? 0) + (silverRewards[playerA] ?? 0);
      newRunningTotals[playerB] = (newRunningTotals[playerB] ?? 0) + (silverRewards[playerB] ?? 0);

      const newStealCounts = { ...ctx.stealCounts };
      if (actionA === 'STEAL') newStealCounts[playerA] = (newStealCounts[playerA] ?? 0) + 1;
      if (actionB === 'STEAL') newStealCounts[playerB] = (newStealCounts[playerB] ?? 0) + 1;

      // Propagate running totals through context via round extra
      // We abuse the summary to carry state — initRound reads from roundResults
      ctx.runningTotals = newRunningTotals;
      ctx.stealCounts = newStealCounts;

      return {
        silverRewards,
        goldContribution,
        summary: {
          pairing,
          potAmount,
          actionA,
          actionB,
          outcome,
          runningTotals: newRunningTotals,
          stealCounts: newStealCounts,
        },
      };
    },

    calculateFinalResults: (
      roundResults: RoundResult[],
      ctx: SyncDecisionContext,
    ): SyncDecisionResult => {
      const alive = getAlivePlayerIds(ctx.roster);

      // Aggregate silver from all rounds
      const silverRewards: Record<string, number> = {};
      for (const pid of alive) {
        silverRewards[pid] = 0;
      }
      for (const rr of roundResults) {
        for (const [pid, amount] of Object.entries(rr.silverRewards)) {
          silverRewards[pid] = (silverRewards[pid] ?? 0) + amount;
        }
      }

      // Total gold from BOTH_STEAL rounds
      const goldContribution = roundResults.reduce((sum, rr) => sum + rr.goldContribution, 0);

      // Winner bonus: highest silver total gets bonus
      let winnerId: string | null = null;
      let maxSilver = -1;
      for (const [pid, total] of Object.entries(silverRewards)) {
        if (total > maxSilver) {
          maxSilver = total;
          winnerId = pid;
        }
      }
      if (winnerId && maxSilver > 0) {
        silverRewards[winnerId] += Config.game.theSplit.winnerBonus;
      }

      // Shield: most steals (tiebreak: lowest silver total)
      const stealCounts = ctx.stealCounts as Record<string, number>;
      let shieldWinnerId: string | null = null;
      let maxSteals = 0;
      for (const [pid, count] of Object.entries(stealCounts)) {
        if (count > maxSteals) {
          maxSteals = count;
          shieldWinnerId = pid;
        } else if (count === maxSteals && shieldWinnerId) {
          // Tiebreak: lower silver total wins shield
          if ((silverRewards[pid] ?? 0) < (silverRewards[shieldWinnerId] ?? 0)) {
            shieldWinnerId = pid;
          }
        }
      }
      // Only award shield if at least 1 steal
      if (maxSteals === 0) shieldWinnerId = null;

      return {
        silverRewards,
        goldContribution,
        shieldWinnerId,
        summary: {
          winnerId,
          winnerBonus: winnerId && maxSilver > 0 ? Config.game.theSplit.winnerBonus : 0,
          shieldWinnerId,
          stealCounts,
          runningTotals: silverRewards,
          roundCount: roundResults.length,
        },
      };
    },
  },
});
