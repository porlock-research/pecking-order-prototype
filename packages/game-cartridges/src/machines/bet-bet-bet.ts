/**
 * Bet Bet Bet
 *
 * All alive players secretly bet silver. The 2nd-highest bettor wins the entire
 * pot. The lowest bettor pays double. Any tied amount = all tied players pay 5x.
 * Shield goes to closest-to-median without going over.
 */
import { Config } from '@pecking-order/shared-types';
import { createSyncDecisionMachine, type SyncDecisionResult } from './sync-decision-machine';
import { getAlivePlayerIds } from '../helpers/alive-players';
import { getMedian } from '../helpers/decision-helpers';

interface BetDecision {
  amount: number;
}

export const betBetBetMachine = createSyncDecisionMachine<BetDecision>({
  gameType: 'BET_BET_BET',

  getEligiblePlayers: (roster) => getAlivePlayerIds(roster),

  validateDecision: (decision, playerId, context) => {
    const silver = context.roster[playerId]?.silver ?? 0;
    return (
      typeof decision.amount === 'number' &&
      Number.isInteger(decision.amount) &&
      decision.amount >= 1 &&
      decision.amount <= silver
    );
  },

  calculateResults: (decisions, context): SyncDecisionResult => {
    const entries = Object.entries(decisions);
    if (entries.length === 0) {
      return { silverRewards: {}, goldContribution: 0, summary: { bets: {} } };
    }

    const bets: Record<string, number> = {};
    for (const [pid, d] of entries) {
      bets[pid] = d.amount;
    }

    const silverRewards: Record<string, number> = {};
    for (const pid of context.eligiblePlayers) {
      silverRewards[pid] = 0;
    }

    // Find tied groups (any amount appearing 2+ times)
    const amountCounts: Record<number, string[]> = {};
    for (const [pid, amount] of Object.entries(bets)) {
      if (!amountCounts[amount]) amountCounts[amount] = [];
      amountCounts[amount].push(pid);
    }

    const tiedGroups: Record<number, string[]> = {};
    const tiedPlayerIds = new Set<string>();
    for (const [amount, pids] of Object.entries(amountCounts)) {
      if (pids.length >= 2) {
        tiedGroups[Number(amount)] = pids;
        for (const pid of pids) tiedPlayerIds.add(pid);
      }
    }

    // Tied players pay 5x their bet
    for (const [amountStr, pids] of Object.entries(tiedGroups)) {
      const amount = Number(amountStr);
      for (const pid of pids) {
        const penalty = Math.min(amount * Config.game.betBetBet.tiePenaltyMultiplier, context.roster[pid]?.silver ?? 0);
        silverRewards[pid] = -penalty;
      }
    }

    // Among non-tied players, find rankings
    const nonTiedEntries = Object.entries(bets)
      .filter(([pid]) => !tiedPlayerIds.has(pid))
      .sort((a, b) => b[1] - a[1]); // descending

    let winnerId: string | null = null;
    let lowestBettorId: string | null = null;
    const potTotal = Object.values(bets).reduce((s, v) => s + v, 0);

    if (nonTiedEntries.length >= 2) {
      // 2nd highest wins the pot
      winnerId = nonTiedEntries[1][0];
      // Everyone (non-tied) loses their bet
      for (const [pid] of nonTiedEntries) {
        silverRewards[pid] = -bets[pid];
      }
      // Winner gets pot
      silverRewards[winnerId] = potTotal - bets[winnerId];

      // Lowest bettor pays double (additional penalty beyond losing bet)
      lowestBettorId = nonTiedEntries[nonTiedEntries.length - 1][0];
      if (lowestBettorId !== winnerId) {
        const extraPenalty = Math.min(
          bets[lowestBettorId],
          (context.roster[lowestBettorId]?.silver ?? 0) - bets[lowestBettorId],
        );
        if (extraPenalty > 0) {
          silverRewards[lowestBettorId] -= extraPenalty;
        }
      }
    } else if (nonTiedEntries.length === 1) {
      // Only 1 non-tied player: they win the pot from tied players
      winnerId = nonTiedEntries[0][0];
      silverRewards[winnerId] = potTotal - bets[winnerId];
    }

    // Shield: closest to median without going over
    const allAmounts = Object.values(bets);
    const median = getMedian(allAmounts);
    let shieldWinnerId: string | null = null;
    let closestDiff = Infinity;
    for (const [pid, amount] of Object.entries(bets)) {
      if (amount <= median) {
        const diff = median - amount;
        if (diff < closestDiff) {
          closestDiff = diff;
          shieldWinnerId = pid;
        }
      }
    }

    // Clamp: no player goes below 0 silver
    for (const [pid, reward] of Object.entries(silverRewards)) {
      const currentSilver = context.roster[pid]?.silver ?? 0;
      if (currentSilver + reward < 0) {
        silverRewards[pid] = -currentSilver;
      }
    }

    return {
      silverRewards,
      goldContribution: 0,
      shieldWinnerId,
      summary: {
        bets,
        winnerId,
        lowestBettorId,
        tiedGroups,
        shieldWinnerId,
        potTotal,
        median,
      },
    };
  },
});
