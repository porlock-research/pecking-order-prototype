/**
 * Cartridge projection helpers for SYSTEM.SYNC payloads.
 * Pure functions — no side effects or dependencies on server state.
 */

// Game cartridge projection is now in the shared package
export { projectGameCartridge } from '@pecking-order/game-cartridges';
import { PromptPhases, PromptTypes } from '@pecking-order/shared-types';

/**
 * Project prompt cartridge context for SYSTEM.SYNC.
 * Strips sensitive author mappings from two-phase activities during active phases.
 * - CONFESSION: strip `confessions` (author->text) during COLLECTING/VOTING
 * - GUESS_WHO: strip `answers` (author->text) during ANSWERING/GUESSING
 */
export function projectPromptCartridge(promptCtx: any): any {
  if (!promptCtx) return null;

  const { promptType, phase } = promptCtx;

  if (promptType === PromptTypes.CONFESSION && (phase === PromptPhases.COLLECTING || phase === PromptPhases.VOTING)) {
    const { confessions, ...safe } = promptCtx;
    return safe;
  }

  if (promptType === PromptTypes.GUESS_WHO && (phase === PromptPhases.ANSWERING || phase === PromptPhases.GUESSING)) {
    const { answers, ...safe } = promptCtx;
    return safe;
  }

  return promptCtx;
}
