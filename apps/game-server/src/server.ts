import { Server, routePartykitRequest, Connection, ConnectionContext } from "partyserver";
import { createActor, ActorRefFrom } from "xstate";
import { orchestratorMachine } from "./machines/l2-orchestrator";
import { Scheduler } from "partywhen";
import type { TickerMessage } from "@pecking-order/shared-types";
import { Events, FactTypes, ALLOWED_CLIENT_EVENTS as CLIENT_EVENTS } from "@pecking-order/shared-types";
import { isJournalable, persistFactToD1, querySpyDms, insertGameAndPlayers, updateGameEnd, savePushSubscriptionD1, deletePushSubscriptionD1 } from "./d1-persistence";
import { flattenState, factToTicker, stateToTicker, buildDebugSummary, broadcastTicker, broadcastDebugTicker } from "./ticker";
import { extractCartridges, extractL3Context, buildSyncPayload, broadcastSync } from "./sync";
import { stateToPush, handleFactPush, pushBroadcast, type PushContext } from "./push-triggers";

const STORAGE_KEY = "game_state_snapshot";

export interface Env {
  GameServer: DurableObjectNamespace;
  DB: D1Database;
  AUTH_SECRET: string;
  AXIOM_DATASET: string;
  AXIOM_TOKEN?: string;
  AXIOM_ORG_ID?: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_JWK: string;
  GAME_CLIENT_HOST: string;
}

export class GameServer extends Server<Env> {
  private actor: ActorRefFrom<typeof orchestratorMachine> | undefined;
  private lastKnownChatLog: any[] = [];
  private lastBroadcastState: string = '';
  private sentPushKeys = new Set<string>();
  private lastKnownDmsOpen: boolean = false;
  private lastKnownGroupChatOpen: boolean = false;
  private tickerHistory: TickerMessage[] = [];
  private lastDebugSummary: string = '';
  private scheduler: Scheduler<Env>;
  private connectedPlayers = new Map<string, Set<string>>();  // playerId → Set<connectionId>

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.scheduler = new Scheduler(ctx, env);
    (this.scheduler as any).wakeUpL2 = this.wakeUpL2.bind(this);
  }

  async wakeUpL2() {
    console.log("[L1] PartyWhen Task Triggered: wakeUpL2");
    this.actor?.send({ type: Events.System.WAKEUP });
  }

  /** Build a PushContext for the push-triggers module. */
  private getPushContext(): PushContext {
    const snapshot = this.actor?.getSnapshot();
    return {
      roster: snapshot?.context.roster || {},
      db: this.env.DB,
      vapidPrivateJwk: this.env.VAPID_PRIVATE_JWK,
      clientHost: this.env.GAME_CLIENT_HOST || 'https://pecking-order-client.pages.dev',
      inviteCode: snapshot?.context.inviteCode || '',
    };
  }

  // --- PRESENCE ---

  private getOnlinePlayerIds(): string[] {
    return Array.from(this.connectedPlayers.keys());
  }

  private broadcastPresence(): void {
    const msg = JSON.stringify({
      type: Events.Presence.UPDATE,
      onlinePlayers: this.getOnlinePlayerIds(),
    });
    for (const ws of this.getConnections()) {
      ws.send(msg);
    }
  }

  // --- 1. LIFECYCLE ---

  async onStart() {
    // Debug: PartyWhen persistence check
    try {
      const tables = this.ctx.storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'");
      console.log("[L1] Debug: Tasks table exists?", [...tables]);
      const currentAlarm = await this.ctx.storage.getAlarm();
      console.log("[L1] Debug: Current Alarm:", currentAlarm ? new Date(currentAlarm).toISOString() : "None");
    } catch (e) {
      console.error("[L1] Debug: SQL/Alarm Check Failed", e);
    }

    const snapshotStr = await this.ctx.storage.get<string>(STORAGE_KEY);

    // L1 .provide() — override actions that need DO context (D1, WebSocket, push)
    const machineWithPersistence = orchestratorMachine.provide({
      actions: {
        persistFactToD1: ({ event }: any) => {
          if (event.type !== Events.Fact.RECORD) return;
          const fact = event.fact;

          if (!isJournalable(fact.type)) {
            console.log(`[L1] Fact received (sync-only, not journaled): ${fact.type}`);
            return;
          }

          console.log(`[L1] Persisting Fact to D1: ${fact.type}`);
          const snapshot = this.actor?.getSnapshot();
          const gameId = snapshot?.context.gameId || 'unknown';
          const dayIndex = snapshot?.context.dayIndex || 0;

          persistFactToD1(this.env.DB, gameId, dayIndex, fact);

          // Perk results: deliver confirmation back to the player
          if (fact.type === FactTypes.PERK_USED) {
            this.handlePerkResult(fact, gameId);
          }

          // Ticker: convert fact to humanized message
          const roster = snapshot?.context.roster || {};
          const tickerMsg = factToTicker(fact, roster);
          if (tickerMsg) {
            this.tickerHistory = broadcastTicker(tickerMsg, this.tickerHistory, () => this.getConnections());
          }

          // Push notifications for significant facts
          const manifest = snapshot?.context.manifest;
          handleFactPush(this.getPushContext(), fact, manifest);
        },
        sendDmRejection: ({ event }: any) => {
          if (event.type !== Events.Rejection.DM) return;
          this.sendToPlayer(event.senderId, { type: Events.Rejection.DM, reason: event.reason });
        },
        sendSilverTransferRejection: ({ event }: any) => {
          if (event.type !== Events.Rejection.SILVER_TRANSFER) return;
          this.sendToPlayer(event.senderId, { type: Events.Rejection.SILVER_TRANSFER, reason: event.reason });
        },
        sendChannelRejection: ({ event }: any) => {
          if (event.type !== Events.Rejection.CHANNEL) return;
          this.sendToPlayer(event.senderId, { type: Events.Rejection.CHANNEL, reason: event.reason });
        },
        deliverPerkResult: ({ event }: any) => {
          if (event.type !== Events.Perk.RESULT && event.type !== Events.Rejection.PERK) return;
          this.sendToPlayer(event.senderId, event);
        },
      }
    });

    // Restore or fresh boot
    if (snapshotStr) {
      console.log(`[L1] Resuming Game`);
      const storedData = JSON.parse(snapshotStr);
      let l2Snapshot = storedData;
      let restoredChatLog = undefined;

      if (storedData.l2) {
        l2Snapshot = storedData.l2;
        restoredChatLog = storedData.l3Context?.chatLog;
      }
      if (restoredChatLog) {
        l2Snapshot.context.restoredChatLog = restoredChatLog;
        this.lastKnownChatLog = restoredChatLog;
      }
      if (storedData.tickerHistory) {
        this.tickerHistory = storedData.tickerHistory;
      }

      try {
        this.actor = createActor(machineWithPersistence, { snapshot: l2Snapshot });
        const restoredState = JSON.stringify(this.actor.getSnapshot().value);
        if (restoredState.includes('activeSession') && !this.actor.getSnapshot().children['l3-session']) {
          console.warn('[L1] L3 missing after restore — snapshot was corrupted. Clearing state for fresh start.');
          await this.ctx.storage.delete(STORAGE_KEY);
          this.actor = createActor(machineWithPersistence);
        }
      } catch (err) {
        console.error('[L1] Snapshot restore failed — starting fresh:', err);
        await this.ctx.storage.delete(STORAGE_KEY);
        this.actor = createActor(machineWithPersistence);
      }
    } else {
      console.log(`[L1] Fresh Boot`);
      this.actor = createActor(machineWithPersistence);
    }

    // Subscribe: auto-save, broadcast, ticker, push
    this.actor.subscribe(async (snapshot) => {
      const { l3Context, l3Snapshot, chatLog } = extractL3Context(snapshot, this.lastKnownChatLog);
      if (l3Context.chatLog) this.lastKnownChatLog = l3Context.chatLog;

      // Debug logging
      const l2StateStr = flattenState(snapshot.value);
      const l3StateStr = l3Snapshot ? flattenState(l3Snapshot.value) : 'ABSENT';
      console.log(`[L1] L2=${l2StateStr} | L3=${l3StateStr} | Day=${snapshot.context.dayIndex}`);

      const debugSummary = buildDebugSummary(snapshot, l3Snapshot);
      if (debugSummary !== this.lastDebugSummary) {
        this.lastDebugSummary = debugSummary;
        console.log(`[L1] Debug: ${debugSummary}`);
        broadcastDebugTicker(debugSummary, () => this.getConnections());
      }

      // A. Save state to disk
      const persistedSnapshot = this.actor?.getPersistedSnapshot();
      this.ctx.storage.put(STORAGE_KEY, JSON.stringify({
        l2: persistedSnapshot,
        l3Context: { chatLog: l3Context.chatLog ?? this.lastKnownChatLog },
        tickerHistory: this.tickerHistory,
      }));

      // B. Schedule via PartyWhen
      const nextWakeup = snapshot.context.nextWakeup;
      if (nextWakeup && nextWakeup > Date.now()) {
        await this.scheduler.scheduleTask({
          id: `wakeup-${Date.now()}`,
          type: "scheduled",
          time: new Date(nextWakeup),
          callback: { type: "self", function: "wakeUpL2" }
        });
      }

      // C. Broadcast SYSTEM.SYNC to all clients
      const cartridges = extractCartridges(snapshot);
      broadcastSync({ snapshot, l3Context, chatLog, cartridges }, () => this.getConnections(), this.getOnlinePlayerIds());

      // D. Ticker: detect state transitions + push notifications
      const l3StateJson = l3Snapshot ? JSON.stringify(l3Snapshot.value) : '';
      const currentStateStr = JSON.stringify(snapshot.value) + l3StateJson;
      if (currentStateStr !== this.lastBroadcastState) {
        const tickerMsg = stateToTicker(currentStateStr, snapshot.context);
        if (tickerMsg) {
          this.tickerHistory = broadcastTicker(tickerMsg, this.tickerHistory, () => this.getConnections());
        }

        // Push notifications for phase transitions (deduplicated via Set)
        const manifest = snapshot.context.manifest;
        const pushPayload = stateToPush(currentStateStr, snapshot.context, manifest);
        if (pushPayload) {
          const pushKey = `${pushPayload.tag}:${pushPayload.body}`;
          if (!this.sentPushKeys.has(pushKey)) {
            this.sentPushKeys.add(pushKey);
            pushBroadcast(this.getPushContext(), pushPayload).catch(err => console.error('[L1] [Push] Error:', err));
          }
        }

        this.lastBroadcastState = currentStateStr;
      }

      // E. Update D1 when game ends
      if (currentStateStr.includes('gameOver') && snapshot.context.gameId) {
        updateGameEnd(this.env.DB, snapshot.context.gameId, snapshot.context.roster);
      }

      // F. Ticker: detect DM open/close changes
      const currentDmsOpen = l3Context.dmsOpen ?? false;
      if (currentDmsOpen !== this.lastKnownDmsOpen) {
        this.lastKnownDmsOpen = currentDmsOpen;
        this.tickerHistory = broadcastTicker({
          id: crypto.randomUUID(),
          text: currentDmsOpen ? 'DMs are now open!' : 'DMs are now closed.',
          category: 'SYSTEM',
          timestamp: Date.now(),
        }, this.tickerHistory, () => this.getConnections());
      }

      // G. Ticker: detect group chat open/close changes
      const currentGroupChatOpen = l3Context.groupChatOpen ?? false;
      if (currentGroupChatOpen !== this.lastKnownGroupChatOpen) {
        this.lastKnownGroupChatOpen = currentGroupChatOpen;
        this.tickerHistory = broadcastTicker({
          id: crypto.randomUUID(),
          text: currentGroupChatOpen ? 'Group chat is now open!' : 'Group chat is now closed.',
          category: 'SYSTEM',
          timestamp: Date.now(),
        }, this.tickerHistory, () => this.getConnections());
      }
    });

    this.actor.start();
  }

  // --- 2. HTTP HANDLERS ---

  async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "POST" && path.endsWith("/init")) {
      return this.handleInit(req, url);
    }
    if (req.method === "GET" && path.endsWith("/state")) {
      return this.handleGetState();
    }
    if (req.method === "POST" && path.endsWith("/admin")) {
      return this.handleAdmin(req);
    }
    if (req.method === "GET" && path.endsWith("/vapid-key")) {
      return new Response(JSON.stringify({ publicKey: this.env.VAPID_PUBLIC_KEY }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  private async handleInit(req: Request, url: URL): Promise<Response> {
    const authHeader = req.headers.get('Authorization');
    if (this.env.AUTH_SECRET && authHeader !== `Bearer ${this.env.AUTH_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const json = await req.json() as any;
      const pathParts = url.pathname.split('/');
      const gameId = pathParts[pathParts.length - 2];

      this.actor?.send({
        type: Events.System.INIT,
        payload: { roster: json.roster, manifest: json.manifest },
        gameId,
        inviteCode: json.inviteCode || '',
      });

      insertGameAndPlayers(this.env.DB, gameId, json.manifest?.gameMode || 'PECKING_ORDER', json.roster || {});

      return new Response(JSON.stringify({ status: "OK" }), { status: 200 });
    } catch (err) {
      console.error("[L1] POST /init failed:", err);
      return new Response("Invalid Payload", { status: 400 });
    }
  }

  private handleGetState(): Response {
    const snapshot = this.actor?.getSnapshot();
    const roster = snapshot?.context.roster || {};
    const rosterSummary = Object.fromEntries(
      Object.entries(roster).map(([id, p]: [string, any]) => [id, { personaName: p.personaName, status: p.isAlive ? 'ALIVE' : 'ELIMINATED' }])
    );
    return new Response(JSON.stringify({
      state: snapshot?.value,
      day: snapshot?.context.dayIndex,
      nextWakeup: snapshot?.context.nextWakeup ? new Date(snapshot.context.nextWakeup).toISOString() : null,
      manifest: snapshot?.context.manifest,
      roster: rosterSummary,
    }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  private async handleAdmin(req: Request): Promise<Response> {
    // Auth check — require Bearer token matching AUTH_SECRET
    const authHeader = req.headers.get('Authorization');
    if (this.env.AUTH_SECRET && authHeader !== `Bearer ${this.env.AUTH_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const body = await req.json() as any;
      console.log(`[L1] Admin Command: ${body.type}`);

      if (body.type === "NEXT_STAGE") {
        this.actor?.send({ type: Events.Admin.NEXT_STAGE });
      } else if (body.type === "INJECT_TIMELINE_EVENT") {
        this.actor?.send({
          type: Events.Admin.INJECT_TIMELINE_EVENT,
          payload: { action: body.action, payload: body.payload },
        });
      } else if (body.type === "SEND_GAME_MASTER_MSG") {
        this.actor?.send({
          type: Events.Admin.INJECT_TIMELINE_EVENT,
          payload: {
            action: "INJECT_PROMPT",
            payload: { text: body.content, targetId: body.targetId },
          },
        });
      } else {
        return new Response("Unknown Admin Command", { status: 400 });
      }

      return new Response(JSON.stringify({ status: "OK" }), { status: 200 });
    } catch (err) {
      console.error("[L1] Admin request failed:", err);
      return new Response("Internal Error", { status: 500 });
    }
  }

  // --- 3. WEBSOCKET ---

  async onConnect(ws: Connection, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    const roster = this.actor?.getSnapshot().context.roster || {};

    let playerId: string | null = null;
    const token = url.searchParams.get("token");
    if (token) {
      try {
        const { verifyGameToken } = await import("@pecking-order/auth");
        const payload = await verifyGameToken(token, this.env.AUTH_SECRET);
        playerId = payload.playerId;
      } catch (err) {
        console.log(`[L1] JWT verification failed:`, err);
        ws.close(4003, "Invalid token");
        return;
      }
    } else {
      playerId = url.searchParams.get("playerId");
    }

    if (!playerId || !roster[playerId]) {
      console.log(`[L1] Rejecting connection: Invalid Player ID ${playerId}`);
      ws.close(4001, "Invalid Player ID");
      return;
    }

    ws.setState({ playerId });
    console.log(`[L1] Player Connected: ${playerId}${token ? ' (JWT)' : ' (legacy)'}`);

    // Track connection for presence
    const connId = ws.id;
    const existing = this.connectedPlayers.get(playerId) || new Set();
    existing.add(connId);
    this.connectedPlayers.set(playerId, existing);

    const snapshot = this.actor?.getSnapshot();
    if (snapshot) {
      const { l3Context, chatLog } = extractL3Context(snapshot, this.lastKnownChatLog);
      const cartridges = extractCartridges(snapshot);
      const onlinePlayers = this.getOnlinePlayerIds();
      ws.send(JSON.stringify(buildSyncPayload({ snapshot, l3Context, chatLog, cartridges }, playerId, onlinePlayers)));

      if (this.tickerHistory.length > 0) {
        ws.send(JSON.stringify({ type: Events.Ticker.HISTORY, messages: this.tickerHistory }));
      }
      if (this.lastDebugSummary) {
        ws.send(JSON.stringify({ type: Events.Ticker.DEBUG, summary: this.lastDebugSummary }));
      }
    }

    this.broadcastPresence();
  }

  onClose(ws: Connection) {
    const state = ws.state as { playerId: string } | null;
    if (!state?.playerId) return;

    const conns = this.connectedPlayers.get(state.playerId);
    if (conns) {
      conns.delete(ws.id);
      if (conns.size === 0) {
        this.connectedPlayers.delete(state.playerId);
      }
    }
    this.broadcastPresence();
  }

  private static ALLOWED_CLIENT_EVENTS = CLIENT_EVENTS as readonly string[];

  onMessage(ws: Connection, message: string) {
    try {
      const event = JSON.parse(message);
      const state = ws.state as { playerId: string } | null;

      console.log(`[L1] Received message from ${state?.playerId}:`, JSON.stringify(event));

      if (!state?.playerId) {
        console.warn("[L1] Message received from connection without playerId");
        ws.close(4001, "Missing Identity");
        return;
      }

      // Presence: relay typing indicators without touching XState
      if (event.type === Events.Presence.TYPING) {
        const msg = JSON.stringify({
          type: Events.Presence.TYPING,
          playerId: state.playerId,
          channel: event.channel || 'MAIN',
        });
        for (const other of this.getConnections()) {
          if (other !== ws) other.send(msg);
        }
        return;
      }
      if (event.type === Events.Presence.STOP_TYPING) {
        const msg = JSON.stringify({
          type: Events.Presence.STOP_TYPING,
          playerId: state.playerId,
          channel: event.channel || 'MAIN',
        });
        for (const other of this.getConnections()) {
          if (other !== ws) other.send(msg);
        }
        return;
      }

      const isAllowed = GameServer.ALLOWED_CLIENT_EVENTS.includes(event.type)
        || (typeof event.type === 'string' && event.type.startsWith(Events.Vote.PREFIX))
        || (typeof event.type === 'string' && event.type.startsWith(Events.Game.PREFIX))
        || (typeof event.type === 'string' && event.type.startsWith(Events.Activity.PREFIX));
      if (!isAllowed) {
        console.warn(`[L1] Rejected event type from client: ${event.type}`);
        return;
      }

      this.actor?.send({ ...event, senderId: state.playerId });
    } catch (err) {
      console.error("[L1] Error processing message:", err);
    }
  }

  // --- 4. ALARM ---

  async onAlarm() {
    await this.scheduler.alarm();
  }

  // --- Helpers ---

  /** Send a JSON message to a specific player's WebSocket connection. */
  private sendToPlayer(playerId: string, message: any): void {
    for (const ws of this.getConnections()) {
      const state = ws.state as { playerId: string } | null;
      if (state?.playerId === playerId) {
        ws.send(JSON.stringify(message));
        break;
      }
    }
  }

  /** Handle perk result delivery after D1 journal write. */
  private handlePerkResult(fact: any, gameId: string): void {
    const perkType = fact.payload?.perkType;
    if (perkType === 'SPY_DMS' && fact.targetId) {
      querySpyDms(this.env.DB, gameId, fact.targetId).then((messages) => {
        this.actor?.send({
          type: Events.Perk.RESULT,
          senderId: fact.actorId,
          result: { perkType: 'SPY_DMS', success: true, data: { messages } },
        } as any);
      }).catch((err: any) => {
        console.error('[L1] SPY_DMS D1 query failed:', err);
        this.actor?.send({
          type: Events.Perk.RESULT,
          senderId: fact.actorId,
          result: { perkType: 'SPY_DMS', success: false, data: { messages: [] } },
        } as any);
      });
    } else {
      this.actor?.send({
        type: Events.Perk.RESULT,
        senderId: fact.actorId,
        result: { perkType, success: true },
      } as any);
    }
  }
}

// --- CORS helper for push endpoints ---
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Global HTTP push subscription endpoints (not routed to DO)
    if (url.pathname === '/api/push/subscribe') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      // Authenticate via JWT
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      const token = authHeader.slice(7);
      let userId: string;
      try {
        const { verifyGameToken } = await import('@pecking-order/auth');
        const payload = await verifyGameToken(token, env.AUTH_SECRET);
        userId = payload.sub;
      } catch {
        return new Response('Invalid token', { status: 401, headers: CORS_HEADERS });
      }

      if (request.method === 'POST') {
        try {
          const body = await request.json() as { endpoint: string; keys: { p256dh: string; auth: string } };
          if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
            return new Response('Invalid subscription', { status: 400, headers: CORS_HEADERS });
          }
          await savePushSubscriptionD1(env.DB, userId, body);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        } catch (err) {
          console.error('[Push API] Save failed:', err);
          return new Response('Server error', { status: 500, headers: CORS_HEADERS });
        }
      }

      if (request.method === 'DELETE') {
        try {
          await deletePushSubscriptionD1(env.DB, userId);
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        } catch (err) {
          console.error('[Push API] Delete failed:', err);
          return new Response('Server error', { status: 500, headers: CORS_HEADERS });
        }
      }

      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    // Admin: wipe all D1 tables (dev reset — requires ALLOW_DB_RESET=true in env)
    if (url.pathname === '/api/admin/reset-db') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }

      if ((env as any).ALLOW_DB_RESET !== 'true') {
        return new Response('Forbidden — ALLOW_DB_RESET not enabled in this environment', { status: 403, headers: CORS_HEADERS });
      }

      const authHeader = request.headers.get('Authorization');
      if (!authHeader || authHeader !== `Bearer ${env.AUTH_SECRET}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }

      try {
        // Allowlist prevents SQL injection — only these table names are accepted
        const ALLOWED_TABLES = ['GameJournal', 'Players', 'Games', 'PushSubscriptions'];
        // FK-safe default order (children before parents)
        const DEFAULT_ORDER = ['GameJournal', 'Players', 'Games', 'PushSubscriptions'];

        let requested: string[] = DEFAULT_ORDER;
        try {
          const body = await request.json() as any;
          if (Array.isArray(body?.tables) && body.tables.length > 0) {
            const valid = body.tables.filter((t: string) => ALLOWED_TABLES.includes(t));
            if (valid.length === 0) {
              return new Response(JSON.stringify({ error: `Invalid tables. Allowed: ${ALLOWED_TABLES.join(', ')}` }), {
                status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
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
        console.log('[Admin] D1 tables wiped:', requested);
        return new Response(JSON.stringify({ ok: true, tablesCleared: requested }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      } catch (err) {
        console.error('[Admin] DB reset failed:', err);
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
    }

    return (await routePartykitRequest(request, env)) || new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
