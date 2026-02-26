import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { generateToken } from '@/lib/auth';

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDB();
  const now = Date.now();

  // Look up invite token
  const invite = await db
    .prepare(
      `SELECT token, email, game_id, invite_code, expires_at, used
       FROM InviteTokens WHERE token = ?`
    )
    .bind(token)
    .first<{
      token: string;
      email: string;
      game_id: string;
      invite_code: string;
      expires_at: number;
      used: number;
    }>();

  if (!invite) {
    return NextResponse.redirect(new URL('/login?error=Invalid invite link', req.url));
  }

  if (invite.used) {
    // Already used — redirect to join page anyway (they might already be in the game)
    return NextResponse.redirect(new URL(`/join/${invite.invite_code}`, req.url));
  }

  if (invite.expires_at < now) {
    const errorUrl = new URL('/login', req.url);
    errorUrl.searchParams.set('error', 'Invite link expired');
    return NextResponse.redirect(errorUrl);
  }

  // Mark as used
  await db.prepare('UPDATE InviteTokens SET used = 1 WHERE token = ?').bind(token).run();

  // Upsert user for this email
  const normalizedEmail = invite.email.toLowerCase().trim();
  let user = await db
    .prepare('SELECT id FROM Users WHERE email = ?')
    .bind(normalizedEmail)
    .first<{ id: string }>();

  if (!user) {
    const userId = crypto.randomUUID();
    await db
      .prepare('INSERT INTO Users (id, email, created_at) VALUES (?, ?, ?)')
      .bind(userId, normalizedEmail, now)
      .run();
    user = { id: userId };
  }

  // Update last login
  await db.prepare('UPDATE Users SET last_login_at = ? WHERE id = ?').bind(now, user.id).run();

  // Create session
  const sessionId = generateToken();
  await db
    .prepare('INSERT INTO Sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, user.id, now + SESSION_EXPIRY_MS, now)
    .run();

  // Redirect to join page with session cookie
  const response = NextResponse.redirect(new URL(`/join/${invite.invite_code}`, req.url));
  response.cookies.set('po_session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
