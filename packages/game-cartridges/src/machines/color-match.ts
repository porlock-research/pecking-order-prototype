/**
 * Color Match Machine (Stroop Effect)
 *
 * Processing speed minigame. Word says one color, painted another.
 * Player taps the ink color, not the word. Score = correct answers.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, correctPerGold } = Config.game.colorMatch;

export const colorMatchMachine = createArcadeMachine({
  gameType: 'COLOR_MATCH',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const correct = result.correctAnswers || 0;
    const silver = Math.min(Config.game.arcade.maxSilver, correct);
    const gold = Math.floor(correct / correctPerGold);
    return { silver, gold };
  },
});
