import { NextRequest } from 'next/server';
import { getDB, getEnv } from '@/lib/db';

/** Constant-time bearer comparison — prevents timing attacks against the
 *  shared internal secret. Mirrors the intent of game-server's
 *  crypto.subtle.timingSafeEqual (a CF Workers extension that isn't in
 *  the lobby's TS lib). Manual XOR is fine for the fixed-length
 *  `Bearer <secret>` shape this route accepts. */
function timingSafeBearer(headerValue: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  const actual = headerValue || '';
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

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
  const AUTH_SECRET = env.AUTH_SECRET as string | undefined;

  // Fail closed: this route accepts only system-to-system traffic, so a
  // missing secret should reject everything rather than fall back to a
  // well-known dev string. The user-facing routes (refresh-token, etc.)
  // use the dev fallback so local-without-vars still works; this internal
  // path has no such requirement.
  if (!AUTH_SECRET) {
    return Response.json({ error: 'misconfigured' }, { status: 500 });
  }

  if (!timingSafeBearer(req.headers.get('authorization'), AUTH_SECRET)) {
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
