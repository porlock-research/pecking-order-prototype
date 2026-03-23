/**
 * GIFT_OR_GRIEF Dilemma
 *
 * Name a player for good or ill.
 *
 * Decision: { targetId: string } (must be another alive player, not self)
 *
 * Count nominations per player:
 * - Most-nominated gets +giftAmount (gift). If tied, all tied players get the gift.
 * - Least-nominated (with at least 1 nomination) gets -griefAmount (grief).
 *   If tied at bottom, all tied get grief.
 * - Players with 0 nominations are unaffected.
 * No participation silver — only gift/grief from nominations.
 */
import { Config, PlayerStatuses } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { createDilemmaMachine, type DilemmaContext } from './dilemma-machine';
import type { DilemmaResults } from './_contract';

export interface GiftOrGriefDecision {
  targetId: string;
}

function validateDecision(
  decision: GiftOrGriefDecision,
  senderId: string,
  context: DilemmaContext<GiftOrGriefDecision>,
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
  decisions: Record<string, GiftOrGriefDecision>,
  _roster: Record<string, SocialPlayer>,
  _dayIndex: number,
): DilemmaResults {
  const playerIds = Object.keys(decisions);
  const silverRewards: Record<string, number> = {};

  if (playerIds.length === 0) {
    return { silverRewards, summary: { giftedIds: [], grievedIds: [], nominations: {} } };
  }

  // Count nominations per target
  const nominations: Record<string, number> = {};
  for (const pid of playerIds) {
    const targetId = decisions[pid].targetId;
    nominations[targetId] = (nominations[targetId] || 0) + 1;
  }

  // Find nominated players (those with at least 1 nomination)
  const nominatedEntries = Object.entries(nominations);

  if (nominatedEntries.length === 0) {
    return { silverRewards, summary: { giftedIds: [], grievedIds: [], nominations } };
  }

  const maxNominations = Math.max(...nominatedEntries.map(([, c]) => c));
  const minNominations = Math.min(...nominatedEntries.map(([, c]) => c));

  // Most-nominated get the gift
  const giftedIds = nominatedEntries
    .filter(([, c]) => c === maxNominations)
    .map(([id]) => id);

  for (const giftedId of giftedIds) {
    silverRewards[giftedId] = (silverRewards[giftedId] || 0) + Config.dilemma.giftOrGrief.giftAmount;
  }

  // Least-nominated (with at least 1) get grief — but only if different from most
  // If everyone has the same count, they all get the gift but nobody gets grief
  const grievedIds = maxNominations === minNominations
    ? []
    : nominatedEntries
        .filter(([, c]) => c === minNominations)
        .map(([id]) => id);

  for (const grievedId of grievedIds) {
    silverRewards[grievedId] = (silverRewards[grievedId] || 0) - Config.dilemma.giftOrGrief.griefAmount;
  }

  return {
    silverRewards,
    summary: {
      giftedIds,
      grievedIds,
      nominations,
    },
  };
}

export const giftOrGriefMachine = createDilemmaMachine<GiftOrGriefDecision>({
  dilemmaType: 'GIFT_OR_GRIEF',
  validateDecision,
  calculateResults,
});
