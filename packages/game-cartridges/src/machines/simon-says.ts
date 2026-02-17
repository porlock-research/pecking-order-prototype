/**
 * Simon Says Machine
 *
 * Spatial memory minigame. 4 colored quadrants flash a pattern.
 * Player repeats it. Sequence grows each round.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, silverPerRound, roundsPerGold } = Config.game.simonSays;

export const simonSaysMachine = createArcadeMachine({
  gameType: 'SIMON_SAYS',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const rounds = result.roundsCompleted || 0;
    const silver = Math.min(Config.game.arcade.maxSilver, rounds * silverPerRound);
    const gold = Math.floor(rounds / roundsPerGold);
    return { silver, gold };
  },
});
