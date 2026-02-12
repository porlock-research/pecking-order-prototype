import { playerPickMachine } from './player-pick-machine';
import { predictionMachine } from './prediction-machine';
import { wyrMachine } from './wyr-machine';
import { hotTakeMachine } from './hot-take-machine';
import { confessionMachine } from './confession-machine';
import { guessWhoMachine } from './guess-who-machine';

export const PROMPT_REGISTRY = {
  PLAYER_PICK: playerPickMachine,
  PREDICTION: predictionMachine,
  WOULD_YOU_RATHER: wyrMachine,
  HOT_TAKE: hotTakeMachine,
  CONFESSION: confessionMachine,
  GUESS_WHO: guessWhoMachine,
} as const;
