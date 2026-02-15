// Contracts
export type { GameEvent, BaseGameContext, GameOutput, GameType } from './contracts';

// Helpers
export { getAlivePlayerIds } from './helpers/alive-players';
export { fetchTriviaQuestions, FALLBACK_QUESTIONS, type TriviaQuestion } from './helpers/trivia-api';
export { projectGameCartridge } from './helpers/projections';

// Arcade factory + types
export { createArcadeMachine } from './machines/arcade-machine';
export type { ArcadeGameConfig, ArcadePlayerState, ArcadeGameContext } from './machines/arcade-machine';

// Machines + Registry
export {
  gapRunMachine, gridPushMachine, sequenceMachine,
  reactionTimeMachine, colorMatchMachine, stackerMachine,
  quickMathMachine, simonSaysMachine, aimTrainerMachine,
  triviaMachine, realtimeTriviaMachine, GAME_REGISTRY,
} from './machines';
