/**
 * Simon Says Machine
 *
 * Spatial memory minigame. 4 colored quadrants flash a pattern.
 * Player repeats it. Sequence grows each round.
 */
import { createArcadeMachine } from './arcade-machine';

const TIME_LIMIT_MS = 180_000;
const MAX_SILVER = 15;

export const simonSaysMachine = createArcadeMachine({
  gameType: 'SIMON_SAYS',
  defaultTimeLimit: TIME_LIMIT_MS,
  computeRewards: (result) => {
    const rounds = result.roundsCompleted || 0;
    const silver = Math.min(MAX_SILVER, rounds * 2);
    const gold = Math.floor(rounds / 3);
    return { silver, gold };
  },
});
