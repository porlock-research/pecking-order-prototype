import { NextRequest, NextResponse } from 'next/server';
import { getDB, getEnv } from '@/lib/db';
import { getSession, generateToken, setSessionCookie } from '@/lib/auth';
import { log } from '@/lib/log';
import { verifyGameToken } from '@pecking-order/auth';

// Smart-recovery endpoint. The client's recovery cascade lands here when
// all local token paths failed. POST with `hint=<any-signature-valid-JWT>`
// restores identity for that JWT's `sub` — crucial for the "I played game
// A last month, you shared game B with me" scenario where cached tokens
// expired but the user is still legitimately that identity.
// See docs/plans/2026-04-24-auth-flow-hardening.md Task 6.

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const COMPONENT = 'enter-route';

async function loadGame(code: string) {
  const db = await getDB();
  return db
    .prepare('SELECT id, status FROM GameSessions WHERE invite_code = ?')
    .bind(code.toUpperCase())
    .first<{ id: string; status: string }>();
}

// GET with no hint: route the visitor based on session and game presence.
// Handles odd arrivals (bookmark, bad redirect) — the real work happens
// on POST. Game lookup here mirrors the POST path so a garbage code gets
// the same /login?error=Game+not+found response regardless of session
// state (instead of authed users falling through to /play's own 404).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const game = await loadGame(code);
  if (!game) {
    log('warn', COMPONENT, 'enter.game_not_found', { code, method: 'GET' });
    return NextResponse.redirect(new URL('/login?error=Game+not+found', req.url));
  }
  const session = await getSession();
  if (session) {
    log('info', COMPONENT, 'enter.session_short_circuit', { code, method: 'GET' });
    return NextResponse.redirect(new URL(`/play/${code}`, req.url));
  }
  log('info', COMPONENT, 'enter.no_session_redirect_welcome', { code, method: 'GET' });
  return NextResponse.redirect(new URL(`/j/${code}`, req.url));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const formData = await req.formData();
  const hint = (formData.get('hint') as string | null) || null;

  const env = await getEnv();
  const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';

  const game = await loadGame(code);
  if (!game) {
    log('warn', COMPONENT, 'enter.game_not_found', {
      code,
      method: 'POST',
      hasHint: !!hint,
    });
    return NextResponse.redirect(
      new URL('/login?error=Game+not+found', req.url),
      303,
    );
  }

  // Short-circuit if the visitor already has a live session — no identity
  // restoration needed, just route them to the game.
  const session = await getSession();
  if (session) {
    log('info', COMPONENT, 'enter.session_short_circuit', { code, method: 'POST' });
    return NextResponse.redirect(new URL(`/play/${code}`, req.url), 303);
  }

  if (hint) {
    try {
      const decoded = await verifyGameToken(hint, AUTH_SECRET, {
        ignoreExpiration: true,
      });
      const db = await getDB();
      const user = await db
        .prepare('SELECT id FROM Users WHERE id = ?')
        .bind(decoded.sub)
        .first<{ id: string }>();
      if (!user) {
        log('warn', COMPONENT, 'enter.hint_user_missing', { code, sub: decoded.sub });
        return NextResponse.redirect(new URL(`/j/${code}`, req.url), 303);
      }
      const sessionId = generateToken();
      const now = Date.now();
      await db
        .prepare(
          'INSERT INTO Sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
        )
        .bind(sessionId, user.id, now + SESSION_EXPIRY_MS, now)
        .run();
      await db
        .prepare('UPDATE Users SET last_login_at = ? WHERE id = ?')
        .bind(now, user.id)
        .run();
      log('info', COMPONENT, 'enter.hint_accepted', {
        code,
        sub: decoded.sub,
        // `exp` is seconds-since-epoch; null when the token predates the claim.
        exp: decoded.exp ?? null,
      });
      const response = NextResponse.redirect(new URL(`/play/${code}`, req.url), 303);
      await setSessionCookie(response, sessionId, req.nextUrl.hostname);
      return response;
    } catch (err) {
      // Bad signature / malformed / any jose failure. Don't reveal why to
      // the caller; drop to the welcome view and let them re-enter fresh.
      log('warn', COMPONENT, 'enter.hint_rejected', {
        code,
        reason: err instanceof Error ? err.name : 'unknown',
      });
    }
  } else {
    log('info', COMPONENT, 'enter.no_hint', { code });
  }

  return NextResponse.redirect(new URL(`/j/${code}`, req.url), 303);
}
