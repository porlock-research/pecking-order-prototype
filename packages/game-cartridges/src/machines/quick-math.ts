/**
 * Quick Math Machine
 *
 * Speed/logic minigame. Rapid-fire arithmetic problems with 4 choices.
 * Score = correct answers. Difficulty scales operations.
 */
import { createArcadeMachine } from './arcade-machine';

const TIME_LIMIT_MS = 90_000;
const MAX_SILVER = 15;

export const quickMathMachine = createArcadeMachine({
  gameType: 'QUICK_MATH',
  defaultTimeLimit: TIME_LIMIT_MS,
  computeRewards: (result) => {
    const correct = result.correctAnswers || 0;
    const streak = result.streak || 0;
    const silver = Math.min(MAX_SILVER, correct + Math.floor(streak / 3));
    const gold = Math.floor(correct / 4);
    return { silver, gold };
  },
});
