export { gapRunMachine } from './gap-run';
export { triviaMachine } from './trivia';
export { realtimeTriviaMachine } from './realtime-trivia';

import { gapRunMachine } from './gap-run';
import { triviaMachine } from './trivia';
import { realtimeTriviaMachine } from './realtime-trivia';

export const GAME_REGISTRY = {
  GAP_RUN: gapRunMachine,
  REALTIME_TRIVIA: realtimeTriviaMachine,
  TRIVIA: triviaMachine,
} as const;
