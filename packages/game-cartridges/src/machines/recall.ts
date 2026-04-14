/**
 * Recall Machine
 *
 * Chimp-test spatial memory game. Grid of numbered squares (3×3 → 6×6) appears.
 * Player taps "1" to lock in, which dissolves all other numbers. Tap remaining
 * squares in order from memory. Wrong tap ends the run. Clearing all four sizes
 * yields a full-clear gold bonus.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, silverBySize, fullClearGold, maxSize } = Config.game.recall;

export const recallMachine = createArcadeMachine({
  gameType: 'RECALL',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const highestSize = result.highestSize || 0;
    const fullClear = result.fullClear || 0;

    // Cumulative silver for every size completed
    let silver = 0;
    for (let n = 0; n <= highestSize; n++) {
      silver += silverBySize[n] ?? 0;
    }
    silver = Math.min(Config.game.arcade.maxSilver, silver);

    const gold = fullClear ? fullClearGold : (highestSize >= maxSize ? fullClearGold : 0);
    return { silver, gold };
  },
});
