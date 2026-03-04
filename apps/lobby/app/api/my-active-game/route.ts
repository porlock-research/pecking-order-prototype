import { getSession } from '@/lib/auth';
import { getDB, getEnv } from '@/lib/db';

function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/**
 * OPTIONS /api/my-active-game
 * CORS preflight for cross-origin credential requests from the client app.
 */
export async function OPTIONS() {
  const env = await getEnv();
  const clientHost = (env.GAME_CLIENT_HOST as string) || 'http://localhost:5173';
  return new Response(null, { status: 204, headers: corsHeaders(clientHost) });
}

/**
 * GET /api/my-active-game
 *
 * Uses the po_session cookie to find ALL of the user's active (STARTED) games.
 * Returns { games: [{ gameCode, personaName }] } — metadata only, no tokens.
 * Token minting happens via /api/refresh-token/[code] when the user navigates
 * to a specific game.
 *
 * Used by the PWA launcher at `/` to discover active games without a game code.
 */
export async function GET() {
  const env = await getEnv();
  const clientHost = (env.GAME_CLIENT_HOST as string) || 'http://localhost:5173';
  const headers = corsHeaders(clientHost);

  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers });
  }

  const db = await getDB();

  const { results } = await db
    .prepare(
      `SELECT g.invite_code, pp.name as persona_name
       FROM Invites i
       JOIN GameSessions g ON g.id = i.game_id
       JOIN PersonaPool pp ON pp.id = i.persona_id
       WHERE i.accepted_by = ? AND g.status IN ('RECRUITING', 'READY', 'STARTED')
       ORDER BY g.created_at DESC`
    )
    .bind(session.userId)
    .all<{ invite_code: string; persona_name: string }>();

  return Response.json({
    games: results.map(r => ({ gameCode: r.invite_code, personaName: r.persona_name })),
  }, { headers });
}
