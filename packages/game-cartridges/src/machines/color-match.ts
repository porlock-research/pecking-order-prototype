/**
 * Color Match Machine (Stroop Effect)
 *
 * Processing speed minigame. Word says one color, painted another.
 * Player taps the ink color, not the word. Score = correct answers.
 */
import { createArcadeMachine } from './arcade-machine';

const TIME_LIMIT_MS = 60_000;
const MAX_SILVER = 15;

export const colorMatchMachine = createArcadeMachine({
  gameType: 'COLOR_MATCH',
  defaultTimeLimit: TIME_LIMIT_MS,
  computeRewards: (result) => {
    const correct = result.correctAnswers || 0;
    const silver = Math.min(MAX_SILVER, correct);
    const gold = Math.floor(correct / 5);
    return { silver, gold };
  },
});
