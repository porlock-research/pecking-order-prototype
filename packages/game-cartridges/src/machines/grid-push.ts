/**
 * Grid Push Machine
 *
 * Push-your-luck tile-flipping minigame. 10x10 grid with 20 hidden bombs.
 * Player flips tiles to build runs, banks to lock in points. Uses the
 * generic arcade machine factory.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, scorePerGold } = Config.game.gridPush;

export const gridPushMachine = createArcadeMachine({
  gameType: 'GRID_PUSH',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const bankedTotal = result.bankedTotal || 0;
    const silver = Math.min(Config.game.arcade.maxSilver, Math.floor(bankedTotal / scorePerSilver));
    const gold = Math.floor(bankedTotal / scorePerGold);
    return { silver, gold };
  },
});
