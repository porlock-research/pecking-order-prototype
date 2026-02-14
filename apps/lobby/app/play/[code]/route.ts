import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDB, getEnv } from '@/lib/db';
import { signGameToken } from '@pecking-order/auth';

/**
 * GET /play/[code]
 *
 * Authenticated redirect: resolves the current user's player slot for the game
 * identified by invite code, mints a JWT, and redirects to the client app with
 * the token as a transient query param. The client stores it in sessionStorage
 * and cleans the URL via history.replaceState.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const env = await getEnv();
  const GAME_CLIENT_HOST = (env.GAME_CLIENT_HOST as string) || 'http://localhost:5173';
  const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';

  // Check auth — redirect to login if not authenticated
  const session = await getSession();
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', `/play/${code}`);
    return NextResponse.redirect(loginUrl);
  }

  const db = await getDB();

  // Find game by invite code
  const game = await db
    .prepare('SELECT id, status, invite_code FROM GameSessions WHERE invite_code = ?')
    .bind(code.toUpperCase())
    .first<{ id: string; status: string; invite_code: string }>();

  if (!game) {
    return new Response('Game not found', { status: 404 });
  }

  if (game.status !== 'STARTED') {
    // Game hasn't started yet — redirect to waiting room
    return NextResponse.redirect(new URL(`/game/${game.id}/waiting`, req.url));
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
    return new Response('You are not a player in this game', { status: 403 });
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

  // Mint JWT
  const token = await signGameToken(
    {
      sub: session.userId,
      gameId: game.id,
      playerId,
      personaName: invite.persona_name,
    },
    AUTH_SECRET
  );

  // Redirect to client with transient token param
  // Client will store in sessionStorage and clean URL to /game/CODE
  const clientUrl = new URL(`/game/${game.invite_code}`, GAME_CLIENT_HOST);
  clientUrl.searchParams.set('_t', token);

  return NextResponse.redirect(clientUrl.toString());
}
