import type { D1 } from './db';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10;                    // 10 anonymous creates per hour per IP

export async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
}

export async function checkAnonymousRateLimit(
  db: D1,
  ip: string,
): Promise<RateLimitResult> {
  const ipHash = await hashIp(ip);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const row = await db
    .prepare(
      'SELECT COUNT(*) as count FROM AnonymousCreates WHERE ip_hash = ? AND created_at > ?',
    )
    .bind(ipHash, windowStart)
    .first<{ count: number }>();

  const count = row?.count ?? 0;
  if (count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: RATE_LIMIT_WINDOW_MS };
  }
  return { allowed: true };
}

export async function recordAnonymousCreate(db: D1, ip: string): Promise<void> {
  const ipHash = await hashIp(ip);
  await db
    .prepare('INSERT INTO AnonymousCreates (ip_hash, created_at) VALUES (?, ?)')
    .bind(ipHash, Date.now())
    .run();
}
