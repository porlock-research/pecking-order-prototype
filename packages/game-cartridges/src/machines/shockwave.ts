/**
 * Shockwave Machine
 *
 * Neon survival — dodge contracting ring hazards. Uses the generic arcade machine
 * factory — only defines game-specific reward logic.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, nearMissBonus, scorePerGold } = Config.game.shockwave;

export const shockwaveMachine = createArcadeMachine({
  gameType: 'SHOCKWAVE',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const wavesCleared = result.wavesCleared || 0;
    const nearMisses = result.nearMisses || 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(wavesCleared / scorePerSilver) + Math.floor(nearMisses / nearMissBonus),
    );
    return {
      silver,
      gold: Math.floor(wavesCleared / scorePerGold),
    };
  },
});
