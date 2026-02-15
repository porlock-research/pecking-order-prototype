/**
 * Gap Run Machine
 *
 * Async per-player side-scrolling minigame. Uses the generic arcade machine
 * factory — only defines game-specific reward logic.
 */
import { createArcadeMachine } from './arcade-machine';

const TIME_LIMIT_MS = 45_000;
const MAX_DISTANCE_SILVER = 15;
const SURVIVAL_BONUS = 5;

export const gapRunMachine = createArcadeMachine({
  gameType: 'GAP_RUN',
  defaultTimeLimit: TIME_LIMIT_MS,
  computeRewards: (result, timeElapsed, timeLimit) => {
    const distance = result.distance || 0;
    const distanceSilver = Math.min(MAX_DISTANCE_SILVER, Math.floor(distance / 100));
    const survivalBonus = timeElapsed >= timeLimit - 1000 ? SURVIVAL_BONUS : 0;
    return {
      silver: distanceSilver + survivalBonus,
      gold: Math.floor(distance / 500),
    };
  },
});
