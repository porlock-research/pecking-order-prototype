import type { ActorRefFrom } from "xstate";
import type { Scheduler } from "partywhen";
import type { orchestratorMachine } from "./machines/l2-orchestrator";
import { Events, FactTypes } from "@pecking-order/shared-types";
import { readGoldBalances, insertGameAndPlayers, getPushSubscriptionD1, deletePushSubscriptionD1 } from "./d1-persistence";
import { sendPushNotification } from "./push-send";
import { log } from "./log";
import type { Env } from "./types";

/** Constant-time comparison to prevent timing attacks on secret values. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.byteLength !== bufB.byteLength) {
    // Compare against self to avoid leaking length via early return timing
    crypto.subtle.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.subtle.timingSafeEqual(bufA, bufB);
}

// Wildcard CORS for admin-only DO class methods (scheduled-tasks, cleanup).
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export interface HandlerContext {
  actor: ActorRefFrom<typeof orchestratorMachine> | undefined;
  env: Env;
  scheduler: Scheduler<Env>;
  storage: DurableObjectStorage;
  scheduleManifestAlarms: (manifest: any) => Promise<void>;
  deleteAllStorage: () => Promise<void>;
}

/** Route incoming DO HTTP requests to the appropriate handler. */
export async function routeRequest(ctx: HandlerContext, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === "POST" && path.endsWith("/init")) {
    return handleInit(ctx, req, url);
  }
  if (req.method === "POST" && path.endsWith("/player-joined")) {
    return handlePlayerJoined(ctx, req, url);
  }
  if (req.method === "GET" && path.endsWith("/state")) {
    return handleGetState(ctx);
  }
  if (req.method === "POST" && path.endsWith("/admin")) {
    return handleAdmin(ctx, req);
  }
  if (req.method === "POST" && path.endsWith("/flush-tasks")) {
    return handleFlushTasks(ctx, req);
  }
  if ((req.method === "GET" || req.method === "POST" || req.method === "PUT") && path.endsWith("/scheduled-tasks")) {
    return handleScheduledTasks(ctx, req);
  }
  if (req.method === "POST" && path.endsWith("/cleanup")) {
    return handleCleanup(ctx, req);
  }
  if (req.method === "POST" && path.endsWith("/push-game-entry")) {
    return handlePushGameEntry(ctx, req);
  }

  return new Response("Not Found", { status: 404 });
}

/* ------------------------------------------------------------------ */
/*  Standard game endpoints                                            */
/* ------------------------------------------------------------------ */

async function handleInit(ctx: HandlerContext, req: Request, url: URL): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (ctx.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${ctx.env.AUTH_SECRET}`)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const json = await req.json() as any;
    const pathParts = url.pathname.split('/');
    const gameId = pathParts[pathParts.length - 2];

    // Enrich roster with persistent gold from D1
    const realUserIds = Object.values(json.roster || {}).map((p: any) => p.realUserId).filter(Boolean);
    if (realUserIds.length > 0) {
      const goldBalances = await readGoldBalances(ctx.env.DB, realUserIds);
      for (const p of Object.values(json.roster) as any[]) {
        if (p.realUserId) {
          p.gold = goldBalances.get(p.realUserId) || 0;
        }
      }
    }

    ctx.actor?.send({
      type: Events.System.INIT,
      payload: { roster: json.roster, manifest: json.manifest },
      gameId,
      inviteCode: json.inviteCode || '',
    });

    // Schedule alarms from the manifest — the manifest is the single source
    // of truth for scheduling. All timeline events are pre-scheduled at init
    // time; the subscription never touches scheduling.
    await ctx.scheduleManifestAlarms(json.manifest);

    insertGameAndPlayers(ctx.env.DB, gameId, json.manifest?.gameMode || json.manifest?.scheduling || 'CONFIGURABLE_CYCLE', json.roster || {});

    return new Response(JSON.stringify({ status: "OK" }), { status: 200 });
  } catch (err) {
    log('error', 'L1', 'POST /init failed', { error: String(err) });
    return new Response("Invalid Payload", { status: 400 });
  }
}

async function handlePlayerJoined(ctx: HandlerContext, req: Request, url: URL): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (ctx.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${ctx.env.AUTH_SECRET}`)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const json = await req.json() as any;
    const { playerId, realUserId, personaName, avatarUrl, bio, silver, qaAnswers } = json;

    if (!playerId || !realUserId || !personaName) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Reject if the game has progressed past preGame
    const snapshot = ctx.actor?.getSnapshot();
    if (snapshot && snapshot.value !== 'preGame') {
      log('info', 'L1', 'Rejecting player-joined', { state: JSON.stringify(snapshot.value) });
      return new Response(JSON.stringify({ error: 'GAME_STARTED' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Enrich with persistent gold from D1
    const goldBalances = await readGoldBalances(ctx.env.DB, [realUserId]);
    const gold = goldBalances.get(realUserId) || 0;

    // Send SYSTEM.PLAYER_JOINED to L2
    ctx.actor?.send({
      type: Events.System.PLAYER_JOINED,
      player: { id: playerId, realUserId, personaName, avatarUrl: avatarUrl || '', bio: bio || '', silver: silver || 50, gold, qaAnswers },
    });

    // Insert player into D1 Players table
    const pathParts = url.pathname.split('/');
    const gameId = pathParts[pathParts.length - 2];
    const playerStmt = ctx.env.DB.prepare(
      `INSERT OR IGNORE INTO Players (game_id, player_id, real_user_id, persona_name, avatar_url, status, silver, gold, destiny_id)
       VALUES (?, ?, ?, ?, ?, 'ALIVE', ?, ?, ?)`
    );
    playerStmt.bind(gameId, playerId, realUserId, personaName, avatarUrl || '', silver || 50, gold, null)
      .run()
      .catch((err: any) => log('error', 'L1', 'Failed to insert player', { error: String(err) }));

    return new Response(JSON.stringify({ status: 'OK' }), { status: 200 });
  } catch (err) {
    log('error', 'L1', 'POST /player-joined failed', { error: String(err) });
    return new Response('Invalid Payload', { status: 400 });
  }
}

async function handlePushGameEntry(ctx: HandlerContext, req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (ctx.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${ctx.env.AUTH_SECRET}`)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { userId, inviteCode, token } = await req.json() as any;
    if (!userId || !inviteCode || !token) {
      return new Response(JSON.stringify({ sent: false }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const sub = await getPushSubscriptionD1(ctx.env.DB, userId);
    if (!sub) {
      return new Response(JSON.stringify({ sent: false }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = `${ctx.env.GAME_CLIENT_HOST}/game/${inviteCode}`;
    const result = await sendPushNotification(sub, {
      title: 'Pecking Order',
      body: 'Your game is ready! Tap to play.',
      url,
      token,
    }, ctx.env.VAPID_PRIVATE_JWK);

    if (result === 'expired') {
      await deletePushSubscriptionD1(ctx.env.DB, userId);
    }

    return new Response(JSON.stringify({ sent: result === 'sent' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log('error', 'L1', 'POST /push-game-entry failed', { error: String(err) });
    return new Response(JSON.stringify({ sent: false }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }
}

function handleGetState(ctx: HandlerContext): Response {
  const snapshot = ctx.actor?.getSnapshot();
  const roster = snapshot?.context.roster || {};
  const rosterSummary = Object.fromEntries(
    Object.entries(roster).map(([id, p]: [string, any]) => [id, {
      personaName: p.personaName,
      status: p.status,
      silver: p.silver ?? 0,
      gold: p.gold ?? 0,
    }])
  );
  return new Response(JSON.stringify({
    state: snapshot?.value,
    day: snapshot?.context.dayIndex,
    nextWakeup: null, // Alarm scheduling managed by PartyWhen tasks table (see /scheduled-tasks)
    manifest: snapshot?.context.manifest,
    roster: rosterSummary,
  }, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleFlushTasks(ctx: HandlerContext, req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (ctx.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${ctx.env.AUTH_SECRET}`)) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    (ctx.scheduler as any).querySql([{ sql: "DELETE FROM tasks", params: [] }]);
    await (ctx.scheduler as any).scheduleNextAlarm();
    log('info', 'L1', 'All scheduled tasks flushed');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    log('error', 'L1', 'Flush tasks error', { error: String(err) });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

async function handleScheduledTasks(ctx: HandlerContext, req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (ctx.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${ctx.env.AUTH_SECRET}`)) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    if (req.method === 'PUT') {
      // Insert a single alarm task: { "id": "custom-wake", "time": 1743094800 }
      const body = await req.json() as any;
      if (!body.id || !body.time) {
        return new Response(JSON.stringify({ error: 'id and time (unix seconds) required' }), { status: 400 });
      }
      const callback = JSON.stringify({ type: "self", function: "wakeUpL2" });
      (ctx.scheduler as any).querySql([{
        sql: `INSERT OR REPLACE INTO tasks (id, description, payload, callback, type, time)
              VALUES (?, ?, ?, ?, 'scheduled', ?)`,
        params: [body.id, null, null, callback, Math.floor(body.time)]
      }]);
      await (ctx.scheduler as any).scheduleNextAlarm();
      log('info', 'L1', 'Alarm task inserted', { id: body.id, time: body.time });
      return new Response(JSON.stringify({ ok: true, id: body.id, time: body.time }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
    if (req.method === 'POST') {
      (ctx.scheduler as any).querySql([{ sql: "DELETE FROM tasks", params: [] }]);
      await (ctx.scheduler as any).scheduleNextAlarm();
      log('info', 'L1', 'All scheduled tasks flushed via /scheduled-tasks');
      return new Response(JSON.stringify({ ok: true, flushed: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
    // GET: list tasks
    const rows = (ctx.scheduler as any).querySql([
      { sql: "SELECT id, time FROM tasks ORDER BY time ASC", params: [] }
    ]);
    const tasks = rows?.result || [];
    return new Response(JSON.stringify({ count: tasks.length, tasks }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err: any) {
    log('error', 'L1', 'Scheduled tasks error', { error: String(err) });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

async function handleCleanup(ctx: HandlerContext, req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (ctx.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${ctx.env.AUTH_SECRET}`)) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const gameId = ctx.actor?.getSnapshot()?.context.gameId || 'unknown';
    const cleaned: string[] = [];

    // 1. Delete D1 rows for this game
    if (gameId !== 'unknown') {
      await ctx.env.DB.batch([
        ctx.env.DB.prepare('DELETE FROM GameJournal WHERE game_id = ?').bind(gameId),
        ctx.env.DB.prepare('DELETE FROM Players WHERE game_id = ?').bind(gameId),
        ctx.env.DB.prepare('DELETE FROM Games WHERE id = ?').bind(gameId),
      ]);
      cleaned.push('GameJournal', 'Players', 'Games');
    }

    // 2. Flush scheduled tasks
    (ctx.scheduler as any).querySql([{ sql: "DELETE FROM tasks", params: [] }]);
    cleaned.push('scheduled tasks');

    // 3. Clear DO storage (snapshot, goldCredited, etc.)
    await ctx.deleteAllStorage();
    cleaned.push('DO storage');

    log('info', 'L1', 'Cleanup complete', { gameId, cleaned });
    return new Response(JSON.stringify({ ok: true, cleaned }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err: any) {
    log('error', 'L1', 'Cleanup error', { error: String(err) });
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

async function handleAdmin(ctx: HandlerContext, req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (ctx.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${ctx.env.AUTH_SECRET}`)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json() as any;

    if (!ctx.actor) {
      log('warn', 'L1', 'Admin command received but actor is null', { command: body.type });
      return new Response(JSON.stringify({ error: 'Actor not initialized' }), { status: 503 });
    }

    const snapshot = ctx.actor.getSnapshot();
    const l2State = JSON.stringify(snapshot.value);
    log('info', 'L1', 'Admin command', { command: body.type, l2State, dayIndex: snapshot.context.dayIndex });

    if (body.type === "NEXT_STAGE") {
      ctx.actor.send({ type: Events.Admin.NEXT_STAGE });
      // Re-schedule alarms for dynamic manifests — same pattern as onAlarm().
      // NEXT_STAGE may transition through morningBriefing, resolving a new day.
      // Without this, the new day's timeline events would have no PartyWhen alarms.
      const freshSnap = ctx.actor.getSnapshot();
      const freshManifest = freshSnap?.context?.manifest;
      if (freshManifest?.kind === 'DYNAMIC') {
        await ctx.scheduleManifestAlarms(freshManifest);
      }
    } else if (body.type === "INJECT_TIMELINE_EVENT") {
      ctx.actor.send({
        type: Events.Admin.INJECT_TIMELINE_EVENT,
        payload: { action: body.action, payload: body.payload },
      });
    } else if (body.type === "SEND_GAME_MASTER_MSG") {
      log('info', 'L1', 'GM message', { targetId: body.targetId || 'broadcast', l2State });
      ctx.actor.send({
        type: Events.Admin.INJECT_TIMELINE_EVENT,
        payload: {
          action: "INJECT_PROMPT",
          payload: { text: body.content, targetId: body.targetId },
        },
      });
    } else if (body.type === "ELIMINATE_PLAYER") {
      const playerId = body.playerId;
      if (!playerId || !snapshot.context.roster[playerId]) {
        return new Response(JSON.stringify({ error: 'Invalid playerId' }), { status: 400 });
      }
      if (snapshot.context.roster[playerId].status === 'ELIMINATED') {
        return new Response(JSON.stringify({ error: 'Player already eliminated' }), { status: 400 });
      }
      log('info', 'L1', 'GM eliminating player', { playerId });
      ctx.actor.send({
        type: 'ADMIN.ELIMINATE_PLAYER',
        playerId,
        reason: body.reason || 'Eliminated by Game Master',
      });
    } else if (body.type === "CREDIT_SILVER") {
      const rewards: Record<string, number> = body.rewards;
      if (!rewards || typeof rewards !== 'object' || Object.keys(rewards).length === 0) {
        return new Response(JSON.stringify({ error: 'rewards object required: { "p0": 10, "p1": 5 }' }), { status: 400 });
      }
      log('info', 'L1', 'GM crediting silver', { rewards });
      ctx.actor.send({ type: 'ECONOMY.CREDIT_SILVER', rewards });
      // Emit facts so ticker shows "Game Master awarded X silver to Player"
      for (const [playerId, amount] of Object.entries(rewards)) {
        if (amount > 0) {
          ctx.actor.send({
            type: Events.Fact.RECORD,
            fact: {
              type: FactTypes.SILVER_TRANSFER,
              actorId: 'GAME_MASTER',
              targetId: playerId,
              payload: { amount, gmAward: true },
              timestamp: Date.now(),
            },
          });
        }
      }
    } else if (body.type === "SEND_PLAYER_EVENT") {
      // Simulate a player sending an event (for playtest automation).
      // Same as WS handleMessage but via HTTP — injects senderId.
      const { senderId, event } = body;
      if (!senderId || !event?.type) {
        return new Response(JSON.stringify({ error: 'senderId and event.type required' }), { status: 400 });
      }
      log('info', 'L1', 'Admin sending player event', { senderId, eventType: event.type });
      ctx.actor.send({ ...event, senderId });
    } else {
      return new Response("Unknown Admin Command", { status: 400 });
    }

    return new Response(JSON.stringify({ status: "OK" }), { status: 200 });
  } catch (err) {
    log('error', 'L1', 'Admin request failed', { error: String(err) });
    return new Response("Internal Error", { status: 500 });
  }
}
