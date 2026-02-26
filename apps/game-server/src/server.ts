import { Server, routePartykitRequest, Connection, ConnectionContext } from "partyserver";
import { createActor, ActorRefFrom } from "xstate";
import { orchestratorMachine } from "./machines/l2-orchestrator";
import { Scheduler } from "partywhen";
import type { TickerMessage } from "@pecking-order/shared-types";
import { Events, FactTypes, ALLOWED_CLIENT_EVENTS as CLIENT_EVENTS } from "@pecking-order/shared-types";
import { isJournalable, persistFactToD1, querySpyDms, insertGameAndPlayers, updateGameEnd, readGoldBalances, creditGold, savePushSubscriptionD1, deletePushSubscriptionD1 } from "./d1-persistence";
import { flattenState, factToTicker, stateToTicker, buildDebugSummary, broadcastTicker, broadcastDebugTicker } from "./ticker";
import { extractCartridges, extractL3Context, buildSyncPayload, broadcastSync } from "./sync";
import { isPushEnabled, phasePushPayload, handleFactPush, pushBroadcast, type PushContext } from "./push-triggers";

const STORAGE_KEY = "game_state_snapshot";

/** Constant-time comparison to prevent timing attacks on secret values. */
function timingSafeEqual(a: string, b: string): boolean {
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
  static options = { hibernate: true };

  private actor: ActorRefFrom<typeof orchestratorMachine> | undefined;
  private lastKnownChatLog: any[] = [];
  private lastBroadcastState: string = '';
  private lastKnownDmsOpen: boolean = false;
  private lastKnownGroupChatOpen: boolean = false;
  private tickerHistory: TickerMessage[] = [];
  private lastDebugSummary: string = '';
  private scheduler: Scheduler<Env>;
  private goldCredited = false;
  private pendingWakeup = false;  // Buffered wakeup from Scheduler init (ADR-012)
  private connectedPlayers = new Map<string, Set<string>>();  // playerId → Set<connectionId>

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.scheduler = new Scheduler(ctx, env);
    (this.scheduler as any).wakeUpL2 = this.wakeUpL2.bind(this);
  }

  async wakeUpL2() {
    let remaining = '?';
    try {
      const rows = (this.scheduler as any).querySql([
        { sql: "SELECT COUNT(*) as count FROM tasks", params: [] }
      ]);
      remaining = rows[0]?.results?.[0]?.count ?? '?';
    } catch { /* non-critical */ }
    console.log(`[L1] [Alarm] wakeUpL2 fired — ${remaining} tasks remaining`);
    if (this.actor) {
      this.actor.send({ type: Events.System.WAKEUP });
    } else {
      console.log("[L1] Actor not ready — buffering wakeup for replay after onStart");
      this.pendingWakeup = true;
    }
  }

  /**
   * Schedule all manifest timeline events as individual PartyWhen tasks.
   * Called once at init — the manifest is the single source of truth.
   * Each event gets its own task ID so PartyWhen fires them independently.
   * PartyWhen stores all tasks in SQLite and chains the single DO alarm to
   * fire for the earliest task. After processing, it re-arms for the next.
   * For non-CONFIGURABLE_CYCLE modes, schedules a single immediate start.
   */
  private async scheduleManifestAlarms(manifest: any) {
    if (!manifest) return;

    if (manifest.gameMode === 'DEBUG_PECKING_ORDER') {
      console.log('[L1] Debug mode — no alarms scheduled (admin-triggered)');
      return;
    }

    if (manifest.gameMode === 'CONFIGURABLE_CYCLE' && manifest.days) {
      // Deduplicate by timestamp — one PartyWhen task per unique wakeup time.
      // processTimelineEvent handles finding all events due at that time.
      const uniqueTimestamps = new Map<number, string>(); // timestamp(s) → label
      const now = Date.now();
      for (const day of manifest.days) {
        for (const event of day.timeline || []) {
          const timeMs = new Date(event.time).getTime();
          if (timeMs > now) {
            const ts = Math.floor(timeMs / 1000);
            uniqueTimestamps.set(ts, `d${day.dayIndex}-${event.action}`);
          }
        }
      }
      const callback = JSON.stringify({ type: "self", function: "wakeUpL2" });
      for (const [timestamp, label] of uniqueTimestamps) {
        (this.scheduler as any).querySql([{
          sql: `INSERT OR REPLACE INTO tasks (id, description, payload, callback, type, time)
                VALUES (?, ?, ?, ?, 'scheduled', ?)`,
          params: [`wakeup-${label}`, null, null, callback, timestamp]
        }]);
      }
      // Arm the DO alarm for the earliest task
      await (this.scheduler as any).scheduleNextAlarm();
      console.log(`[L1] Scheduled ${uniqueTimestamps.size} unique alarms (from ${manifest.days.reduce((n: number, d: any) => n + (d.timeline?.length || 0), 0)} events) across ${manifest.days.length} days`);
      return;
    }

    // Standard PECKING_ORDER: immediate start (1s)
    await this.scheduler.scheduleTask({
      id: "wakeup-gamestart",
      type: "scheduled",
      time: new Date(Date.now() + 1000),
      callback: { type: "self", function: "wakeUpL2" }
    });
    console.log('[L1] Scheduled immediate game start (1s)');
  }

  /** Build a PushContext for the push-triggers module. */
  private getPushContext(): PushContext {
    const snapshot = this.actor?.getSnapshot();
    return {
      roster: snapshot?.context.roster || {},
      db: this.env.DB,
      vapidPrivateJwk: this.env.VAPID_PRIVATE_JWK,
      clientHost: this.env.GAME_CLIENT_HOST || 'https://play.peckingorder.ca',
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
    this.goldCredited = (await this.ctx.storage.get<boolean>('goldCredited')) === true;

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
        broadcastPhasePush: ({ context, event }: any) => {
          const { trigger } = event;
          const manifest = context.manifest;
          if (!isPushEnabled(manifest, trigger)) return;
          const result = phasePushPayload(trigger, context.dayIndex);
          if (result) {
            pushBroadcast(this.getPushContext(), result.payload, result.ttl).catch(err =>
              console.error('[L1] [Push] Phase broadcast error:', err)
            );
          }
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
    // The first subscription fire happens synchronously during actor.start()
    // with the restored snapshot — suppress ticker emissions to avoid duplicates.
    let isRestoreFire = true;
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

      // B. (Scheduling moved to handleInit — manifest events pre-scheduled at game creation)

      // C. Broadcast SYSTEM.SYNC to all clients
      const cartridges = extractCartridges(snapshot);
      broadcastSync({ snapshot, l3Context, chatLog, cartridges }, () => this.getConnections(), this.getOnlinePlayerIds());

      // D. Ticker: detect state transitions
      const l3StateJson = l3Snapshot ? JSON.stringify(l3Snapshot.value) : '';
      const currentStateStr = JSON.stringify(snapshot.value) + l3StateJson;
      if (currentStateStr !== this.lastBroadcastState) {
        if (!isRestoreFire) {
          const tickerMsg = stateToTicker(currentStateStr, snapshot.context);
          if (tickerMsg) {
            this.tickerHistory = broadcastTicker(tickerMsg, this.tickerHistory, () => this.getConnections());
          }
        }
        this.lastBroadcastState = currentStateStr;
      }

      // E. Update D1 when game ends + persist gold payouts + flush scheduled tasks
      if (currentStateStr.includes('gameOver') && snapshot.context.gameId) {
        updateGameEnd(this.env.DB, snapshot.context.gameId, snapshot.context.roster);

        // Persist gold payouts to cross-tournament wallets (idempotent guard)
        if (!this.goldCredited) {
          const payouts = snapshot.context.goldPayouts || [];
          for (const payout of payouts) {
            const realUserId = snapshot.context.roster[payout.playerId]?.realUserId;
            if (realUserId && payout.amount > 0) {
              creditGold(this.env.DB, realUserId, payout.amount);
            }
          }
          if (payouts.length > 0) {
            this.goldCredited = true;
            this.ctx.storage.put('goldCredited', true);
          }
        }

        // Flush remaining PartyWhen tasks — game is done
        try {
          (this.scheduler as any).querySql([{ sql: "DELETE FROM tasks", params: [] }]);
        } catch (e) {
          console.error('[L1] Failed to flush tasks on game end:', e);
        }
      }

      // F. Ticker: detect DM open/close changes
      const currentDmsOpen = l3Context.dmsOpen ?? false;
      if (currentDmsOpen !== this.lastKnownDmsOpen) {
        if (!isRestoreFire) {
          this.tickerHistory = broadcastTicker({
            id: crypto.randomUUID(),
            text: currentDmsOpen ? 'DMs are now open!' : 'DMs are now closed.',
            category: currentDmsOpen ? 'GATE.DMS_OPEN' : 'GATE.DMS_CLOSE',
            timestamp: Date.now(),
          }, this.tickerHistory, () => this.getConnections());
        }
        this.lastKnownDmsOpen = currentDmsOpen;
      }

      // G. Ticker: detect group chat open/close changes
      const currentGroupChatOpen = l3Context.groupChatOpen ?? false;
      if (currentGroupChatOpen !== this.lastKnownGroupChatOpen) {
        if (!isRestoreFire) {
          this.tickerHistory = broadcastTicker({
            id: crypto.randomUUID(),
            text: currentGroupChatOpen ? 'Group chat is now open!' : 'Group chat is now closed.',
            category: currentGroupChatOpen ? 'GATE.CHAT_OPEN' : 'GATE.CHAT_CLOSE',
            timestamp: Date.now(),
          }, this.tickerHistory, () => this.getConnections());
        }
        this.lastKnownGroupChatOpen = currentGroupChatOpen;
      }

      isRestoreFire = false;
    });

    this.actor.start();
    // Note: isRestoreFire flag in subscription handles first-fire ticker
    // suppression — no post-start initialization needed for tracking vars.

    // Rebuild connected players map from surviving WebSocket attachments
    // (required for hibernation — ws.state is lost but attachments survive).
    this.rebuildConnectedPlayers();

    // Replay any wakeup that fired during Scheduler construction (before actor
    // existed). See ADR-012: Scheduler.alarm() runs in blockConcurrencyWhile,
    // which can consume+delete tasks before onStart sets up the actor.
    if (this.pendingWakeup) {
      console.log('[L1] Replaying buffered wakeup (fired during Scheduler init)');
      this.actor.send({ type: Events.System.WAKEUP });
      this.pendingWakeup = false;
    }

    // Re-arm alarm for any future tasks still in the table
    await (this.scheduler as any).scheduleNextAlarm();
  }

  /** Rebuild connectedPlayers map from WebSocket attachments (survives hibernation). */
  private rebuildConnectedPlayers() {
    this.connectedPlayers.clear();
    for (const ws of this.getConnections()) {
      const attachment = ws.deserializeAttachment();
      if (attachment?.playerId) {
        const existing = this.connectedPlayers.get(attachment.playerId) || new Set();
        existing.add(ws.id);
        this.connectedPlayers.set(attachment.playerId, existing);
      }
    }
  }

  // --- 2. HTTP HANDLERS ---

  async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "POST" && path.endsWith("/init")) {
      return this.handleInit(req, url);
    }
    if (req.method === "POST" && path.endsWith("/player-joined")) {
      return this.handlePlayerJoined(req, url);
    }
    if (req.method === "GET" && path.endsWith("/state")) {
      return this.handleGetState();
    }
    if (req.method === "POST" && path.endsWith("/admin")) {
      return this.handleAdmin(req);
    }
    if (req.method === "POST" && path.endsWith("/flush-tasks")) {
      return this.handleFlushTasks(req);
    }
    if ((req.method === "GET" || req.method === "POST") && path.endsWith("/scheduled-tasks")) {
      return this.handleScheduledTasks(req);
    }
    if (req.method === "POST" && path.endsWith("/cleanup")) {
      return this.handleCleanup(req);
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
    if (this.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${this.env.AUTH_SECRET}`)) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const json = await req.json() as any;
      const pathParts = url.pathname.split('/');
      const gameId = pathParts[pathParts.length - 2];

      // Enrich roster with persistent gold from D1
      const realUserIds = Object.values(json.roster || {}).map((p: any) => p.realUserId).filter(Boolean);
      if (realUserIds.length > 0) {
        const goldBalances = await readGoldBalances(this.env.DB, realUserIds);
        for (const p of Object.values(json.roster) as any[]) {
          if (p.realUserId) {
            p.gold = goldBalances.get(p.realUserId) || 0;
          }
        }
      }

      this.actor?.send({
        type: Events.System.INIT,
        payload: { roster: json.roster, manifest: json.manifest },
        gameId,
        inviteCode: json.inviteCode || '',
      });

      // Schedule alarms from the manifest — the manifest is the single source
      // of truth for scheduling. All timeline events are pre-scheduled at init
      // time; the subscription never touches scheduling.
      await this.scheduleManifestAlarms(json.manifest);

      insertGameAndPlayers(this.env.DB, gameId, json.manifest?.gameMode || 'PECKING_ORDER', json.roster || {});

      return new Response(JSON.stringify({ status: "OK" }), { status: 200 });
    } catch (err) {
      console.error("[L1] POST /init failed:", err);
      return new Response("Invalid Payload", { status: 400 });
    }
  }

  private async handlePlayerJoined(req: Request, url: URL): Promise<Response> {
    const authHeader = req.headers.get('Authorization');
    if (this.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${this.env.AUTH_SECRET}`)) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const json = await req.json() as any;
      const { playerId, realUserId, personaName, avatarUrl, bio, silver } = json;

      if (!playerId || !realUserId || !personaName) {
        return new Response('Missing required fields', { status: 400 });
      }

      // Reject if the game has progressed past preGame
      const snapshot = this.actor?.getSnapshot();
      if (snapshot && snapshot.value !== 'preGame') {
        console.log(`[L1] Rejecting player-joined: game is in ${JSON.stringify(snapshot.value)}, not preGame`);
        return new Response(JSON.stringify({ error: 'GAME_STARTED' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Enrich with persistent gold from D1
      const goldBalances = await readGoldBalances(this.env.DB, [realUserId]);
      const gold = goldBalances.get(realUserId) || 0;

      // Send SYSTEM.PLAYER_JOINED to L2
      this.actor?.send({
        type: Events.System.PLAYER_JOINED,
        player: { id: playerId, realUserId, personaName, avatarUrl: avatarUrl || '', bio: bio || '', silver: silver || 50, gold },
      });

      // Insert player into D1 Players table
      const pathParts = url.pathname.split('/');
      const gameId = pathParts[pathParts.length - 2];
      const playerStmt = this.env.DB.prepare(
        `INSERT OR IGNORE INTO Players (game_id, player_id, real_user_id, persona_name, avatar_url, status, silver, gold, destiny_id)
         VALUES (?, ?, ?, ?, ?, 'ALIVE', ?, ?, ?)`
      );
      playerStmt.bind(gameId, playerId, realUserId, personaName, avatarUrl || '', silver || 50, gold, null)
        .run()
        .catch((err: any) => console.error('[L1] Failed to insert player:', err));

      return new Response(JSON.stringify({ status: 'OK' }), { status: 200 });
    } catch (err) {
      console.error('[L1] POST /player-joined failed:', err);
      return new Response('Invalid Payload', { status: 400 });
    }
  }

  private handleGetState(): Response {
    const snapshot = this.actor?.getSnapshot();
    const roster = snapshot?.context.roster || {};
    const rosterSummary = Object.fromEntries(
      Object.entries(roster).map(([id, p]: [string, any]) => [id, { personaName: p.personaName, status: p.status }])
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

  private async handleFlushTasks(req: Request): Promise<Response> {
    const authHeader = req.headers.get('Authorization');
    if (this.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${this.env.AUTH_SECRET}`)) {
      return new Response('Unauthorized', { status: 401 });
    }
    try {
      (this.scheduler as any).querySql([{ sql: "DELETE FROM tasks", params: [] }]);
      await (this.scheduler as any).scheduleNextAlarm();
      console.log('[L1] All scheduled tasks flushed');
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error('[L1] Flush tasks error:', err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  private async handleScheduledTasks(req: Request): Promise<Response> {
    const authHeader = req.headers.get('Authorization');
    if (this.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${this.env.AUTH_SECRET}`)) {
      return new Response('Unauthorized', { status: 401 });
    }
    try {
      if (req.method === 'POST') {
        (this.scheduler as any).querySql([{ sql: "DELETE FROM tasks", params: [] }]);
        await (this.scheduler as any).scheduleNextAlarm();
        console.log('[L1] All scheduled tasks flushed via /scheduled-tasks');
        return new Response(JSON.stringify({ ok: true, flushed: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
      // GET: list tasks
      const rows = (this.scheduler as any).querySql([
        { sql: "SELECT id, time FROM tasks ORDER BY time ASC", params: [] }
      ]);
      const tasks = rows[0]?.results || [];
      return new Response(JSON.stringify({ count: tasks.length, tasks }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    } catch (err: any) {
      console.error('[L1] Scheduled tasks error:', err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  private async handleCleanup(req: Request): Promise<Response> {
    const authHeader = req.headers.get('Authorization');
    if (this.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${this.env.AUTH_SECRET}`)) {
      return new Response('Unauthorized', { status: 401 });
    }
    try {
      const gameId = this.actor?.getSnapshot()?.context.gameId || 'unknown';
      const cleaned: string[] = [];

      // 1. Delete D1 rows for this game
      if (gameId !== 'unknown') {
        await this.env.DB.batch([
          this.env.DB.prepare('DELETE FROM GameJournal WHERE game_id = ?').bind(gameId),
          this.env.DB.prepare('DELETE FROM Players WHERE game_id = ?').bind(gameId),
          this.env.DB.prepare('DELETE FROM Games WHERE id = ?').bind(gameId),
        ]);
        cleaned.push('GameJournal', 'Players', 'Games');
      }

      // 2. Flush scheduled tasks
      (this.scheduler as any).querySql([{ sql: "DELETE FROM tasks", params: [] }]);
      cleaned.push('scheduled tasks');

      // 3. Clear DO storage (snapshot, goldCredited, etc.)
      await this.ctx.storage.deleteAll();
      cleaned.push('DO storage');

      console.log(`[L1] Cleanup complete for game ${gameId}: ${cleaned.join(', ')}`);
      return new Response(JSON.stringify({ ok: true, cleaned }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    } catch (err: any) {
      console.error('[L1] Cleanup error:', err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  private async handleAdmin(req: Request): Promise<Response> {
    // Auth check — require Bearer token matching AUTH_SECRET
    const authHeader = req.headers.get('Authorization');
    if (this.env.AUTH_SECRET && !timingSafeEqual(authHeader || '', `Bearer ${this.env.AUTH_SECRET}`)) {
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
    ws.serializeAttachment({ playerId });
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
    // ws.state may be lost after hibernation — fall back to attachment
    const state = ws.state as { playerId: string } | null;
    const playerId = state?.playerId || ws.deserializeAttachment()?.playerId;
    if (!playerId) return;

    const conns = this.connectedPlayers.get(playerId);
    if (conns) {
      conns.delete(ws.id);
      if (conns.size === 0) {
        this.connectedPlayers.delete(playerId);
      }
    }
    this.broadcastPresence();
  }

  private static ALLOWED_CLIENT_EVENTS = CLIENT_EVENTS as readonly string[];

  onMessage(ws: Connection, message: string) {
    try {
      const event = JSON.parse(message);
      // ws.state may be lost after hibernation — fall back to attachment
      const state = ws.state as { playerId: string } | null;
      const playerId = state?.playerId || ws.deserializeAttachment()?.playerId;

      console.log(`[L1] Received message from ${playerId}:`, JSON.stringify(event));

      if (!playerId) {
        console.warn("[L1] Message received from connection without playerId");
        ws.close(4001, "Missing Identity");
        return;
      }

      // Re-set ws.state if it was lost (so subsequent reads in this session work)
      if (!state?.playerId && playerId) {
        ws.setState({ playerId });
      }

      // Presence: relay typing indicators without touching XState
      if (event.type === Events.Presence.TYPING) {
        const msg = JSON.stringify({
          type: Events.Presence.TYPING,
          playerId,
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
          playerId,
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

      this.actor?.send({ ...event, senderId: playerId });
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
      const wsPlayerId = state?.playerId || ws.deserializeAttachment()?.playerId;
      if (wsPlayerId === playerId) {
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
  'Access-Control-Max-Age': '86400',
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
      if (!authHeader || !timingSafeEqual(authHeader, `Bearer ${env.AUTH_SECRET}`)) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
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
