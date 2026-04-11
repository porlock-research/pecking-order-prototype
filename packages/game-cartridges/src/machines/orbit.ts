/**
 * Orbit Machine
 *
 * Cosmic physics/timing — slingshot between gravity wells. Uses the generic arcade
 * machine factory — only defines game-specific reward logic.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, transfersPerSilver, perfectsPerBonusSilver, transfersPerGold } = Config.game.orbit;

export const orbitMachine = createArcadeMachine({
  gameType: 'ORBIT',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const transfers = result.transfers || 0;
    const perfectCaptures = result.perfectCaptures || 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(transfers / transfersPerSilver) + Math.floor(perfectCaptures / perfectsPerBonusSilver),
    );
    return {
      silver,
      gold: Math.floor(transfers / transfersPerGold),
    };
  },
});
