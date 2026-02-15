/**
 * Sequence Machine
 *
 * Memory minigame. Player is shown a sequence of numbers, then asked to
 * recall specific positions. Sequence length increases each round.
 * Uses the generic arcade machine factory.
 */
import { createArcadeMachine } from './arcade-machine';

const TIME_LIMIT_MS = 180_000; // 3 minutes
const MAX_SILVER = 15;

export const sequenceMachine = createArcadeMachine({
  gameType: 'SEQUENCE',
  defaultTimeLimit: TIME_LIMIT_MS,
  computeRewards: (result) => {
    const correctRounds = result.correctRounds || 0;
    const silver = Math.min(MAX_SILVER, correctRounds * 2);
    const gold = Math.floor(correctRounds / 3);
    return { silver, gold };
  },
});
