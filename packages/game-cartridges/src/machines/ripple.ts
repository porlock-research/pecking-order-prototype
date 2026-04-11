/**
 * Ripple Machine
 *
 * Drop stones, ride the waves — tap to create ripples that hit targets.
 * Converge two ripples for AMPLIFY bonus. Uses the generic arcade machine
 * factory — only defines game-specific reward logic.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, scorePerGold } = Config.game.ripple;

export const rippleMachine = createArcadeMachine({
  gameType: 'RIPPLE',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver),
    );
    return {
      silver,
      gold: Math.floor(score / scorePerGold),
    };
  },
});
