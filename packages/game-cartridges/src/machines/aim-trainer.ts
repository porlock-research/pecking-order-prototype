/**
 * Aim Trainer Machine
 *
 * Precision minigame. Circles appear at random positions and shrink.
 * Tap before they vanish — smaller when tapped = more points.
 */
import { createArcadeMachine } from './arcade-machine';

const TIME_LIMIT_MS = 60_000;
const MAX_SILVER = 15;

export const aimTrainerMachine = createArcadeMachine({
  gameType: 'AIM_TRAINER',
  defaultTimeLimit: TIME_LIMIT_MS,
  computeRewards: (result) => {
    const score = result.score || 0;
    const silver = Math.min(MAX_SILVER, Math.floor(score / 10));
    const gold = Math.floor(score / 50);
    return { silver, gold };
  },
});
