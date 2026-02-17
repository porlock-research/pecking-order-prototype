/**
 * Blind Auction
 *
 * Three mystery prize slots. Players pick a slot and bid silver.
 * Highest bidder per slot wins the prize. Sole bidders pay nothing.
 * Silver spent becomes gold contribution.
 */
import { Config } from '@pecking-order/shared-types';
import { createSyncDecisionMachine, type SyncDecisionResult } from './sync-decision-machine';
import { getAlivePlayerIds } from '../helpers/alive-players';

interface AuctionDecision {
  slot: number;   // 1, 2, or 3
  amount: number;  // bid amount
}

export interface AuctionPrize {
  type: 'SILVER' | 'SHIELD' | 'CURSE_NO_DM' | 'CURSE_HALF_VOTE';
  label: string;
  value: number; // silver amount for SILVER type, 0 for others
}

const PRIZE_POOL: AuctionPrize[] = [
  ...Config.game.blindAuction.prizePool.map((v) => ({
    type: 'SILVER' as const, label: `+${v} silver`, value: v,
  })),
  { type: 'SHIELD', label: 'Shield', value: 0 },
  { type: 'CURSE_NO_DM', label: 'Curse: No DMs', value: 0 },
  { type: 'CURSE_HALF_VOTE', label: 'Curse: Half Vote', value: 0 },
];

function generatePrizes(dayIndex: number): AuctionPrize[] {
  // Deterministic shuffle seeded by dayIndex
  const shuffled = [...PRIZE_POOL];
  let seed = dayIndex * 2654435761;
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Config.game.blindAuction.prizeSlots);
}

export const blindAuctionMachine = createSyncDecisionMachine<AuctionDecision>({
  gameType: 'BLIND_AUCTION',

  getEligiblePlayers: (roster) => getAlivePlayerIds(roster),

  validateDecision: (decision, playerId, context) => {
    const silver = context.roster[playerId]?.silver ?? 0;
    return (
      typeof decision.slot === 'number' &&
      decision.slot >= 1 && decision.slot <= Config.game.blindAuction.prizeSlots &&
      typeof decision.amount === 'number' &&
      Number.isInteger(decision.amount) &&
      decision.amount >= 0 &&
      decision.amount <= silver
    );
  },

  initExtra: (_roster, dayIndex) => ({
    prizes: generatePrizes(dayIndex),
  }),

  calculateResults: (decisions, context): SyncDecisionResult => {
    const prizes: AuctionPrize[] = context.prizes;
    const silverRewards: Record<string, number> = {};
    for (const pid of context.eligiblePlayers) {
      silverRewards[pid] = 0;
    }

    // Group bids by slot
    const numSlots = Config.game.blindAuction.prizeSlots;
    const slotBids: Record<number, { pid: string; amount: number }[]> = {};
    const slotWinners: Record<number, string | null> = {};
    for (let s = 1; s <= numSlots; s++) { slotBids[s] = []; slotWinners[s] = null; }
    for (const [pid, d] of Object.entries(decisions)) {
      if (slotBids[d.slot]) {
        slotBids[d.slot].push({ pid, amount: d.amount });
      }
    }

    let totalSilverSpent = 0;

    for (let slot = 1; slot <= numSlots; slot++) {
      const bids = slotBids[slot].sort((a, b) => b.amount - a.amount);
      if (bids.length === 0) continue;

      const winner = bids[0];
      slotWinners[slot] = winner.pid;

      if (bids.length === 1) {
        // Sole bidder: wins for free
        // No silver spent
      } else {
        // Multiple bidders: highest pays their bid
        silverRewards[winner.pid] -= winner.amount;
        totalSilverSpent += winner.amount;
      }

      // Award prize to winner
      const prize = prizes[slot - 1];
      if (prize.type === 'SILVER') {
        silverRewards[winner.pid] += prize.value;
      }
      // SHIELD and CURSE effects are tracked in summary for L2/L3 to handle
    }

    // Clamp: no player goes below 0 silver
    for (const [pid, reward] of Object.entries(silverRewards)) {
      const currentSilver = context.roster[pid]?.silver ?? 0;
      if (currentSilver + reward < 0) {
        silverRewards[pid] = -currentSilver;
      }
    }

    // Determine shield winner from prizes
    let shieldWinnerId: string | null = null;
    for (let slot = 1; slot <= numSlots; slot++) {
      if (prizes[slot - 1].type === 'SHIELD' && slotWinners[slot]) {
        shieldWinnerId = slotWinners[slot];
      }
    }

    const bids: Record<string, { slot: number; amount: number }> = {};
    for (const [pid, d] of Object.entries(decisions)) {
      bids[pid] = { slot: d.slot, amount: d.amount };
    }

    return {
      silverRewards,
      goldContribution: totalSilverSpent,
      shieldWinnerId,
      summary: {
        prizes,
        bids,
        slotWinners,
        silverSpent: totalSilverSpent,
      },
    };
  },
});
