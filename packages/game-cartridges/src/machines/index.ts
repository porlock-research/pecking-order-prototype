export { createArcadeMachine } from './arcade-machine';
export type { ArcadeGameConfig, ArcadePlayerState, ArcadeGameContext } from './arcade-machine';

export { createSyncDecisionMachine } from './sync-decision-machine';
export type { SyncDecisionConfig, SyncDecisionContext, SyncDecisionResult } from './sync-decision-machine';

export { gapRunMachine } from './gap-run';
export { gridPushMachine } from './grid-push';
export { sequenceMachine } from './sequence';
export { reactionTimeMachine } from './reaction-time';
export { colorMatchMachine } from './color-match';
export { stackerMachine } from './stacker';
export { quickMathMachine } from './quick-math';
export { simonSaysMachine } from './simon-says';
export { aimTrainerMachine } from './aim-trainer';
export { triviaMachine } from './trivia';
export { realtimeTriviaMachine } from './realtime-trivia';
export { betBetBetMachine } from './bet-bet-bet';
export { blindAuctionMachine } from './blind-auction';
export { kingsRansomMachine } from './kings-ransom';

import { gapRunMachine } from './gap-run';
import { gridPushMachine } from './grid-push';
import { sequenceMachine } from './sequence';
import { reactionTimeMachine } from './reaction-time';
import { colorMatchMachine } from './color-match';
import { stackerMachine } from './stacker';
import { quickMathMachine } from './quick-math';
import { simonSaysMachine } from './simon-says';
import { aimTrainerMachine } from './aim-trainer';
import { triviaMachine } from './trivia';
import { realtimeTriviaMachine } from './realtime-trivia';
import { betBetBetMachine } from './bet-bet-bet';
import { blindAuctionMachine } from './blind-auction';
import { kingsRansomMachine } from './kings-ransom';

export const GAME_REGISTRY = {
  GAP_RUN: gapRunMachine,
  GRID_PUSH: gridPushMachine,
  SEQUENCE: sequenceMachine,
  REACTION_TIME: reactionTimeMachine,
  COLOR_MATCH: colorMatchMachine,
  STACKER: stackerMachine,
  QUICK_MATH: quickMathMachine,
  SIMON_SAYS: simonSaysMachine,
  AIM_TRAINER: aimTrainerMachine,
  REALTIME_TRIVIA: realtimeTriviaMachine,
  TRIVIA: triviaMachine,
  BET_BET_BET: betBetBetMachine,
  BLIND_AUCTION: blindAuctionMachine,
  KINGS_RANSOM: kingsRansomMachine,
} as const;
