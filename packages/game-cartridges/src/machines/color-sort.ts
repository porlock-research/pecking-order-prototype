/**
 * Color Sort Machine
 *
 * Tube-and-ball puzzle. Sort balls by color into matching tubes.
 * Award silver per sorted tube + bonus for full solve.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, solvedBonus, scorePerGold } = Config.game.colorSort;

export const colorSortMachine = createArcadeMachine({
  gameType: 'COLOR_SORT',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const solved = result.solved || 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver) + (solved ? solvedBonus : 0),
    );
    return {
      silver,
      gold: Math.floor(score / scorePerGold),
    };
  },
});
