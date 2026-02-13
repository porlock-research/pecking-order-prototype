/**
 * Cartridge projection helpers for SYSTEM.SYNC payloads.
 * Pure functions — no side effects or dependencies on server state.
 */

/**
 * Project game cartridge context per-player.
 * Async games (with `players` record) get filtered to the requesting player's view.
 * Real-time games are broadcast as-is.
 */
export function projectGameCartridge(gameCtx: any, playerId: string): any {
  if (!gameCtx) return null;

  // Async per-player games have a `players` record
  if (gameCtx.players) {
    const playerState = gameCtx.players[playerId];
    if (!playerState) return null;
    return {
      gameType: gameCtx.gameType,
      ready: gameCtx.ready ?? true,
      status: playerState.status,
      currentRound: playerState.currentRound,
      totalRounds: playerState.totalRounds,
      currentQuestion: playerState.currentQuestion,
      roundDeadline: playerState.status === 'PLAYING' && playerState.questionStartedAt
        ? playerState.questionStartedAt + 15_000
        : null,
      lastRoundResult: playerState.lastRoundResult,
      score: playerState.score,
      correctCount: playerState.correctCount,
      silverReward: playerState.silverReward,
      goldContribution: gameCtx.goldContribution,
    };
  }

  // Real-time games: broadcast full context (strip questionPool/correctIndex data)
  const { questionPool, ...publicCtx } = gameCtx;
  return publicCtx;
}

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
