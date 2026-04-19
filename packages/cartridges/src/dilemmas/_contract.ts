/**
 * Dilemma Cartridge Contract
 *
 * Every dilemma machine must:
 * - Accept DilemmaCartridgeInput as input
 * - Handle DILEMMA.{TYPE}.SUBMIT events (with senderId + decision payload)
 * - Handle INTERNAL.END_DILEMMA to force-close collecting
 * - Return DilemmaOutput { silverRewards, dilemmaType, summary }
 * - Expose context with { phase, dilemmaType, decisions, eligiblePlayers, results }
 *   for SYNC projection
 *
 * Decision shape varies by dilemma type:
 * - SILVER_GAMBIT: { action: 'DONATE' | 'KEEP' }
 * - SPOTLIGHT: { targetId: string }
 * - GIFT_OR_GRIEF: { targetId: string }
 */
import type { DilemmaType, DilemmaCartridgeInput, DilemmaOutput, SocialPlayer } from '@pecking-order/shared-types';

export type { DilemmaType, DilemmaCartridgeInput, DilemmaOutput };

export interface BaseDilemmaContext {
  dilemmaType: DilemmaType;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
  eligiblePlayers: string[];
  decisions: Record<string, any>;
  phase: string;
  results: DilemmaResults | null;
}

export interface DilemmaResults {
  silverRewards: Record<string, number>;
  summary: Record<string, any>;
}

export type DilemmaEvent =
  | { type: `DILEMMA.${string}`; senderId: string; [key: string]: any }
  | { type: 'INTERNAL.END_DILEMMA' };
