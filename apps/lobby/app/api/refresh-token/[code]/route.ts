import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDB, getEnv } from '@/lib/db';
import { signGameToken } from '@pecking-order/auth';

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/**
 * OPTIONS /api/refresh-token/[code]
 * CORS preflight for cross-origin credential requests from the client app.
 */
export async function OPTIONS() {
  const env = await getEnv();
  const clientHost = (env.GAME_CLIENT_HOST as string) || 'http://localhost:5173';
  return new Response(null, { status: 204, headers: corsHeaders(clientHost) });
}

/**
 * GET /api/refresh-token/[code]
 *
 * Accepts the po_session cookie (sent via credentials: 'include'),
 * resolves the user's player slot, and mints a fresh game JWT.
 * Returns JSON { token } instead of redirecting — designed for
 * seamless background recovery from the client app.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const env = await getEnv();
  const clientHost = (env.GAME_CLIENT_HOST as string) || 'http://localhost:5173';
  const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';
  const headers = corsHeaders(clientHost);

  // Check auth via po_session cookie
  const session = await getSession();
  if (!session) {
    return Response.json(
      { error: 'unauthorized' },
      { status: 401, headers },
    );
  }

  const db = await getDB();

  // Find game by invite code
  const game = await db
    .prepare('SELECT id, status, invite_code, day_count FROM GameSessions WHERE invite_code = ?')
    .bind(code.toUpperCase())
    .first<{ id: string; status: string; invite_code: string; day_count: number }>();

  if (!game) {
    return Response.json(
      { error: 'game_not_found' },
      { status: 404, headers },
    );
  }

  if (game.status !== 'STARTED') {
    return Response.json(
      { error: 'game_not_started' },
      { status: 400, headers },
    );
  }

  // Find the user's player slot
  const invite = await db
    .prepare(
      `SELECT i.slot_index, i.accepted_by, i.persona_id, pp.name as persona_name
       FROM Invites i
       JOIN PersonaPool pp ON pp.id = i.persona_id
       WHERE i.game_id = ? AND i.accepted_by = ?`
    )
    .bind(game.id, session.userId)
    .first<{ slot_index: number; accepted_by: string; persona_id: string; persona_name: string }>();

  if (!invite) {
    return Response.json(
      { error: 'not_a_player' },
      { status: 403, headers },
    );
  }

  // Determine player ID from slot ordering
  const { results: allAccepted } = await db
    .prepare(
      'SELECT slot_index, accepted_by FROM Invites WHERE game_id = ? AND accepted_by IS NOT NULL ORDER BY slot_index'
    )
    .bind(game.id)
    .all<{ slot_index: number; accepted_by: string }>();

  const idx = allAccepted.findIndex((i) => i.accepted_by === session.userId);
  const playerId = `p${idx + 1}`;

  // Mint JWT (expiry = 2× game length + 7 day buffer)
  const tokenExpiry = `${(game.day_count || 7) * 2 + 7}d`;
  const token = await signGameToken(
    {
      sub: session.userId,
      gameId: game.id,
      playerId,
      personaName: invite.persona_name,
    },
    AUTH_SECRET,
    tokenExpiry
  );

  return Response.json({ token }, { headers });
}
