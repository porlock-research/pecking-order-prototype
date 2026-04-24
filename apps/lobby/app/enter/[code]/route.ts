import { NextRequest, NextResponse } from 'next/server';
import { getDB, getEnv } from '@/lib/db';
import { getSession, generateToken, setSessionCookie } from '@/lib/auth';
import { verifyGameToken } from '@pecking-order/auth';

// Smart-recovery endpoint. The client's recovery cascade lands here when
// all local token paths failed. POST with `hint=<any-signature-valid-JWT>`
// restores identity for that JWT's `sub` — crucial for the "I played game
// A last month, you shared game B with me" scenario where cached tokens
// expired but the user is still legitimately that identity.
// See docs/plans/2026-04-24-auth-flow-hardening.md Task 6.

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// GET with no hint: route the visitor based on session. Handles odd
// arrivals (bookmark, bad redirect) — the real work happens on POST.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const session = await getSession();
  if (session) return NextResponse.redirect(new URL(`/play/${code}`, req.url));
  return NextResponse.redirect(new URL(`/j/${code}`, req.url));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const formData = await req.formData();
  const hint = (formData.get('hint') as string | null) || null;

  const db = await getDB();
  const env = await getEnv();
  const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';

  // Short-circuit if the visitor already has a live session — no identity
  // restoration needed, just route them to the game.
  const session = await getSession();
  if (session) {
    return NextResponse.redirect(new URL(`/play/${code}`, req.url), 303);
  }

  const game = await db
    .prepare('SELECT id, status FROM GameSessions WHERE invite_code = ?')
    .bind(code.toUpperCase())
    .first<{ id: string; status: string }>();
  if (!game) {
    return NextResponse.redirect(
      new URL('/login?error=Game+not+found', req.url),
      303,
    );
  }

  if (hint) {
    try {
      const decoded = await verifyGameToken(hint, AUTH_SECRET, {
        ignoreExpiration: true,
      });
      const user = await db
        .prepare('SELECT id FROM Users WHERE id = ?')
        .bind(decoded.sub)
        .first<{ id: string }>();
      if (user) {
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
        const response = NextResponse.redirect(new URL(`/play/${code}`, req.url), 303);
        await setSessionCookie(response, sessionId, req.nextUrl.hostname);
        return response;
      }
      // Signature-valid JWT but the referenced user no longer exists —
      // treat like a missing hint and fall through to welcome.
    } catch {
      // Invalid hint (bad signature, malformed) — fall through to welcome
      // rather than revealing to the caller why it failed.
    }
  }

  return NextResponse.redirect(new URL(`/j/${code}`, req.url), 303);
}
