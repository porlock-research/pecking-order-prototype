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

const { timeLimitMs, fullClearGold, maxSize } = Config.game.recall;

// Recall is harder than the average arcade — reward it at 2× the standard
// arcade ceiling. Saturates at 50 correct tiles (clearing through 5×5).
// Full clear adds a gold bonus on top.
const RECALL_MAX_SILVER = Config.game.arcade.maxSilver * 2;
const TILES_FOR_MAX_SILVER = 50;

export const recallMachine = createArcadeMachine({
  gameType: 'RECALL',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const tilesRemembered = result.tilesRemembered || 0;
    const highestSize = result.highestSize || 0;
    const fullClear = result.fullClear || 0;

    let silver = 0;
    if (tilesRemembered > 0) {
      silver = Math.max(
        1,
        Math.ceil((tilesRemembered * RECALL_MAX_SILVER) / TILES_FOR_MAX_SILVER),
      );
    }
    silver = Math.min(RECALL_MAX_SILVER, silver);

    const gold = fullClear || highestSize >= maxSize ? fullClearGold : 0;
    return { silver, gold };
  },
});
