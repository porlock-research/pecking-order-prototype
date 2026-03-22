/**
 * SPOTLIGHT Dilemma
 *
 * Blind unanimous pick — each player names another player.
 *
 * Decision: { targetId: string } (must be another alive player, not self)
 *
 * If ALL pick the same person: target gets unanimousReward.
 * Everyone who participated gets participationReward.
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
): DilemmaResults {
  const playerIds = Object.keys(decisions);
  const silverRewards: Record<string, number> = {};

  // Everyone who participated gets participation reward
  for (const pid of playerIds) {
    silverRewards[pid] = Config.dilemma.spotlight.participationReward;
  }

  if (playerIds.length === 0) {
    return { silverRewards, summary: { unanimous: false, targetId: null } };
  }

  // Check if all picks are the same
  const targets = playerIds.map((pid) => decisions[pid].targetId);
  const allSame = targets.every((t) => t === targets[0]);

  if (allSame) {
    const targetId = targets[0];
    silverRewards[targetId] = (silverRewards[targetId] || 0) + Config.dilemma.spotlight.unanimousReward;
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
