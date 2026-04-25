/**
 * Game-server → lobby status sync (issue #49).
 *
 * Bridges the game-server's `Games.status` (IN_PROGRESS → COMPLETED) with the
 * lobby's `GameSessions.status` (RECRUITING → READY → STARTED → COMPLETED →
 * ARCHIVED). Without this, lobby rows stay at STARTED forever after the game
 * actually ends, and CC games stuck at RECRUITING never advance to STARTED
 * because no late joiner ever fires the only existing trigger.
 *
 * The lobby route at /api/internal/game-status is idempotent, so duplicate
 * calls are safe — but callers (subscription.ts) still guard with a
 * persisted flag to avoid hammering the lobby on every snapshot fire.
 */
import type { Env } from "./types";
import { log } from "./log";

export type GameServerStatus = 'IN_PROGRESS' | 'COMPLETED';

/**
 * POST { gameId, status } to ${LOBBY_HOST}/api/internal/game-status.
 * Returns a promise the caller may await or fire-and-forget. Failures are
 * logged but the returned promise never rejects — propagating a lobby
 * outage to the game-server hot path would be worse than a stuck row.
 */
export function notifyLobbyGameStatus(
  env: Env,
  gameId: string,
  status: GameServerStatus,
): Promise<void> {
  if (!env.LOBBY_HOST) {
    log('warn', 'L1', 'lobby-callback: LOBBY_HOST not set, skipping', { gameId, status });
    return Promise.resolve();
  }
  if (!env.AUTH_SECRET) {
    log('warn', 'L1', 'lobby-callback: AUTH_SECRET not set, skipping', { gameId, status });
    return Promise.resolve();
  }

  const url = `${env.LOBBY_HOST}/api/internal/game-status`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.AUTH_SECRET}`,
    },
    body: JSON.stringify({ gameId, status }),
  }).then(async (res) => {
    if (!res.ok) {
      // Reading the body consumes the stream — no separate cancel() needed.
      const text = await res.text().catch(() => '');
      log('error', 'L1', 'lobby-callback: non-OK response', {
        gameId,
        status,
        httpStatus: res.status,
        body: text.slice(0, 200),
      });
      return;
    }
    // OK path: drain the body so the runtime doesn't keep the stream open.
    res.body?.cancel();
  }).catch((err) => {
    log('error', 'L1', 'lobby-callback: fetch failed', {
      gameId,
      status,
      error: String(err),
    });
  });
}
