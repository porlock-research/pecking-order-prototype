import { majorityMachine } from './majority-machine';
import { executionerMachine } from './executioner-machine';

export const VOTE_REGISTRY = {
  MAJORITY: majorityMachine,
  EXECUTIONER: executionerMachine,
  // Future: BUBBLE, SECOND_TO_LAST, PODIUM_SACRIFICE, SHIELD, TRUST_PAIRS, DUELS
} as const;
