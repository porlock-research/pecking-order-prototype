/**
 * Sequence Machine
 *
 * Memory minigame. Player is shown a sequence of numbers, then asked to
 * recall specific positions. Sequence length increases each round.
 * Uses the generic arcade machine factory.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, silverPerRound, roundsPerGold } = Config.game.sequence;

export const sequenceMachine = createArcadeMachine({
  gameType: 'SEQUENCE',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const correctRounds = result.correctRounds || 0;
    const silver = Math.min(Config.game.arcade.maxSilver, correctRounds * silverPerRound);
    const gold = Math.floor(correctRounds / roundsPerGold);
    return { silver, gold };
  },
});
