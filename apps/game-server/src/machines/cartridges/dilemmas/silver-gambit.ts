/**
 * SILVER_GAMBIT Dilemma
 *
 * Near-unanimous cooperative donation.
 *
 * Decision: { action: 'DONATE' | 'KEEP' }
 *
 * "Nearly all" — if all submitted are DONATE and at most 1 eligible player
 * didn't submit, a jackpot winner is selected deterministically using
 * (dayIndex + submittedCount) as seed. Winner gets
 * donationCost * submittedCount * jackpotMultiplier.
 *
 * If ANY keep (or too many no-shows): donations are lost. No silver rewarded.
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
  eligiblePlayers: string[],
): DilemmaResults {
  const playerIds = Object.keys(decisions);
  const submitted = playerIds.length;
  const eligible = eligiblePlayers.length;
  const silverRewards: Record<string, number> = {};

  const allDonated = playerIds.every((pid) => decisions[pid].action === 'DONATE');
  // "Nearly all donated" — all submitted are DONATE, and at most 1 no-show
  const nearUniversal = allDonated && submitted > 0 && submitted >= eligible - 1;

  if (nearUniversal) {
    // Jackpot: deterministic winner from submitters only
    const seed = dayIndex + submitted;
    const winnerIndex = seed % submitted;
    const sortedIds = [...playerIds].sort();
    const winnerId = sortedIds[winnerIndex];
    const jackpot = Config.dilemma.silverGambit.donationCost * submitted * Config.dilemma.silverGambit.jackpotMultiplier;
    silverRewards[winnerId] = jackpot;

    return {
      silverRewards,
      summary: {
        allDonated: true,
        winnerId,
        jackpot,
        playerCount: submitted,
      },
    };
  }

  // Not near-unanimous — no silver rewarded
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
      playerCount: submitted,
    },
  };
}

export const silverGambitMachine = createDilemmaMachine<SilverGambitDecision>({
  dilemmaType: 'SILVER_GAMBIT',
  validateDecision,
  calculateResults,
});
