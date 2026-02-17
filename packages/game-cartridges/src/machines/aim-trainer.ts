/**
 * Aim Trainer Machine
 *
 * Precision minigame. Circles appear at random positions and shrink.
 * Tap before they vanish — smaller when tapped = more points.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, scorePerGold } = Config.game.aimTrainer;

export const aimTrainerMachine = createArcadeMachine({
  gameType: 'AIM_TRAINER',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const silver = Math.min(Config.game.arcade.maxSilver, Math.floor(score / scorePerSilver));
    const gold = Math.floor(score / scorePerGold);
    return { silver, gold };
  },
});
