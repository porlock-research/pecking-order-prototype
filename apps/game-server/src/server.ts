import { Server, routePartykitRequest, Connection, ConnectionContext } from "partyserver";
import { createActor, ActorRefFrom } from "xstate";
import { orchestratorMachine } from "./machines/l2-orchestrator";
import { Scheduler } from "partywhen";
import type { TickerMessage } from "@pecking-order/shared-types";
import { Events, FactTypes } from "@pecking-order/shared-types";
import { isJournalable, persistFactToD1, querySpyDms } from "./d1-persistence";
import { factToTicker, broadcastTicker } from "./ticker";
import { createInspector, type InspectBroadcast } from "./inspect";
import { log } from "./log";
import { extractL3Context } from "./sync";
import { isPushEnabled, phasePushPayload, handleFactPush, pushBroadcast, type PushContext } from "./push-triggers";
import { wakeUpL2, scheduleManifestAlarms } from "./scheduling";
import { routeRequest, type HandlerContext } from "./http-handlers";
import { handleConnect, handleMessage, handleClose, getOnlinePlayerIds, broadcastPresence, rebuildConnectedPlayers, sendToPlayer, type WsContext } from "./ws-handlers";
import { setupActorSubscription, type SubscriptionState } from "./subscription";
import { handleGlobalRoutes } from "./global-routes";

export type { Env } from "./types";
import type { Env } from "./types";

const STORAGE_KEY = "game_state_snapshot";

export class GameServer extends Server<Env> {
  static options = { hibernate: true };

  actor: ActorRefFrom<typeof orchestratorMachine> | undefined;
  lastKnownChatLog: any[] = [];
  lastBroadcastState: string = '';
  lastKnownDmsOpen: boolean = false;
  lastKnownGroupChatOpen: boolean = false;
  tickerHistory: TickerMessage[] = [];
  lastDebugSummary: string = '';
  scheduler: Scheduler<Env>;
  goldCredited = false;
  pendingWakeup = false;
  connectedPlayers = new Map<string, Set<string>>();
  inspectSubscribers = new Set<Connection>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.scheduler = new Scheduler(ctx, env);
    (this.scheduler as any).wakeUpL2 = () => {
      wakeUpL2(this.scheduler, this.actor, () => { this.pendingWakeup = true; });
    };
  }

  // --- Build context objects for extracted modules ---

  private handlerContext(): HandlerContext {
    return {
      actor: this.actor,
      env: this.env,
      scheduler: this.scheduler,
      scheduleManifestAlarms: (manifest) => scheduleManifestAlarms(this.scheduler, manifest),
      deleteAllStorage: () => this.ctx.storage.deleteAll(),
    };
  }

  private wsContext(): WsContext {
    return {
      actor: this.actor,
      env: this.env,
      connectedPlayers: this.connectedPlayers,
      inspectSubscribers: this.inspectSubscribers,
      tickerHistory: this.tickerHistory,
      lastDebugSummary: this.lastDebugSummary,
      lastKnownChatLog: this.lastKnownChatLog,
      getConnections: () => this.getConnections(),
    };
  }

  private subscriptionState(): SubscriptionState {
    // Return `this` — the server instance implements SubscriptionState structurally
    return this;
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

  // --- LIFECYCLE ---

  async onStart() {
    // PartyWhen persistence check — only log on error
    try {
      this.ctx.storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'");
      await this.ctx.storage.getAlarm();
    } catch (e) {
      log('error', 'L1', 'SQL/Alarm check failed', { error: String(e) });
    }

    // Create snapshots table for queryable persistence (ADR-092)
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS snapshots (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`);

    // Read snapshot — SQL first, KV fallback for pre-migration games
    let snapshotStr: string | undefined;
    const sqlRows = this.ctx.storage.sql.exec(
      "SELECT value FROM snapshots WHERE key = 'game_state'"
    ).toArray();
    snapshotStr = sqlRows[0]?.value as string | undefined;

    if (!snapshotStr) {
      snapshotStr = await this.ctx.storage.get<string>(STORAGE_KEY);
      if (snapshotStr) {
        // Lazily migrate KV → SQL on first wake after deploy
        this.ctx.storage.sql.exec(
          `INSERT OR REPLACE INTO snapshots (key, value, updated_at) VALUES ('game_state', ?, unixepoch())`,
          snapshotStr
        );
        await this.ctx.storage.delete(STORAGE_KEY);
        log('info', 'L1', 'Migrated snapshot from KV to SQL');
      }
    }

    // Read goldCredited — SQL first, KV fallback
    const goldRows = this.ctx.storage.sql.exec(
      "SELECT value FROM snapshots WHERE key = 'gold_credited'"
    ).toArray();
    if (goldRows.length > 0) {
      this.goldCredited = goldRows[0].value === 'true';
    } else {
      const kvGold = await this.ctx.storage.get<boolean>('goldCredited');
      if (kvGold) {
        this.goldCredited = true;
        this.ctx.storage.sql.exec(
          `INSERT OR REPLACE INTO snapshots (key, value, updated_at) VALUES ('gold_credited', 'true', unixepoch())`
        );
        await this.ctx.storage.delete('goldCredited');
        log('info', 'L1', 'Migrated goldCredited from KV to SQL');
      }
    }

    // L1 .provide() — override actions that need DO context (D1, WebSocket, push)
    const machineWithPersistence = orchestratorMachine.provide({
      actions: {
        persistFactToD1: ({ event }: any) => {
          if (event.type !== Events.Fact.RECORD) return;
          const fact = event.fact;
          if (!isJournalable(fact.type)) return;

          log('info', 'L1', 'Persisting fact to D1', { factType: fact.type });
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

          // Push notifications for significant facts.
          const manifest = snapshot?.context.manifest;
          const pushPromise = handleFactPush(this.getPushContext(), fact, manifest);
          if (pushPromise) this.ctx.waitUntil(pushPromise);
        },
        sendDmRejection: ({ event }: any) => {
          if (event.type !== Events.Rejection.DM) return;
          sendToPlayer(() => this.getConnections(), event.senderId, { type: Events.Rejection.DM, reason: event.reason });
        },
        sendSilverTransferRejection: ({ event }: any) => {
          if (event.type !== Events.Rejection.SILVER_TRANSFER) return;
          sendToPlayer(() => this.getConnections(), event.senderId, { type: Events.Rejection.SILVER_TRANSFER, reason: event.reason });
        },
        sendChannelRejection: ({ event }: any) => {
          if (event.type !== Events.Rejection.CHANNEL) return;
          sendToPlayer(() => this.getConnections(), event.senderId, { type: Events.Rejection.CHANNEL, reason: event.reason });
        },
        deliverPerkResult: ({ event }: any) => {
          if (event.type !== Events.Perk.RESULT && event.type !== Events.Rejection.PERK) return;
          sendToPlayer(() => this.getConnections(), event.senderId, event);
        },
        broadcastPhasePush: ({ context, event }: any) => {
          const { trigger } = event;
          const manifest = context.manifest;
          if (!isPushEnabled(manifest, trigger)) return;
          const dayManifest = manifest?.days?.find((d: any) => d.dayIndex === context.dayIndex);
          const result = phasePushPayload(trigger, context.dayIndex, dayManifest);
          if (result) {
            const p = pushBroadcast(this.getPushContext(), result.payload, result.ttl).catch(err =>
              log('error', 'L1', 'Push phase broadcast error', { error: String(err) })
            );
            this.ctx.waitUntil(p);
          }
        },
      }
    });

    // Build inspector for XState event tracing + admin WebSocket broadcast
    let parsedGameId = 'unknown';
    if (snapshotStr) {
      try { parsedGameId = JSON.parse(snapshotStr)?.l2?.context?.gameId || 'unknown'; } catch { /* ignore */ }
    }
    const broadcastInspect: InspectBroadcast = (message) => {
      if (this.inspectSubscribers.size === 0) return;
      const json = JSON.stringify(message);
      for (const ws of this.inspectSubscribers) {
        try { ws.send(json); } catch { /* connection may have closed */ }
      }
    };
    const inspect = createInspector(parsedGameId, broadcastInspect);

    // Restore or fresh boot
    if (snapshotStr) {
      log('info', 'L1', 'Resuming Game');
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
        this.actor = createActor(machineWithPersistence, { snapshot: l2Snapshot, inspect });
        const restoredState = JSON.stringify(this.actor.getSnapshot().value);
        if (restoredState.includes('activeSession') && !this.actor.getSnapshot().children['l3-session']) {
          log('warn', 'L1', 'L3 missing after restore — snapshot was corrupted. Clearing state for fresh start.');
          this.ctx.storage.sql.exec("DELETE FROM snapshots WHERE key = 'game_state'");
          this.actor = createActor(machineWithPersistence, { inspect });
        }
      } catch (err) {
        log('error', 'L1', 'Snapshot restore failed — starting fresh', { error: String(err) });
        this.ctx.storage.sql.exec("DELETE FROM snapshots WHERE key = 'game_state'");
        this.actor = createActor(machineWithPersistence, { inspect });
      }
    } else {
      log('info', 'L1', 'Fresh Boot');
      this.actor = createActor(machineWithPersistence, { inspect });
    }

    // Subscribe: auto-save, broadcast, ticker, push
    setupActorSubscription(this.actor, {
      getActor: () => this.actor,
      storage: this.ctx.storage,
      env: this.env,
      scheduler: this.scheduler,
      state: this.subscriptionState(),
      connectedPlayers: this.connectedPlayers,
      getConnections: () => this.getConnections(),
    });

    this.actor.start();

    // Rebuild connected players map from surviving WebSocket attachments
    rebuildConnectedPlayers(this.connectedPlayers, () => this.getConnections());

    // Replay any wakeup that fired during Scheduler construction (before actor
    // existed). See ADR-012: Scheduler.alarm() runs in blockConcurrencyWhile,
    // which can consume+delete tasks before onStart sets up the actor.
    if (this.pendingWakeup) {
      log('info', 'L1', 'Replaying buffered wakeup (fired during Scheduler init)');
      this.actor.send({ type: Events.System.WAKEUP });
      this.pendingWakeup = false;
    }

    // Re-arm alarm for any future tasks still in the table
    await (this.scheduler as any).scheduleNextAlarm();
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
        log('error', 'L1', 'SPY_DMS D1 query failed', { error: String(err) });
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

  // --- HTTP ---

  async onRequest(req: Request): Promise<Response> {
    return routeRequest(this.handlerContext(), req);
  }

  // --- WEBSOCKET ---

  async onConnect(ws: Connection, ctx: ConnectionContext) {
    await handleConnect(this.wsContext(), ws, ctx);
  }

  onClose(ws: Connection) {
    handleClose(this.wsContext(), ws);
  }

  onMessage(ws: Connection, message: string) {
    handleMessage(this.wsContext(), ws, message);
  }

  // --- ALARM ---

  async onAlarm() {
    await this.scheduler.alarm();
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Try global routes first (push, admin journal, etc.)
    const globalResponse = await handleGlobalRoutes(request, env);
    if (globalResponse) return globalResponse;

    // Fall through to Durable Object routing
    return (await routePartykitRequest(request, env)) || new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
