/**
 * SILVER_GAMBIT Dilemma
 *
 * All-or-nothing cooperative donation.
 *
 * Decision: { action: 'DONATE' | 'KEEP' }
 *
 * If ALL donate: a jackpot winner is selected deterministically using
 * (dayIndex + number of decisions) as seed. Winner gets
 * donationCost * playerCount * jackpotMultiplier.
 *
 * If ANY keep: donations are lost. No silver rewarded.
 * No participation silver — only the jackpot matters.
 */
import { Config } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { createDilemmaMachine, type DilemmaContext } from './dilemma-machine';
import type { DilemmaResults } from './_contract';

export interface SilverGambitDecision {
  action: 'DONATE' | 'KEEP';
}

function validateDecision(
  decision: SilverGambitDecision,
  _senderId: string,
  _context: DilemmaContext<SilverGambitDecision>,
): boolean {
  return decision.action === 'DONATE' || decision.action === 'KEEP';
}

function calculateResults(
  decisions: Record<string, SilverGambitDecision>,
  _roster: Record<string, SocialPlayer>,
  dayIndex: number,
): DilemmaResults {
  const playerIds = Object.keys(decisions);
  const playerCount = playerIds.length;
  const silverRewards: Record<string, number> = {};

  const allDonated = playerIds.every((pid) => decisions[pid].action === 'DONATE');

  if (allDonated && playerCount > 0) {
    // Jackpot: deterministic winner selection. Only the winner gets silver.
    const seed = dayIndex + playerCount;
    const winnerIndex = seed % playerCount;
    const sortedIds = [...playerIds].sort();
    const winnerId = sortedIds[winnerIndex];
    const jackpot = Config.dilemma.silverGambit.donationCost * playerCount * Config.dilemma.silverGambit.jackpotMultiplier;
    silverRewards[winnerId] = jackpot;

    return {
      silverRewards,
      summary: {
        allDonated: true,
        winnerId,
        jackpot,
        playerCount,
      },
    };
  }

  // Not all donated — no silver rewarded
  const donors = playerIds.filter((pid) => decisions[pid].action === 'DONATE');
  const keepers = playerIds.filter((pid) => decisions[pid].action === 'KEEP');

  return {
    silverRewards,
    summary: {
      allDonated: false,
      winnerId: null,
      jackpot: 0,
      donorCount: donors.length,
      keeperCount: keepers.length,
      playerCount,
    },
  };
}

export const silverGambitMachine = createDilemmaMachine<SilverGambitDecision>({
  dilemmaType: 'SILVER_GAMBIT',
  validateDecision,
  calculateResults,
});
