/**
 * SPOTLIGHT Dilemma
 *
 * Blind near-unanimous pick — each player names another player.
 *
 * Decision: { targetId: string } (must be another alive player, not self)
 *
 * "Nearly unanimous" — if all submitted picks match AND at most 1 eligible
 * player didn't submit, target gets unanimousReward (20 silver).
 * No participation silver — only the unanimous bonus matters.
 */
import { Config, PlayerStatuses } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { createDilemmaMachine, type DilemmaContext } from './dilemma-machine';
import type { DilemmaResults } from './_contract';

export interface SpotlightDecision {
  targetId: string;
}

function validateDecision(
  decision: SpotlightDecision,
  senderId: string,
  context: DilemmaContext<SpotlightDecision>,
): boolean {
  if (!decision.targetId) return false;
  // Can't pick yourself
  if (decision.targetId === senderId) return false;
  // Target must be an alive player in the roster
  const target = context.roster[decision.targetId];
  if (!target || target.status !== PlayerStatuses.ALIVE) return false;
  return true;
}

function calculateResults(
  decisions: Record<string, SpotlightDecision>,
  _roster: Record<string, SocialPlayer>,
  _dayIndex: number,
  eligiblePlayers: string[],
): DilemmaResults {
  const playerIds = Object.keys(decisions);
  const submitted = playerIds.length;
  const eligible = eligiblePlayers.length;
  const silverRewards: Record<string, number> = {};

  if (submitted === 0) {
    return { silverRewards, summary: { unanimous: false, targetId: null } };
  }

  // "Nearly unanimous" — all submitted picks are the same,
  // and at most 1 eligible player didn't submit
  const targets = playerIds.map((pid) => decisions[pid].targetId);
  const allSame = targets.every((t) => t === targets[0]);
  const nearUnanimous = allSame && submitted > 0 && submitted >= eligible - 1;

  if (nearUnanimous) {
    const targetId = targets[0];
    silverRewards[targetId] = Config.dilemma.spotlight.unanimousReward;
    return {
      silverRewards,
      summary: { unanimous: true, targetId },
    };
  }

  return {
    silverRewards,
    summary: { unanimous: false, targetId: null },
  };
}

export const spotlightMachine = createDilemmaMachine<SpotlightDecision>({
  dilemmaType: 'SPOTLIGHT',
  validateDecision,
  calculateResults,
});
