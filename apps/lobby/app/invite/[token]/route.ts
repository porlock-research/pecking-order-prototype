import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { generateToken, setSessionCookie } from '@/lib/auth';
import { log, LOG_TOKEN_PREFIX_LEN } from '@/lib/log';
import { renderConfirmPage } from '@/lib/render-confirm-page';

// Bot-safe render: GET validates (read-only) + renders an auto-submitting
// confirm page. POST consumes the invite token, upserts user, mints session,
// and redirects to the join flow. Defends against email-security scanners
// (Mimecast/Proofpoint/iOS preview) that GET-prefetch invite URLs and were
// orphaning tokens before real users could click.
// See docs/plans/2026-04-24-auth-flow-hardening.md Task 1.

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const COMPONENT = 'invite-route';

type Invite = {
  token: string;
  email: string;
  game_id: string;
  invite_code: string;
  expires_at: number;
  used: number;
};

async function loadInvite(token: string): Promise<Invite | null> {
  const db = await getDB();
  return db
    .prepare(
      `SELECT token, email, game_id, invite_code, expires_at, used
       FROM InviteTokens WHERE token = ?`,
    )
    .bind(token)
    .first<Invite>();
}

function inviteConfirmPage(token: string, inviteCode: string): Response {
  return renderConfirmPage({
    title: 'Continue to Pecking Order',
    bodyCopy: 'Taking you to your game…',
    formAction: `/invite/${encodeURIComponent(token)}`,
    continueLabel: `Continue to game ${inviteCode}`,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenPrefix = token.slice(0, LOG_TOKEN_PREFIX_LEN);
  const invite = await loadInvite(token);
  const now = Date.now();
  if (!invite) {
    log('warn', COMPONENT, 'invite.invalid', { tokenPrefix, method: 'GET' });
    return NextResponse.redirect(new URL('/login?error=Invalid+invite+link', req.url));
  }
  if (invite.expires_at < now) {
    log('info', COMPONENT, 'invite.expired', { tokenPrefix, method: 'GET' });
    return NextResponse.redirect(new URL('/login?error=Invite+link+expired', req.url));
  }
  if (invite.used) {
    log('info', COMPONENT, 'invite.already_used', { tokenPrefix, method: 'GET' });
    return NextResponse.redirect(new URL(`/j/${invite.invite_code}`, req.url));
  }
  log('info', COMPONENT, 'invite.confirm_page_rendered', { tokenPrefix });
  return inviteConfirmPage(token, invite.invite_code);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenPrefix = token.slice(0, LOG_TOKEN_PREFIX_LEN);
  const invite = await loadInvite(token);
  const now = Date.now();
  if (!invite) {
    log('warn', COMPONENT, 'invite.invalid', { tokenPrefix, method: 'POST' });
    return NextResponse.redirect(new URL('/login?error=Invalid+invite+link', req.url), 303);
  }
  if (invite.expires_at < now) {
    log('info', COMPONENT, 'invite.expired', { tokenPrefix, method: 'POST' });
    return NextResponse.redirect(new URL('/login?error=Invite+link+expired', req.url), 303);
  }
  if (invite.used) {
    log('info', COMPONENT, 'invite.already_used', { tokenPrefix, method: 'POST' });
    return NextResponse.redirect(new URL(`/j/${invite.invite_code}`, req.url), 303);
  }

  const db = await getDB();
  // Race-safe consume: guard on used = 0 so two concurrent POSTs (browser
  // double-tap, auto-submit + user tap, two tabs) don't both mint sessions.
  // If meta.changes is 0, someone else consumed the token between our
  // loadInvite() read and this UPDATE — treat as already-used.
  const updateResult = await db
    .prepare('UPDATE InviteTokens SET used = 1 WHERE token = ? AND used = 0')
    .bind(token)
    .run();
  if ((updateResult.meta?.changes ?? 0) === 0) {
    log('info', COMPONENT, 'invite.already_used', { tokenPrefix, method: 'POST', race: true });
    return NextResponse.redirect(new URL(`/j/${invite.invite_code}`, req.url), 303);
  }

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
  await db.prepare('UPDATE Users SET last_login_at = ? WHERE id = ?').bind(now, user.id).run();

  const sessionId = generateToken();
  await db
    .prepare('INSERT INTO Sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, user.id, now + SESSION_EXPIRY_MS, now)
    .run();

  log('info', COMPONENT, 'invite.consumed', {
    tokenPrefix,
    inviteCode: invite.invite_code,
    gameId: invite.game_id,
  });
  const response = NextResponse.redirect(new URL(`/join/${invite.invite_code}`, req.url), 303);
  await setSessionCookie(response, sessionId, req.nextUrl.hostname);
  return response;
}
