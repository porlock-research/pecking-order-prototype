import { savePushSubscriptionD1, deletePushSubscriptionD1, getAllPushSubscriptionsD1 } from "./d1-persistence";
import { sendPushNotification } from "./push-send";
import { log } from "./log";
import { timingSafeEqual } from "./http-handlers";
import type { Env } from "./types";

// Dynamic CORS that reflects the requesting origin. Required because browsers
// reject wildcard ACAO when credentials are included (Sentry's fetch wrapping
// adds credentials: 'include').
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle global HTTP routes that don't require a Durable Object.
 * Returns a Response if matched, or null to fall through to DO routing.
 */
export async function handleGlobalRoutes(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  const DYNAMIC_CORS = corsHeaders(request);

  // Global HTTP push subscription endpoints (not routed to DO)
  if (url.pathname === '/api/push/subscribe') {
    return handlePushSubscribe(request, env, DYNAMIC_CORS);
  }

  // Admin: query GameJournal for admin dashboard
  if (url.pathname === '/api/admin/journal') {
    return handleAdminJournal(request, env, DYNAMIC_CORS);
  }

  // Admin: wipe all D1 tables (dev reset — requires ALLOW_DB_RESET=true in env)
  if (url.pathname === '/api/admin/reset-db') {
    return handleResetDb(request, env, DYNAMIC_CORS);
  }

  // Admin: broadcast push notification to all subscribers
  if (url.pathname === '/api/push/broadcast') {
    return handlePushBroadcast(request, env, DYNAMIC_CORS);
  }

  // VAPID public key — static env var, no DO needed
  if (url.pathname.endsWith('/vapid-key')) {
    return new Response(JSON.stringify({ publicKey: env.VAPID_PUBLIC_KEY }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...DYNAMIC_CORS },
    });
  }

  return null; // Not a global route — fall through to DO routing
}

async function handlePushSubscribe(request: Request, env: Env, DYNAMIC_CORS: Record<string, string>): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: DYNAMIC_CORS });
  }

  // Authenticate via JWT
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: DYNAMIC_CORS });
  }
  const token = authHeader.slice(7);
  let userId: string;
  try {
    const { verifyGameToken } = await import('@pecking-order/auth');
    const payload = await verifyGameToken(token, env.AUTH_SECRET);
    userId = payload.sub;
  } catch {
    return new Response('Invalid token', { status: 401, headers: DYNAMIC_CORS });
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json() as { endpoint: string; keys: { p256dh: string; auth: string } };
      if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
        return new Response('Invalid subscription', { status: 400, headers: DYNAMIC_CORS });
      }
      await savePushSubscriptionD1(env.DB, userId, body);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...DYNAMIC_CORS },
      });
    } catch (err) {
      log('error', 'Push API', 'Save failed', { error: String(err) });
      return new Response('Server error', { status: 500, headers: DYNAMIC_CORS });
    }
  }

  if (request.method === 'DELETE') {
    try {
      await deletePushSubscriptionD1(env.DB, userId);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...DYNAMIC_CORS },
      });
    } catch (err) {
      log('error', 'Push API', 'Delete failed', { error: String(err) });
      return new Response('Server error', { status: 500, headers: DYNAMIC_CORS });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: DYNAMIC_CORS });
}

async function handleAdminJournal(request: Request, env: Env, DYNAMIC_CORS: Record<string, string>): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: DYNAMIC_CORS });
  }
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: DYNAMIC_CORS });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !timingSafeEqual(authHeader, `Bearer ${env.AUTH_SECRET}`)) {
    return new Response('Unauthorized', { status: 401, headers: DYNAMIC_CORS });
  }

  try {
    const url = new URL(request.url);
    const gameId = url.searchParams.get('game_id');
    if (!gameId) {
      return new Response(JSON.stringify({ error: 'game_id required' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...DYNAMIC_CORS },
      });
    }

    const day = url.searchParams.get('day');
    const type = url.searchParams.get('type');
    const player = url.searchParams.get('player');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500'), 1000);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let sql = 'SELECT * FROM GameJournal WHERE game_id = ?';
    const bindings: any[] = [gameId];

    if (day !== null && day !== '' && day !== 'all') {
      sql += ' AND day_index = ?';
      bindings.push(parseInt(day));
    }

    if (type && type !== 'all') {
      sql += ' AND event_type = ?';
      bindings.push(type);
    }

    if (player) {
      sql += ' AND (actor_id = ? OR target_id = ?)';
      bindings.push(player, player);
    }

    sql += ' ORDER BY timestamp ASC LIMIT ? OFFSET ?';
    bindings.push(limit, offset);

    const result = await env.DB.prepare(sql).bind(...bindings).all();

    return new Response(JSON.stringify({
      entries: result.results || [],
      total: result.results?.length || 0,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...DYNAMIC_CORS },
    });
  } catch (err) {
    log('error', 'Admin', 'Journal query failed', { error: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...DYNAMIC_CORS },
    });
  }
}

async function handleResetDb(request: Request, env: Env, DYNAMIC_CORS: Record<string, string>): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: DYNAMIC_CORS });
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: DYNAMIC_CORS });
  }

  if ((env as any).ALLOW_DB_RESET !== 'true') {
    return new Response('Forbidden — ALLOW_DB_RESET not enabled in this environment', { status: 403, headers: DYNAMIC_CORS });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !timingSafeEqual(authHeader, `Bearer ${env.AUTH_SECRET}`)) {
    return new Response('Unauthorized', { status: 401, headers: DYNAMIC_CORS });
  }

  try {
    // Allowlist prevents SQL injection — only these table names are accepted
    const ALLOWED_TABLES = ['GameJournal', 'Players', 'Games', 'PushSubscriptions', 'UserWallets'];
    // FK-safe default order (children before parents)
    const DEFAULT_ORDER = ['GameJournal', 'Players', 'Games', 'PushSubscriptions', 'UserWallets'];

    let requested: string[] = DEFAULT_ORDER;
    try {
      const body = await request.json() as any;
      if (Array.isArray(body?.tables) && body.tables.length > 0) {
        const valid = body.tables.filter((t: string) => ALLOWED_TABLES.includes(t));
        if (valid.length === 0) {
          return new Response(JSON.stringify({ error: `Invalid tables. Allowed: ${ALLOWED_TABLES.join(', ')}` }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...DYNAMIC_CORS },
          });
        }
        // Sort by FK-safe order
        requested = DEFAULT_ORDER.filter(t => valid.includes(t));
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    for (const table of requested) {
      await env.DB.prepare(`DELETE FROM ${table}`).run();
    }
    log('info', 'Admin', 'D1 tables wiped', { tables: requested });
    return new Response(JSON.stringify({ ok: true, tablesCleared: requested }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...DYNAMIC_CORS },
    });
  } catch (err) {
    log('error', 'Admin', 'DB reset failed', { error: String(err) });
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...DYNAMIC_CORS },
    });
  }
}

async function handlePushBroadcast(request: Request, env: Env, DYNAMIC_CORS: Record<string, string>): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: DYNAMIC_CORS });
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: DYNAMIC_CORS });
  }
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !timingSafeEqual(authHeader, `Bearer ${env.AUTH_SECRET}`)) {
    return new Response('Unauthorized', { status: 401, headers: DYNAMIC_CORS });
  }

  try {
    let payload: Record<string, string> = { title: 'Pecking Order', body: 'A new update is available! Tap to refresh.' };
    try {
      const body = await request.json() as any;
      if (body?.title) payload.title = body.title;
      if (body?.body) payload.body = body.body;
    } catch { /* use defaults */ }

    const subs = await getAllPushSubscriptionsD1(env.DB);
    log('info', 'Push API', 'Broadcasting to all subscribers', { count: subs.length });

    let sent = 0;
    let expired = 0;
    let errors = 0;
    await Promise.allSettled(subs.map(async (sub) => {
      const result = await sendPushNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
        env.VAPID_PRIVATE_JWK,
      );
      if (result === 'sent') sent++;
      else if (result === 'expired') {
        expired++;
        await deletePushSubscriptionD1(env.DB, sub.userId);
      } else errors++;
    }));

    return new Response(JSON.stringify({ ok: true, total: subs.length, sent, expired, errors }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...DYNAMIC_CORS },
    });
  } catch (err) {
    log('error', 'Push API', 'Broadcast failed', { error: String(err) });
    return new Response('Server error', { status: 500, headers: DYNAMIC_CORS });
  }
}
