/**
 * Prompt Cartridge Contract
 *
 * Every prompt machine must:
 * - Accept PromptCartridgeInput as input
 * - Handle ACTIVITY.{MECHANISM}.* events
 * - Return PromptOutput as output from final state
 * - Expose context matching BasePromptContext for SYSTEM.SYNC rendering
 */
import type { PromptType, PromptCartridgeInput, SocialPlayer } from '@pecking-order/shared-types';

export type { PromptType, PromptCartridgeInput };

export interface BasePromptContext {
  promptType: PromptType;
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  responses: Record<string, string>; // voterId → targetId
  results: PromptResult | null;
}

export interface PromptResult {
  mostPicked: { playerId: string; count: number } | null;
  mutualPicks: Array<[string, string]>; // pairs of mutual pickers
  silverRewards: Record<string, number>;
}

export type PromptEvent =
  | { type: `ACTIVITY.${string}`; senderId: string; targetId?: string; [key: string]: any }
  | { type: 'INTERNAL.END_ACTIVITY' };

export interface PromptOutput {
  silverRewards: Record<string, number>;
}
