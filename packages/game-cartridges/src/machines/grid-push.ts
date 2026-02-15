/**
 * Grid Push Machine
 *
 * Push-your-luck tile-flipping minigame. 10x10 grid with 20 hidden bombs.
 * Player flips tiles to build runs, banks to lock in points. Uses the
 * generic arcade machine factory.
 */
import { createArcadeMachine } from './arcade-machine';

const TIME_LIMIT_MS = 180_000; // 3 minutes
const MAX_SILVER = 15;

export const gridPushMachine = createArcadeMachine({
  gameType: 'GRID_PUSH',
  defaultTimeLimit: TIME_LIMIT_MS,
  computeRewards: (result) => {
    const bankedTotal = result.bankedTotal || 0;
    const silver = Math.min(MAX_SILVER, Math.floor(bankedTotal / 5));
    const gold = Math.floor(bankedTotal / 25);
    return { silver, gold };
  },
});
