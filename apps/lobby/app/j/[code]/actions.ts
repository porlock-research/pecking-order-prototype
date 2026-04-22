'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDB } from '@/lib/db';
import { getSession, generateId, generateToken, getSessionCookieName } from '@/lib/auth';
import { checkAnonymousRateLimit, recordAnonymousCreate } from '@/lib/rate-limit';

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, mirrors lib/auth.ts

function sanitizeHandle(raw: string): string | null {
  const cleaned = raw
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202F]/g, '') // strip control + zero-width
    .trim();
  if (cleaned.length < 1 || cleaned.length > 24) return null;
  return cleaned;
}

export type ClaimSeatError =
  | 'invalid_handle'
  | 'rate_limited'
  | 'game_not_found'
  | 'game_not_accepting'
  | 'internal';

export interface ClaimSeatResult {
  ok: boolean;
  error?: ClaimSeatError;
}

export async function claimSeat(
  code: string,
  rawHandle: string,
): Promise<ClaimSeatResult> {
  const handle = sanitizeHandle(rawHandle);
  if (!handle) return { ok: false, error: 'invalid_handle' };

  const db = await getDB();

  // Game lookup + status check
  const game = await db
    .prepare('SELECT id, status FROM GameSessions WHERE invite_code = ?')
    .bind(code.toUpperCase())
    .first<{ id: string; status: string }>();
  if (!game) return { ok: false, error: 'game_not_found' };
  if (game.status !== 'RECRUITING' && game.status !== 'READY') {
    return { ok: false, error: 'game_not_accepting' };
  }

  // If already authenticated, hand off to the right place without creating a new user.
  const existing = await getSession();
  if (existing) {
    const already = await db
      .prepare('SELECT id FROM Invites WHERE game_id = ? AND accepted_by = ?')
      .bind(game.id, existing.userId)
      .first();
    if (already) {
      redirect(`/play/${code}`);
    }
    // Has a session but not yet in this game — keep the authed user in the
    // frictionless flow by reusing their session. Update their contact_handle
    // to whatever they just typed so the persona-pick wizard uses the new
    // name (rather than a stale handle from a previous login). Then continue
    // to /join/${code} for persona pick — the wizard finds their session
    // and never shows a login screen.
    await db
      .prepare('UPDATE Users SET contact_handle = ? WHERE id = ?')
      .bind(handle, existing.userId)
      .run();
    redirect(`/join/${code}`);
  }

  // Unauth path — rate-limit by IP.
  const hdrs = await headers();
  const ip =
    hdrs.get('cf-connecting-ip') ||
    hdrs.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown';
  const rate = await checkAnonymousRateLimit(db, ip);
  if (!rate.allowed) return { ok: false, error: 'rate_limited' };

  // Atomic user + session insert via db.batch().
  // Users.email is NOT NULL (see migration 0015), so use an RFC-2606-reserved
  // sentinel. The @frictionless.local domain can never collect a real login,
  // and the UUID prefix avoids collisions. contactHandle is the display label.
  const userId = generateId();
  const sessionId = generateToken();
  const sentinelEmail = `anon-${crypto.randomUUID()}@frictionless.local`;
  const now = Date.now();

  try {
    await db.batch([
      db
        .prepare('INSERT INTO Users (id, email, contact_handle, created_at) VALUES (?, ?, ?, ?)')
        .bind(userId, sentinelEmail, handle, now),
      db
        .prepare('INSERT INTO Sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
        .bind(sessionId, userId, now + SESSION_EXPIRY_MS, now),
    ]);
  } catch (err) {
    console.error('[claimSeat] atomic insert failed:', err);
    return { ok: false, error: 'internal' };
  }

  // Record rate-limit tally AFTER successful commit.
  await recordAnonymousCreate(db, ip);

  // Set cookie.
  const cookieName = await getSessionCookieName();
  const cookieStore = await cookies();
  cookieStore.set(cookieName, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_EXPIRY_MS / 1000,
    path: '/',
  });

  // Redirect into the existing persona wizard.
  redirect(`/join/${code}`);
}
