/**
 * Game (Minigame) Cartridge Contract
 *
 * Every game machine must:
 * - Accept GameCartridgeInput as input
 * - Handle GAME.{MECHANIC}.* events
 * - Return silver rewards map as output from final state
 * - Expose context matching BaseGameContext for SYSTEM.SYNC rendering
 *
 * Result patterns:
 * - **Async games** (e.g. TRIVIA): Emit CARTRIDGE.PLAYER_GAME_RESULT per player
 *   via sendParent as each player completes. Output silverRewards should only
 *   include incomplete players (partial credit). Completed players are excluded
 *   since they were already rewarded incrementally.
 * - **Sync games** (e.g. REALTIME_TRIVIA): Return full silverRewards in output
 *   from the final state (batch reward at game end).
 *
 * IMPORTANT: currentQuestion must NOT include correctIndex —
 * the context is broadcast to clients. Only reveal correctIndex
 * in lastRoundResults after the round ends.
 */
import type { GameType, GameCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';

export type { GameType, GameCartridgeInput };

export interface BaseGameContext {
  gameType: GameType;
  phase: 'WAITING' | 'QUESTION' | 'RESULT' | 'SCOREBOARD';
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>;        // playerId → cumulative silver earned
  currentQuestion: { question: string; options: string[] } | null;
  roundDeadline: number | null;           // timestamp for client countdown
  lastRoundResults: {
    correctIndex: number;
    playerResults: Record<string, { correct: boolean; silver: number; speedBonus: number }>;
  } | null;
}

export type GameEvent =
  | { type: `GAME.${string}`; senderId: string; [key: string]: any }
  | { type: 'INTERNAL.START_GAME'; payload?: any }
  | { type: 'INTERNAL.END_GAME' };

export interface GameOutput {
  silverRewards: Record<string, number>;
  goldContribution: number;
}
