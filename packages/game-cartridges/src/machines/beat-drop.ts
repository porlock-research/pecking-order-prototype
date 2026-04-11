/**
 * Beat Drop Machine
 *
 * Rhythm lane game — hit notes on the beat, build combos. Uses the generic arcade
 * machine factory — only defines game-specific reward logic.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, perfectAccuracyBonus, scorePerGold } = Config.game.beatDrop;

export const beatDropMachine = createArcadeMachine({
  gameType: 'BEAT_DROP',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const accuracyPct = result.accuracyPct || 0;
    const accuracyBonus = accuracyPct === 100 ? perfectAccuracyBonus : 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver) + accuracyBonus,
    );
    return {
      silver,
      gold: Math.floor(score / scorePerGold),
    };
  },
});
