import { NextRequest } from 'next/server';
import { getDB, getEnv } from '@/lib/db';

/**
 * POST /api/internal/game-status — game-server → lobby status sync (issue #49).
 *
 * Authenticated via shared `AUTH_SECRET` (same secret the lobby uses to call
 * game-server endpoints). Body: `{ gameId: string, status: 'IN_PROGRESS' | 'COMPLETED' }`.
 *
 * Maps game-server status to lobby `GameSessions.status`:
 *   IN_PROGRESS  → STARTED   (covers CC RECRUITING→STARTED gap and STATIC re-init)
 *   COMPLETED    → COMPLETED (lobby was previously stuck at STARTED forever)
 *
 * Idempotent: only updates when transitioning to a *later* lifecycle state, so
 * duplicate calls and out-of-order delivery are both safe. ARCHIVED stays
 * admin-only and is treated as terminal here.
 */

// RECRUITING(0) → READY(1) → STARTED(2) → COMPLETED(3) → ARCHIVED(4).
// Numeric ordering lets us reject backward transitions in one comparison.
const STATUS_ORDER: Record<string, number> = {
  RECRUITING: 0,
  READY: 1,
  STARTED: 2,
  COMPLETED: 3,
  ARCHIVED: 4,
};

const GAME_SERVER_TO_LOBBY: Record<string, string> = {
  IN_PROGRESS: 'STARTED',
  COMPLETED: 'COMPLETED',
};

export async function POST(req: NextRequest) {
  const env = await getEnv();
  const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';

  const authHeader = req.headers.get('authorization') || '';
  if (authHeader !== `Bearer ${AUTH_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { gameId, status } = (body || {}) as { gameId?: unknown; status?: unknown };
  if (typeof gameId !== 'string' || !gameId) {
    return Response.json({ error: 'missing_gameId' }, { status: 400 });
  }
  if (typeof status !== 'string' || !(status in GAME_SERVER_TO_LOBBY)) {
    return Response.json({ error: 'invalid_status' }, { status: 400 });
  }

  const targetStatus = GAME_SERVER_TO_LOBBY[status];
  const db = await getDB();

  const game = await db
    .prepare('SELECT id, status FROM GameSessions WHERE id = ?')
    .bind(gameId)
    .first<{ id: string; status: string }>();

  if (!game) {
    // Not an error from the game-server's perspective — could be a cleanup
    // race where the lobby row was deleted before the callback fired.
    return Response.json({ ok: false, reason: 'game_not_found' }, { status: 404 });
  }

  const currentRank = STATUS_ORDER[game.status] ?? -1;
  const targetRank = STATUS_ORDER[targetStatus] ?? -1;
  if (targetRank <= currentRank) {
    // No-op for idempotent re-fires AND for ARCHIVED games (admin already
    // decided this game is done — don't bounce back to COMPLETED).
    return Response.json({ ok: true, unchanged: true, current: game.status });
  }

  await db
    .prepare('UPDATE GameSessions SET status = ? WHERE id = ?')
    .bind(targetStatus, gameId)
    .run();

  return Response.json({ ok: true, previous: game.status, current: targetStatus });
}
