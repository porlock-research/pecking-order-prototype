import type { AnyStateMachine } from 'xstate';
import type { PromptType } from '@pecking-order/shared-types';
import { playerPickMachine } from './player-pick-machine';
import { predictionMachine } from './prediction-machine';
import { wyrMachine } from './wyr-machine';
import { hotTakeMachine } from './hot-take-machine';
import { confessionMachine } from './confession-machine';
import { guessWhoMachine } from './guess-who-machine';

// Typed as Record<PromptType, AnyStateMachine> so the .d.ts emit doesn't need
// to surface each machine's private context type (TS4023).
export const PROMPT_REGISTRY: Record<PromptType, AnyStateMachine> = {
  PLAYER_PICK: playerPickMachine,
  PREDICTION: predictionMachine,
  WOULD_YOU_RATHER: wyrMachine,
  HOT_TAKE: hotTakeMachine,
  CONFESSION: confessionMachine,
  GUESS_WHO: guessWhoMachine,
};
