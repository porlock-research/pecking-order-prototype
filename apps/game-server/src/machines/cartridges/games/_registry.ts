import { realtimeTriviaMachine } from './realtime-trivia-machine';
import { triviaMachine } from './trivia-machine';

export const GAME_REGISTRY = {
  REALTIME_TRIVIA: realtimeTriviaMachine,
  TRIVIA: triviaMachine,
} as const;
