/**
 * Game cartridge projection for SYSTEM.SYNC payloads.
 * Pure function — no side effects or dependencies on server state.
 *
 * Async games (with `players` record) get filtered to the requesting player's view.
 * Real-time games are broadcast as-is.
 */
export function projectGameCartridge(gameCtx: any, playerId: string): any {
  if (!gameCtx) return null;

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
