import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { generateToken, setSessionCookie } from '@/lib/auth';

// Bot-safe render: GET validates (read-only) + renders an auto-submitting
// confirm page. POST consumes the invite token, upserts user, mints session,
// and redirects to the join flow. Defends against email-security scanners
// (Mimecast/Proofpoint/iOS preview) that GET-prefetch invite URLs and were
// orphaning tokens before real users could click.
// See docs/plans/2026-04-24-auth-flow-hardening.md Task 1.

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Log an invite-flow event as structured JSON (Axiom picks it up from
// Workers Logs). tokenPrefix gives enough correlation to join against the
// InviteTokens.token column in D1 without writing the full secret to logs.
function logInvite(
  level: 'info' | 'warn' | 'error',
  event: string,
  tokenPrefix: string,
  extra?: Record<string, unknown>,
) {
  console.log(
    JSON.stringify({ level, component: 'invite-route', event, tokenPrefix, ...extra }),
  );
}

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

function renderConfirmPage(token: string, inviteCode: string): Response {
  // token is a 64-hex string and inviteCode is [A-Z0-9], both looked up in
  // D1. Re-encoding defensively before embedding in HTML attributes.
  const safeToken = encodeURIComponent(token);
  const safeCode = encodeURIComponent(inviteCode);
  const html = [
    '<!doctype html><html lang="en"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Continue to Pecking Order</title>',
    '<style>',
    'body{margin:0;font-family:system-ui,sans-serif;background:#0f0a1a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}',
    '.card{max-width:360px;text-align:center}',
    '.spinner{width:24px;height:24px;margin:0 auto 16px;border:2px solid #f5c842;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite}',
    'button{margin-top:16px;padding:14px 24px;background:#f5c842;color:#0f0a1a;border:0;border-radius:12px;font-weight:700;cursor:pointer;font-size:15px}',
    '@keyframes spin{to{transform:rotate(360deg)}}',
    '</style></head><body>',
    '<div class="card">',
    '<div class="spinner" aria-hidden="true"></div>',
    '<p>Taking you to your game…</p>',
    `<form method="post" action="/invite/${safeToken}" id="f">`,
    '<noscript>',
    `<button type="submit">Continue to game ${safeCode}</button>`,
    '</noscript>',
    `<button id="fallback" type="submit" style="display:none">Continue to game ${safeCode}</button>`,
    '</form>',
    // Auto-submit after 150ms so the spinner renders first. If the POST
    // doesn't complete within 3s, reveal a manual button so the user
    // isn't stranded on a flaky connection.
    '<script>setTimeout(function(){var f=document.getElementById("f");if(f)f.submit()},150);',
    'setTimeout(function(){var n=document.getElementById("fallback");if(n)n.style.display="block"},3000);</script>',
    '</div></body></html>',
  ].join('');
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenPrefix = token.slice(0, 8);
  const invite = await loadInvite(token);
  const now = Date.now();
  if (!invite) {
    logInvite('warn', 'invite.invalid', tokenPrefix, { method: 'GET' });
    return NextResponse.redirect(new URL('/login?error=Invalid+invite+link', req.url));
  }
  if (invite.expires_at < now) {
    logInvite('info', 'invite.expired', tokenPrefix, { method: 'GET' });
    return NextResponse.redirect(new URL('/login?error=Invite+link+expired', req.url));
  }
  if (invite.used) {
    logInvite('info', 'invite.already_used', tokenPrefix, { method: 'GET' });
    return NextResponse.redirect(new URL(`/j/${invite.invite_code}`, req.url));
  }
  logInvite('info', 'invite.confirm_page_rendered', tokenPrefix);
  return renderConfirmPage(token, invite.invite_code);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenPrefix = token.slice(0, 8);
  const invite = await loadInvite(token);
  const now = Date.now();
  if (!invite) {
    logInvite('warn', 'invite.invalid', tokenPrefix, { method: 'POST' });
    return NextResponse.redirect(new URL('/login?error=Invalid+invite+link', req.url), 303);
  }
  if (invite.expires_at < now) {
    logInvite('info', 'invite.expired', tokenPrefix, { method: 'POST' });
    return NextResponse.redirect(new URL('/login?error=Invite+link+expired', req.url), 303);
  }
  if (invite.used) {
    logInvite('info', 'invite.already_used', tokenPrefix, { method: 'POST' });
    return NextResponse.redirect(new URL(`/j/${invite.invite_code}`, req.url), 303);
  }

  const db = await getDB();
  await db.prepare('UPDATE InviteTokens SET used = 1 WHERE token = ?').bind(token).run();

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

  logInvite('info', 'invite.consumed', tokenPrefix, {
    inviteCode: invite.invite_code,
    gameId: invite.game_id,
  });
  const response = NextResponse.redirect(new URL(`/join/${invite.invite_code}`, req.url), 303);
  await setSessionCookie(response, sessionId, req.nextUrl.hostname);
  return response;
}
