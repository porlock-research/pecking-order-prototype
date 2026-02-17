/**
 * Gap Run Machine
 *
 * Async per-player side-scrolling minigame. Uses the generic arcade machine
 * factory — only defines game-specific reward logic.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, maxDistanceSilver, survivalBonus, distancePerSilver, survivalGraceMs, distancePerGold } = Config.game.gapRun;

export const gapRunMachine = createArcadeMachine({
  gameType: 'GAP_RUN',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result, timeElapsed, timeLimit) => {
    const distance = result.distance || 0;
    const distanceSilver = Math.min(maxDistanceSilver, Math.floor(distance / distancePerSilver));
    const bonus = timeElapsed >= timeLimit - survivalGraceMs ? survivalBonus : 0;
    return {
      silver: distanceSilver + bonus,
      gold: Math.floor(distance / distancePerGold),
    };
  },
});
