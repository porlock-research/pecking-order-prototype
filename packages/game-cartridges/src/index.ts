// Contracts
export type { GameEvent, BaseGameContext, GameOutput, GameType } from './contracts';

// Helpers
export { getAlivePlayerIds } from './helpers/alive-players';
export { fetchTriviaQuestions, FALLBACK_QUESTIONS, type TriviaQuestion } from './helpers/trivia-api';
export { projectGameCartridge } from './helpers/projections';
export { tallyDecisions, breakTieByLowestSilver, breakTieByRandom, getMedian } from './helpers/decision-helpers';

// Arcade factory + types
export { createArcadeMachine } from './machines/arcade-machine';
export type { ArcadeGameConfig, ArcadePlayerState, ArcadeGameContext } from './machines/arcade-machine';

// Sync decision factory + types
export { createSyncDecisionMachine } from './machines/sync-decision-machine';
export type { SyncDecisionConfig, SyncDecisionContext, SyncDecisionResult } from './machines/sync-decision-machine';

// Machines + Registry
export {
  gapRunMachine, gridPushMachine, sequenceMachine,
  reactionTimeMachine, colorMatchMachine, stackerMachine,
  quickMathMachine, simonSaysMachine, aimTrainerMachine,
  triviaMachine, realtimeTriviaMachine,
  betBetBetMachine, blindAuctionMachine, kingsRansomMachine,
  touchScreenMachine,
  GAME_REGISTRY,
} from './machines';
