/**
 * Stacker Machine
 *
 * Timing/skill minigame. Blocks slide back and forth, tap to drop.
 * Overhang is trimmed. Stack as high as possible. Speed increases.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, layersPerGold } = Config.game.stacker;

export const stackerMachine = createArcadeMachine({
  gameType: 'STACKER',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const height = result.height || 0;
    const perfectLayers = result.perfectLayers || 0;
    const silver = Math.min(Config.game.arcade.maxSilver, height);
    const gold = Math.floor(perfectLayers / layersPerGold);
    return { silver, gold };
  },
});
