/**
 * Flappy Machine
 *
 * Variable-flap flappy bird. Hold longer = stronger flap.
 * Phase progression: green pipes → moving pipes → lasers + enemies.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, coinBonus, scorePerGold } = Config.game.flappy;

export const flappyMachine = createArcadeMachine({
  gameType: 'FLAPPY',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const coinsCollected = result.coinsCollected || 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver) + Math.floor(coinsCollected / coinBonus),
    );
    return {
      silver,
      gold: Math.floor(score / scorePerGold),
    };
  },
});
