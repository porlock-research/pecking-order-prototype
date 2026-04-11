import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, geniusBonus, scorePerGold } = Config.game.codebreaker;

export const codebreakerMachine = createArcadeMachine({
  gameType: 'CODEBREAKER',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const bestSolve = result.bestSolve || 99;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver) + (bestSolve <= 2 ? geniusBonus : 0),
    );
    return {
      silver,
      gold: Math.floor(score / scorePerGold),
    };
  },
});
