/**
 * Game Cartridge Output Contract
 *
 * Every game machine must:
 * - Accept GameCartridgeInput as input
 * - Handle GAME.{MECHANIC}.* events
 * - Return GameOutput from final state
 * - Expose context matching BaseGameContext for SYSTEM.SYNC rendering
 *
 * Result patterns:
 * - **Async games** (e.g. TRIVIA): Emit CARTRIDGE.PLAYER_GAME_RESULT per player
 *   via sendParent as each player completes. Output silverRewards should only
 *   include incomplete players (partial credit).
 * - **Sync games** (e.g. REALTIME_TRIVIA): Return full silverRewards in output
 *   from the final state (batch reward at game end).
 * - **Sync decision games** (e.g. BET_BET_BET, BLIND_AUCTION, KINGS_RANSOM):
 *   All players submit decisions during COLLECTING phase. On INTERNAL.END_GAME,
 *   calculateResults computes silverRewards (can be negative). Returns full
 *   silverRewards in output. Context exposes SyncDecisionContext for projection.
 *
 * IMPORTANT: currentQuestion must NOT include correctIndex —
 * the context is broadcast to clients. Only reveal correctIndex
 * in lastRoundResults after the round ends.
 */
import type { GameType } from '@pecking-order/shared-types';

export type { GameType };

export interface BaseGameContext {
  gameType: GameType;
  phase: 'WAITING' | 'QUESTION' | 'RESULT' | 'SCOREBOARD';
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentQuestion: { question: string; options: string[] } | null;
  roundDeadline: number | null;
  lastRoundResults: {
    correctIndex: number;
    playerResults: Record<string, { correct: boolean; silver: number; speedBonus: number }>;
  } | null;
}

export interface GameOutput {
  silverRewards: Record<string, number>;
  goldContribution: number;
  /** When true, gold was already emitted per-player via CARTRIDGE.PLAYER_GAME_RESULT.
   *  L2 should skip ECONOMY.CONTRIBUTE_GOLD from CARTRIDGE.GAME_RESULT to avoid double-counting. */
  goldEmittedPerPlayer?: boolean;
  gameType?: string;
  summary?: Record<string, any>;
}
