/**
 * Cartridge projection helpers for SYSTEM.SYNC payloads.
 * Pure functions — no side effects or dependencies on server state.
 */

// Game cartridge projection is now in the shared package
export { projectGameCartridge } from '@pecking-order/game-cartridges';

/**
 * Project prompt cartridge context for SYSTEM.SYNC.
 * Strips sensitive author mappings from two-phase activities during active phases.
 * - CONFESSION: strip `confessions` (author->text) during COLLECTING/VOTING
 * - GUESS_WHO: strip `answers` (author->text) during ANSWERING/GUESSING
 */
export function projectPromptCartridge(promptCtx: any): any {
  if (!promptCtx) return null;

  const { promptType, phase } = promptCtx;

  if (promptType === 'CONFESSION' && (phase === 'COLLECTING' || phase === 'VOTING')) {
    const { confessions, ...safe } = promptCtx;
    return safe;
  }

  if (promptType === 'GUESS_WHO' && (phase === 'ANSWERING' || phase === 'GUESSING')) {
    const { answers, ...safe } = promptCtx;
    return safe;
  }

  return promptCtx;
}
