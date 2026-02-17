/**
 * Quick Math Machine
 *
 * Speed/logic minigame. Rapid-fire arithmetic problems with 4 choices.
 * Score = correct answers. Difficulty scales operations.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, streakPerBonus, correctPerGold } = Config.game.quickMath;

export const quickMathMachine = createArcadeMachine({
  gameType: 'QUICK_MATH',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const correct = result.correctAnswers || 0;
    const streak = result.streak || 0;
    const silver = Math.min(Config.game.arcade.maxSilver, correct + Math.floor(streak / streakPerBonus));
    const gold = Math.floor(correct / correctPerGold);
    return { silver, gold };
  },
});
