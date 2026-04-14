/**
 * Snake Machine
 *
 * Classic snake on a 15x15 grid. Eat pellets to grow.
 * Avoid walls and tail. Speed ramps as score increases.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, lengthBonus, scorePerGold } = Config.game.snake;

export const snakeMachine = createArcadeMachine({
  gameType: 'SNAKE',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const finalLength = result.finalLength || 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver) + Math.floor(finalLength / lengthBonus),
    );
    return {
      silver,
      gold: Math.floor(score / scorePerGold),
    };
  },
});
