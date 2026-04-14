/**
 * Blink Machine
 *
 * Go/No-Go reflex + inhibition minigame. Screen flashes between BLACK and WHITE.
 * Tap on BLACK = +1. Tap on WHITE = -3. Survive a 30s tempo-ramping run.
 * Score = max(0, blackTaps - 3 * whiteTaps).
 */
import { Config } from '@pecking-order/shared-types';
import { createArcadeMachine } from './arcade-machine';

const { timeLimitMs, scorePerSilver, scorePerGold } = Config.game.blink;

export const blinkMachine = createArcadeMachine({
  gameType: 'BLINK',
  defaultTimeLimit: timeLimitMs,
  computeRewards: (result) => {
    const score = result.score || 0;
    const silver = Math.min(
      Config.game.arcade.maxSilver,
      Math.floor(score / scorePerSilver),
    );
    const gold = Math.floor(score / scorePerGold);
    return { silver, gold };
  },
});
