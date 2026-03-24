import { Server, routePartykitRequest, Connection, ConnectionContext } from "partyserver";
import { createActor, ActorRefFrom } from "xstate";
import { orchestratorMachine } from "./machines/l2-orchestrator";
import { Scheduler } from "partywhen";
import type { TickerMessage } from "@pecking-order/shared-types";
import { Events } from "@pecking-order/shared-types";
import { createInspector, type InspectBroadcast } from "./inspect";
import { log } from "./log";
import { scheduleManifestAlarms } from "./scheduling";
import { routeRequest, type HandlerContext } from "./http-handlers";
import { handleConnect, handleMessage, handleClose, rebuildConnectedPlayers, type WsContext } from "./ws-handlers";
import { setupActorSubscription, type SubscriptionState } from "./subscription";
import { handleGlobalRoutes } from "./global-routes";
import { buildActionOverrides, type ActionContext } from "./machine-actions";
import { ensureSnapshotsTable, readSnapshot, readGoldCredited, parseSnapshot } from "./snapshot";

export { DemoServer } from './demo/demo-server';
export type { Env } from "./types";
import type { Env } from "./types";

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
  private realSchedulerAlarm: (() => Promise<void>) | undefined;
  goldCredited = false;
  connectedPlayers = new Map<string, Set<string>>();
  inspectSubscribers = new Set<Connection>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.scheduler = new Scheduler(ctx, env);

    // NOSENTRY fix: PartyWhen's constructor calls `await this.alarm()` inside
    // blockConcurrencyWhile. That processes tasks and calls setAlarm() for the
    // next task — but calling setAlarm() during the alarm lifecycle causes
    // Cloudflare to cancel the alarm handler (NOSENTRY), preventing onStart()
    // and onAlarm() from ever running.
    //
    // Fix: save the real alarm() method and replace it with a no-op. The
    // constructor's blockConcurrencyWhile will still create the tasks table
    // but won't process tasks or call setAlarm(). We call the real alarm()
    // ourselves in onAlarm(), where setAlarm() is safe.
    this.realSchedulerAlarm = (this.scheduler as any).alarm.bind(this.scheduler);
    (this.scheduler as any).alarm = async () => {};

    // wakeUpL2 is a no-op — WAKEUP delivery happens in onAlarm().
    (this.scheduler as any).wakeUpL2 = () => {};
  }

  // --- Build context objects for extracted modules ---

  private handlerContext(): HandlerContext {
    return {
      actor: this.actor,
      env: this.env,
      scheduler: this.scheduler,
      storage: this.ctx.storage,
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

  private actionContext(): ActionContext {
    return {
      getActor: () => this.actor,
      env: this.env,
      getConnections: () => this.getConnections(),
      getTickerHistory: () => this.tickerHistory,
      setTickerHistory: (h) => { this.tickerHistory = h; },
      waitUntil: (p) => this.ctx.waitUntil(p),
    };
  }

  // --- LIFECYCLE ---

  async onStart() {
    // 1. Ensure storage schema
    this.checkPartyWhenTables();
    ensureSnapshotsTable(this.ctx.storage);

    // 2. Restore persisted state (SQL first, KV fallback for legacy games)
    const snapshotStr = await readSnapshot(this.ctx.storage);
    this.goldCredited = await readGoldCredited(this.ctx.storage);

    // 3. Create machine with DO-context action overrides
    const machine = orchestratorMachine.provide({
      actions: buildActionOverrides(this.actionContext()),
    });

    // 4. Create inspector for XState event tracing + admin WebSocket broadcast
    const gameId = snapshotStr ? parseSnapshot(snapshotStr).gameId : 'unknown';
    const inspect = createInspector(gameId, this.broadcastInspect.bind(this));

    // 5. Create actor (restore from snapshot or fresh boot)
    this.actor = this.createActor(machine, inspect, snapshotStr);

    // 6. Wire up subscription (auto-save, broadcast, ticker, push)
    setupActorSubscription(this.actor, {
      getActor: () => this.actor,
      storage: this.ctx.storage,
      env: this.env,
      scheduler: this.scheduler,
      state: this as SubscriptionState,
      connectedPlayers: this.connectedPlayers,
      getConnections: () => this.getConnections(),
    });

    // 7. Start actor + rebuild presence from surviving WebSocket attachments
    this.actor.start();
    rebuildConnectedPlayers(this.connectedPlayers, () => this.getConnections());
  }

  /** Verify PartyWhen's tasks table exists (log-only, non-fatal). */
  private checkPartyWhenTables(): void {
    try {
      this.ctx.storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'");
    } catch (e) {
      log('error', 'L1', 'PartyWhen tasks table check failed', { error: String(e) });
    }
  }

  /** Broadcast an inspect event to all subscribed admin WebSocket clients. */
  private broadcastInspect(message: object): void {
    if (this.inspectSubscribers.size === 0) return;
    const json = JSON.stringify(message);
    for (const ws of this.inspectSubscribers) {
      try { ws.send(json); } catch { /* connection may have closed */ }
    }
  }

  /**
   * Create the XState actor — restore from snapshot if available,
   * fall back to fresh boot if snapshot is corrupted or missing.
   */
  private createActor(
    machine: typeof orchestratorMachine,
    inspect: ReturnType<typeof createInspector>,
    snapshotStr: string | undefined,
  ): ActorRefFrom<typeof orchestratorMachine> {
    if (!snapshotStr) {
      log('info', 'L1', 'Fresh Boot');
      return createActor(machine, { inspect });
    }

    log('info', 'L1', 'Resuming Game');
    const parsed = parseSnapshot(snapshotStr);

    if (parsed.chatLog) {
      this.lastKnownChatLog = parsed.chatLog;
    }
    if (parsed.tickerHistory) {
      this.tickerHistory = parsed.tickerHistory;
    }

    try {
      const actor = createActor(machine, { snapshot: parsed.l2Snapshot, inspect });
      const restoredState = JSON.stringify(actor.getSnapshot().value);

      // Validate L3 child survived serialization
      if (restoredState.includes('activeSession') && !actor.getSnapshot().children['l3-session']) {
        log('warn', 'L1', 'L3 missing after restore — snapshot was corrupted. Clearing state for fresh start.');
        this.ctx.storage.sql.exec("DELETE FROM snapshots WHERE key = 'game_state'");
        return createActor(machine, { inspect });
      }

      return actor;
    } catch (err) {
      log('error', 'L1', 'Snapshot restore failed — starting fresh', { error: String(err) });
      this.ctx.storage.sql.exec("DELETE FROM snapshots WHERE key = 'game_state'");
      return createActor(machine, { inspect });
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
    // Restore and call the real PartyWhen alarm() — processes due tasks,
    // deletes them, and chains to the next alarm via setAlarm().
    // This is safe here: setAlarm() inside onAlarm() is fine,
    // only setAlarm() inside the constructor's blockConcurrencyWhile causes NOSENTRY.
    if (this.realSchedulerAlarm) {
      (this.scheduler as any).alarm = this.realSchedulerAlarm;
      await this.realSchedulerAlarm();
    }

    // Deliver WAKEUP to the actor. The actor is guaranteed to exist here
    // because PartyServer calls onStart() before onAlarm().
    if (this.actor) {
      const snap = this.actor.getSnapshot();
      const manifest = snap?.context?.manifest;

      // For DYNAMIC games in preGame: check minPlayers before starting
      if (snap?.value === 'preGame' && manifest?.kind === 'DYNAMIC') {
        const rosterCount = Object.keys(snap.context.roster || {}).length;
        const minPlayers = manifest.minPlayers ?? 3;
        if (rosterCount < minPlayers) {
          log('info', 'L1', 'Suppressing WAKEUP: not enough players', {
            rosterCount,
            minPlayers,
          });
          return;
        }
      }

      this.actor.send({ type: Events.System.WAKEUP });

      // Re-schedule for dynamic manifests — picks up newly resolved day's events
      if (manifest?.kind === 'DYNAMIC') {
        await scheduleManifestAlarms(this.scheduler, manifest);
      }
    }
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
