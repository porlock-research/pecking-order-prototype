/**
 * Game (Minigame) Cartridge Contract
 *
 * Every game machine must:
 * - Accept GameCartridgeInput as input
 * - Handle GAME.{MECHANIC}.* events
 * - Emit GAME_RESULT fact via sendParent on completion
 * - Return silver rewards map as output from final state
 * - Expose context matching BaseGameContext for SYSTEM.SYNC rendering
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
