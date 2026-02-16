/** Fields to strip from sync decision projections (internal/server-only) */
const SYNC_DECISION_INTERNAL_FIELDS = new Set(['roster', 'dayIndex']);

/** Extract public extra fields from sync decision context */
function pickPublicFields(gameCtx: any): Record<string, any> {
  const public_: Record<string, any> = {};
  for (const [key, value] of Object.entries(gameCtx)) {
    if (
      SYNC_DECISION_INTERNAL_FIELDS.has(key) ||
      ['gameType', 'phase', 'eligiblePlayers', 'decisions', 'submitted', 'results'].includes(key)
    ) continue;
    public_[key] = value;
  }
  return public_;
}

/**
 * Game cartridge projection for SYSTEM.SYNC payloads.
 * Pure function — no side effects or dependencies on server state.
 *
 * Async games (with `players` record) get filtered to the requesting player's view.
 * Sync decision games strip other players' decisions during COLLECTING phase.
 * Real-time games are broadcast as-is.
 */
export function projectGameCartridge(gameCtx: any, playerId: string): any {
  if (!gameCtx) return null;

  // Sync decision games have a `decisions` record + `submitted` record
  if (gameCtx.decisions !== undefined && gameCtx.submitted !== undefined) {
    if (gameCtx.phase === 'COLLECTING') {
      // Strip decision values — only show who has submitted + player's own decision
      return {
        gameType: gameCtx.gameType,
        phase: gameCtx.phase,
        eligiblePlayers: gameCtx.eligiblePlayers,
        submitted: gameCtx.submitted,
        myDecision: gameCtx.decisions[playerId] ?? null,
        results: null,
        ...pickPublicFields(gameCtx),
      };
    }
    // REVEAL: show all decisions + results
    return {
      gameType: gameCtx.gameType,
      phase: gameCtx.phase,
      eligiblePlayers: gameCtx.eligiblePlayers,
      submitted: gameCtx.submitted,
      decisions: gameCtx.decisions,
      results: gameCtx.results,
      ...pickPublicFields(gameCtx),
    };
  }

  // Async per-player games have a `players` record
  if (gameCtx.players) {
    const playerState = gameCtx.players[playerId];
    if (!playerState) return null;

    // Strip server-only fields (questions, questionPool, etc.)
    const { questions, questionPool, ...safeState } = playerState as any;

    return {
      gameType: gameCtx.gameType,
      ready: gameCtx.ready ?? true,
      seed: gameCtx.seed,
      timeLimit: gameCtx.timeLimit,
      difficulty: gameCtx.difficulty,
      ...safeState,
      roundDeadline: safeState.questionStartedAt
        ? safeState.questionStartedAt + 15_000
        : safeState.roundDeadline ?? null,
      goldContribution: gameCtx.goldContribution,
    };
  }

  // Real-time games: broadcast full context (strip questionPool/correctIndex data)
  const { questionPool, ...publicCtx } = gameCtx;
  return publicCtx;
}
