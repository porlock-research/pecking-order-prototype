/**
 * Inflate Machine
 *
 * Balloon risk — hold to inflate, release to bank. Uses the generic arcade machine
 * factory — only defines game-specific reward logic.
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, perfectBankBonus, scorePerGold } = Config.game.inflate;

export const inflateMachine = createArcadeMachine({
  gameType: 'INFLATE',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const perfectBanks = result.perfectBanks || 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver) + Math.floor(perfectBanks / perfectBankBonus),
    );
    return {
      silver,
      gold: Math.floor(score / scorePerGold),
    };
  },
});
