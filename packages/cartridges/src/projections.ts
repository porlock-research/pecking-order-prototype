/**
 * Prompt + dilemma projection helpers for SYSTEM.SYNC payloads.
 * Pure functions — no side effects or dependencies on server state.
 */
import { FactTypes, PromptPhases, PromptTypes } from '@pecking-order/shared-types';

/**
 * Strip sensitive fields from facts before broadcasting to clients.
 *
 * Defense-in-depth gate. Per-fact-type branch — explicitly NOT a generic
 * "strip actorId from all facts" rule, because some facts (e.g., PROMPT_RESULT
 * with the match-cartridge full reveal) legitimately carry author info.
 *
 * v1 status: NO PRODUCTION CONSUMER. Facts reach clients only via TICKER.UPDATE
 * (factToTicker), and CONFESSION_POSTED returns null from factToTicker — so the
 * actorId never leaks today. This helper exists so any future client-facing
 * fact pipeline (FACT.UPDATE WS messages, exported admin journal, debug
 * tooling) gets correct stripping by passing every fact through here.
 *
 * If you add such a pipeline, route facts through projectFactForClient before
 * the WS send. See `reference_facts_ticker_pipeline.md` for the design rule.
 */
export function projectFactForClient(fact: any): any {
  if (fact?.type === FactTypes.CONFESSION_POSTED) {
    const { actorId, ...rest } = fact;
    return rest;
  }
  return fact;
}

/**
 * Derive the per-player `participated` map from a prompt context.
 * Each prompt type stores submissions under a different field name — and some
 * are stripped from the projection during sensitive phases — so the client
 * can't infer participation reliably by checking any one field. Emit a
 * uniform `participated: Record<string, boolean>` so downstream UIs (pill
 * classifiers, result cards) have a stable phase-independent signal.
 */
function promptParticipation(ctx: any): Record<string, boolean> {
  const eligible: string[] = ctx?.eligiblePlayers ?? [];
  // Per-type submission field — all keyed by playerId.
  const submissions =
    ctx?.stances             // HOT_TAKE
    ?? ctx?.choices          // WOULD_YOU_RATHER
    ?? ctx?.confessions      // CONFESSION COLLECTING (stripped during VOTING)
    ?? ctx?.votes            // CONFESSION VOTING, PLAYER_PICK
    ?? ctx?.picks            // PLAYER_PICK
    ?? ctx?.predictions      // PREDICTION
    ?? ctx?.answers          // GUESS_WHO ANSWERING (stripped during GUESSING)
    ?? ctx?.guesses          // GUESS_WHO GUESSING
    ?? {};
  const out: Record<string, boolean> = {};
  for (const pid of eligible) out[pid] = pid in submissions;
  return out;
}

/**
 * Project prompt cartridge context for SYSTEM.SYNC.
 * Strips sensitive author mappings from two-phase activities during active phases.
 * - CONFESSION: strip `confessions` (author->text) during COLLECTING/VOTING
 * - GUESS_WHO: strip `answers` (author->text) during ANSWERING/GUESSING
 *
 * Always emits `participated: Record<string, boolean>` so the client can
 * render a "you've acted / you haven't" signal without depending on type-
 * specific fields that may be stripped.
 */
export function projectPromptCartridge(promptCtx: any): any {
  if (!promptCtx) return null;

  const { promptType, phase } = promptCtx;
  const participated = promptParticipation(promptCtx);

  if (promptType === PromptTypes.CONFESSION && (phase === PromptPhases.COLLECTING || phase === PromptPhases.VOTING)) {
    const { confessions, ...safe } = promptCtx;
    return { ...safe, participated };
  }

  if (promptType === PromptTypes.GUESS_WHO && (phase === PromptPhases.ANSWERING || phase === PromptPhases.GUESSING)) {
    const { answers, ...safe } = promptCtx;
    return { ...safe, participated };
  }

  return { ...promptCtx, participated };
}

/**
 * Project dilemma cartridge context for SYSTEM.SYNC.
 * During COLLECTING: only reveal who has submitted, not what they chose.
 * During REVEAL: include full decisions and results.
 */
export function projectDilemmaCartridge(raw: any): any {
  if (!raw) return null;
  const { dilemmaType, phase, eligiblePlayers, decisions, results } = raw;
  const participated = Object.fromEntries(
    (eligiblePlayers || []).map((pid: string) => [pid, pid in (decisions || {})])
  );
  return {
    dilemmaType,
    phase,
    eligiblePlayers,
    // During COLLECTING: only show who submitted, not what they chose.
    // `submitted` is the legacy field kept for prior callers; `participated`
    // is the uniform name shared with prompts.
    submitted: participated,
    participated,
    // During REVEAL: include full decisions and results
    ...(phase === 'REVEAL' ? { decisions, results } : {}),
  };
}
