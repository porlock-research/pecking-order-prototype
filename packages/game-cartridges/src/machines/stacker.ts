/**
 * Stacker Machine
 *
 * Timing/skill minigame. Blocks slide back and forth, tap to drop.
 * Overhang is trimmed. Stack as high as possible. Speed increases.
 */
import { createArcadeMachine } from './arcade-machine';

const TIME_LIMIT_MS = 120_000;
const MAX_SILVER = 15;

export const stackerMachine = createArcadeMachine({
  gameType: 'STACKER',
  defaultTimeLimit: TIME_LIMIT_MS,
  computeRewards: (result) => {
    const height = result.height || 0;
    const perfectLayers = result.perfectLayers || 0;
    const silver = Math.min(MAX_SILVER, height);
    const gold = Math.floor(perfectLayers / 3);
    return { silver, gold };
  },
});
