'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDB, getEnv } from './db';
import { sendEmail } from './email';

const DEFAULT_SESSION_COOKIE = 'po_session';

async function getSessionCookieName(): Promise<string> {
  try {
    const env = await getEnv();
    return (env.SESSION_COOKIE_NAME as string) || DEFAULT_SESSION_COOKIE;
  } catch {
    return DEFAULT_SESSION_COOKIE;
  }
}
const MAGIC_LINK_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Helpers ──────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    code += chars[b % chars.length];
  }
  return code;
}

export { generateId, generateToken, generateInviteCode, getSessionCookieName };

// ── Session Management ───────────────────────────────────────────────────

export interface SessionUser {
  userId: string;
  email: string;
  displayName: string | null;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookieName = await getSessionCookieName();
  const sessionId = cookieStore.get(cookieName)?.value;
  if (!sessionId) return null;

  const db = await getDB();
  const now = Date.now();

  const row = await db
    .prepare(
      `SELECT s.id, s.user_id, u.email, u.display_name
       FROM Sessions s
       JOIN Users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`
    )
    .bind(sessionId, now)
    .first<{ id: string; user_id: string; email: string; display_name: string | null }>();

  if (!row) return null;

  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
  };
}

export async function requireAuth(redirectTo?: string): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    const loginUrl = redirectTo ? `/login?next=${encodeURIComponent(redirectTo)}` : '/login';
    redirect(loginUrl);
  }
  return session;
}

// ── Magic Link ───────────────────────────────────────────────────────────

export async function sendMagicLink(
  email: string,
  next?: string,
  options?: { resendApiKey?: string; lobbyHost?: string },
): Promise<{ link?: string; sent?: boolean; error?: string }> {
  const db = await getDB();
  const now = Date.now();
  const normalizedEmail = email.toLowerCase().trim();

  // Upsert user
  const existingUser = await db
    .prepare('SELECT id FROM Users WHERE email = ?')
    .bind(normalizedEmail)
    .first<{ id: string }>();

  if (!existingUser) {
    const userId = generateId();
    await db
      .prepare('INSERT INTO Users (id, email, created_at) VALUES (?, ?, ?)')
      .bind(userId, normalizedEmail, now)
      .run();
  }

  // Create magic link token
  const token = generateToken();
  await db
    .prepare('INSERT INTO MagicLinks (token, email, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(token, normalizedEmail, now + MAGIC_LINK_EXPIRY_MS, now)
    .run();

  const verifyPath = `/login/verify?token=${token}${next ? `&next=${encodeURIComponent(next)}` : ''}`;

  // Send email when Resend API key is available
  if (options?.resendApiKey && options?.lobbyHost) {
    const fullLink = `${options.lobbyHost}${verifyPath}`;
    const result = await sendEmail(
      normalizedEmail,
      'Your Pecking Order Login Link',
      `<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #d4af37; margin-bottom: 16px;">Pecking Order</h2>
        <p style="color: #333; margin-bottom: 24px;">Click below to sign in:</p>
        <a href="${fullLink}" style="display: inline-block; background: #d4af37; color: #1a0025; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold;">Sign In</a>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">This link expires in 5 minutes.</p>
      </div>`,
      options.resendApiKey,
    );
    if (result.success) return { sent: true };
    // Fall through to inline display if email fails
    console.error('[Auth] Email send failed, falling back to inline link:', result.error);
  }

  // Fallback: return link for inline display (dev mode / email failure)
  return { link: verifyPath };
}

export async function verifyMagicLink(
  token: string
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const db = await getDB();
  const now = Date.now();

  // Look up token
  const magicLink = await db
    .prepare('SELECT token, email, expires_at, used FROM MagicLinks WHERE token = ?')
    .bind(token)
    .first<{ token: string; email: string; expires_at: number; used: number }>();

  if (!magicLink) {
    return { success: false, error: 'Invalid link' };
  }

  if (magicLink.used) {
    return { success: false, error: 'Link already used' };
  }

  if (magicLink.expires_at < now) {
    return { success: false, error: 'Link expired' };
  }

  // Mark as used
  await db.prepare('UPDATE MagicLinks SET used = 1 WHERE token = ?').bind(token).run();

  // Find user
  const user = await db
    .prepare('SELECT id FROM Users WHERE email = ?')
    .bind(magicLink.email)
    .first<{ id: string }>();

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // Update last login
  await db.prepare('UPDATE Users SET last_login_at = ? WHERE id = ?').bind(now, user.id).run();

  // Create session
  const sessionId = generateToken();
  await db
    .prepare('INSERT INTO Sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(sessionId, user.id, now + SESSION_EXPIRY_MS, now)
    .run();

  // Return sessionId — caller (Route Handler) sets the cookie on the response
  return { success: true, sessionId };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const cookieName = await getSessionCookieName();
  const sessionId = cookieStore.get(cookieName)?.value;

  if (sessionId) {
    const db = await getDB();
    await db.prepare('DELETE FROM Sessions WHERE id = ?').bind(sessionId).run();
  }

  cookieStore.delete(cookieName);
  redirect('/login');
}
