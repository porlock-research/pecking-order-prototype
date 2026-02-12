import { Server, routePartykitRequest, Connection, ConnectionContext } from "partyserver";
import { createActor, ActorRefFrom } from "xstate";
import { orchestratorMachine } from "./machines/l2-orchestrator";
import { Scheduler } from "partywhen";
import type { TickerMessage } from "@pecking-order/shared-types";

// Persistence Key
const STORAGE_KEY = "game_state_snapshot";

// Env Interface (Matches your wrangler.toml)
export interface Env {
  GameServer: DurableObjectNamespace;
  DB: D1Database;
  AXIOM_DATASET: string;
  AXIOM_TOKEN?: string;
  AXIOM_ORG_ID?: string;
}

export class GameServer extends Server<Env> {
  // The Brain (XState Actor)
  private actor: ActorRefFrom<typeof orchestratorMachine> | undefined;

  // Cache L3 chatLog so it survives L3 actor destruction (e.g. nightSummary transition)
  private lastKnownChatLog: any[] = [];

  // Ticker state tracking
  private lastBroadcastState: string = '';
  private lastKnownDmsOpen: boolean = false;
  private tickerHistory: TickerMessage[] = [];
  private lastDebugSummary: string = '';

  // The Scheduler (Composition)
  private scheduler: Scheduler<Env>;
  
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Instantiate Scheduler helper
    this.scheduler = new Scheduler(ctx, env);
    
    // Monkey-patch the callback method onto the scheduler instance so "self" tasks work
    // because partywhen calls this[callback.function]() on the scheduler instance
    (this.scheduler as any).wakeUpL2 = this.wakeUpL2.bind(this);
  }

  // Callback for PartyWhen
  async wakeUpL2() {
    console.log("[L1] ⏰ PartyWhen Task Triggered: wakeUpL2");
    this.actor?.send({ type: "SYSTEM.WAKEUP" });
  }

  /**
   * 1. LIFECYCLE: Boot up the Brain
   * Called automatically when the Durable Object is instantiated
   */
  async onStart() {
    // DEBUG: Diagnose PartyWhen Persistence
    try {
      const tables = this.ctx.storage.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'");
      console.log("[L1] Debug: Tasks table exists?", [...tables]);
      
      const currentAlarm = await this.ctx.storage.getAlarm();
      console.log("[L1] Debug: Current Alarm:", currentAlarm ? new Date(currentAlarm).toISOString() : "None");
    } catch (e) {
      console.error("[L1] Debug: SQL/Alarm Check Failed", e);
    }

    // Load previous state from disk
    const snapshotStr = await this.ctx.storage.get<string>(STORAGE_KEY);
    
    // Define the D1 Writer Implementation
    // Only override persistFactToD1 — updateJournalTimestamp (assign) stays in L2
    // to ensure context changes trigger the subscription for SYSTEM.SYNC broadcasts
    const JOURNALABLE_TYPES = ['SILVER_TRANSFER', 'VOTE_CAST', 'ELIMINATION', 'DM_SENT', 'POWER_USED', 'GAME_RESULT', 'PLAYER_GAME_RESULT', 'WINNER_DECLARED'];
    const machineWithPersistence = orchestratorMachine.provide({
      actions: {
        persistFactToD1: ({ event }: any) => {
          if (event.type !== 'FACT.RECORD') return;
          const fact = event.fact;

          // Per spec: only journal significant events to D1 (not high-frequency CHAT_MSG)
          if (!JOURNALABLE_TYPES.includes(fact.type)) {
            console.log(`[L1] Fact received (sync-only, not journaled): ${fact.type}`);
            return;
          }

          console.log(`[L1] 📝 Persisting Fact to D1: ${fact.type}`);

          // Read actual game context from L2 actor snapshot
          const snapshot = this.actor?.getSnapshot();
          const gameId = snapshot?.context.gameId || 'unknown';
          const dayIndex = snapshot?.context.dayIndex || 0;

          // Fire and forget D1 insert
          this.env.DB.prepare(
            `INSERT INTO GameJournal (id, game_id, day_index, timestamp, event_type, actor_id, target_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            crypto.randomUUID(),
            gameId,
            dayIndex,
            fact.timestamp,
            fact.type,
            fact.actorId,
            fact.targetId || null,
            JSON.stringify(fact.payload || {})
          ).run().catch(err => {
            console.error("[L1] 💥 Failed to write to Journal:", err);
          });

          // Ticker: convert fact to humanized message
          const tickerMsg = this.factToTicker(fact);
          if (tickerMsg) this.broadcastTicker(tickerMsg);
        },
        sendDmRejection: ({ event }: any) => {
          if (event.type !== 'DM.REJECTED') return;
          // Send rejection only to the sender's WebSocket
          for (const ws of this.getConnections()) {
            const state = ws.state as { playerId: string } | null;
            if (state?.playerId === event.senderId) {
              ws.send(JSON.stringify({ type: 'DM.REJECTED', reason: event.reason }));
              break;
            }
          }
        },
        // persistEliminationToD1 removed — eliminations now flow through the normal
        // FACT.RECORD pipeline via processNightSummary's raise(), which calls
        // persistFactToD1 above (handles D1 write + ticker for all journalable types)
      }
    });

    if (snapshotStr) {
      console.log(`[L1] ♻️  Resuming Game`);
      const storedData = JSON.parse(snapshotStr);
      // storedData structure: { l2: Snapshot, l3Context: { chatLog: ... } }

      let l2Snapshot = storedData;
      let restoredChatLog = undefined;

      // Handle migration from old format (raw L2 snapshot) to new format
      if (storedData.l2) {
          l2Snapshot = storedData.l2;
          restoredChatLog = storedData.l3Context?.chatLog;
      }

      // Inject restored chat log into L2 context for rehydration
      if (restoredChatLog) {
        l2Snapshot.context.restoredChatLog = restoredChatLog;
        this.lastKnownChatLog = restoredChatLog;
      }

      // Restore ticker history buffer
      if (storedData.tickerHistory) {
        this.tickerHistory = storedData.tickerHistory;
      }

      this.actor = createActor(machineWithPersistence, { snapshot: l2Snapshot });
    } else {
      console.log(`[L1] ✨ Fresh Boot`);
      this.actor = createActor(machineWithPersistence);
    }

    // AUTO-SAVE & ALARM SYSTEM
    this.actor.subscribe(async (snapshot) => {
      
      // Extract L3 Context for Persistence
      let l3Context: any = {};
      let l3Snapshot: any = null;
      const l3Ref = snapshot.children['l3-session'];
      if (l3Ref) {
        try {
          l3Snapshot = l3Ref.getSnapshot();
          if (l3Snapshot) {
            l3Context = l3Snapshot.context;
            // Cache L3 chatLog while L3 is alive
            this.lastKnownChatLog = l3Context.chatLog || [];
          } else {
            console.warn('[L1] ⚠️ L3 ref exists but getSnapshot() returned null');
          }
        } catch (err) {
          console.error('[L1] 💥 L3 snapshot extraction FAILED — L3 may have crashed:', err);
        }
      }

      // Debug logging: L2/L3 state summary
      const l2StateStr = GameServer.flattenState(snapshot.value);
      const l3StateStr = l3Snapshot ? GameServer.flattenState(l3Snapshot.value) : 'ABSENT';
      console.log(`[L1] 🔍 L2=${l2StateStr} | L3=${l3StateStr} | Day=${snapshot.context.dayIndex}`);

      // Debug ticker: broadcast state summary to clients
      const debugSummary = this.buildDebugSummary(snapshot, l3Snapshot);
      if (debugSummary !== this.lastDebugSummary) {
        this.lastDebugSummary = debugSummary;
        console.log(`[L1] 📺 Debug: ${debugSummary}`);
        this.broadcastDebugTicker(debugSummary);
      }

      // A. Save FULL State to Disk (L2 snapshot + L3 chatLog)
      // L2's roster is authoritative (tracks DM costs, transfers, rewards, eliminations).
      // Only chatLog needs separate persistence since it lives in L3.
      const storagePayload = {
          l2: snapshot,
          l3Context: {
              chatLog: l3Context.chatLog ?? this.lastKnownChatLog,
          },
          tickerHistory: this.tickerHistory
      };
      this.ctx.storage.put(STORAGE_KEY, JSON.stringify(storagePayload));

      // B. Schedule via PartyWhen
      const nextWakeup = snapshot.context.nextWakeup;
      if (nextWakeup && nextWakeup > Date.now()) {
        // console.log(`[L1] 📅 Scheduling Wakeup via PartyWhen for: ${new Date(nextWakeup).toISOString()}`);
        
        await this.scheduler.scheduleTask({
          id: `wakeup-${Date.now()}`,
          type: "scheduled",
          time: new Date(nextWakeup),
          callback: { type: "self", function: "wakeUpL2" }
        });
      }

      // C. Extract voting + game cartridge context for client rendering
      let activeVotingCartridge: any = null;
      let rawGameCartridge: any = null;
      try {
        const l3RefForCartridge = snapshot.children['l3-session'];
        if (l3RefForCartridge) {
          const l3Snap = l3RefForCartridge.getSnapshot();
          const votingCartridgeRef = (l3Snap?.children as any)?.['activeVotingCartridge'];
          if (votingCartridgeRef) {
            activeVotingCartridge = votingCartridgeRef.getSnapshot()?.context || null;
          }
          const gameCartridgeRef = (l3Snap?.children as any)?.['activeGameCartridge'];
          if (gameCartridgeRef) {
            rawGameCartridge = gameCartridgeRef.getSnapshot()?.context || null;
          }
        }
      } catch (err) {
        console.error('[L1] 💥 Cartridge context extraction failed:', err);
      }

      // D. Broadcast State to Clients (per-player DM + game filtering)
      // Explicit SYNC payload — L2's roster is authoritative, no blind spread
      const fullChatLog = l3Context.chatLog ?? this.lastKnownChatLog;
      const syncContext = {
        gameId: snapshot.context.gameId,
        dayIndex: snapshot.context.dayIndex,
        roster: snapshot.context.roster,       // Always L2's authoritative roster
        manifest: snapshot.context.manifest,
        activeVotingCartridge,
        winner: snapshot.context.winner,
      };

      for (const ws of this.getConnections()) {
        const state = ws.state as { playerId: string } | null;
        const pid = state?.playerId;
        if (!pid) continue;

        const playerChatLog = fullChatLog.filter((msg: any) =>
          msg.channel === 'MAIN' ||
          (msg.channel === 'DM' && (msg.senderId === pid || msg.targetId === pid))
        );

        const activeGameCartridge = GameServer.projectGameCartridge(rawGameCartridge, pid);

        ws.send(JSON.stringify({
          type: "SYSTEM.SYNC",
          state: snapshot.value,
          context: { ...syncContext, chatLog: playerChatLog, activeGameCartridge }
        }));
      }

      // E. Ticker: detect state transitions
      const currentStateStr = JSON.stringify(snapshot.value);
      if (currentStateStr !== this.lastBroadcastState) {
        const tickerMsg = this.stateToTicker(currentStateStr, snapshot.context);
        if (tickerMsg) this.broadcastTicker(tickerMsg);
        this.lastBroadcastState = currentStateStr;
      }

      // F. Ticker: detect DM open/close changes
      const currentDmsOpen = l3Context.dmsOpen ?? false;
      if (currentDmsOpen !== this.lastKnownDmsOpen) {
        this.lastKnownDmsOpen = currentDmsOpen;
        this.broadcastTicker({
          id: crypto.randomUUID(),
          text: currentDmsOpen ? 'DMs are now open!' : 'DMs are now closed.',
          category: 'SYSTEM',
          timestamp: Date.now(),
        });
      }
    });

    this.actor.start();
  }

  /**
   * 2. HANDOFF: The Lobby calls this via HTTP POST to start the game
   */
  async onRequest(req: Request): Promise<Response> {
    // 1. POST /init (Handoff)
    if (req.method === "POST" && new URL(req.url).pathname.endsWith("/init")) {
      try {
        const json = await req.json() as any;
        
        // Send signal to the Brain
        this.actor?.send({ 
          type: "SYSTEM.INIT", 
          payload: { roster: json.roster, manifest: json.manifest }, 
          gameId: "game-1" 
        });

        return new Response(JSON.stringify({ status: "OK" }), { status: 200 });
      } catch (err) {
        console.error("[L1] POST /init failed:", err);
        return new Response("Invalid Payload", { status: 400 });
      }
    }
    
    // 2. GET /state (Debugging Endpoint)
    if (req.method === "GET" && new URL(req.url).pathname.endsWith("/state")) {
        const snapshot = this.actor?.getSnapshot();
        return new Response(JSON.stringify({
            state: snapshot?.value,
            day: snapshot?.context.dayIndex,
            nextWakeup: snapshot?.context.nextWakeup ? new Date(snapshot.context.nextWakeup).toISOString() : null,
            manifest: snapshot?.context.manifest
        }, null, 2), { 
            status: 200, 
            headers: { "Content-Type": "application/json" } 
        });
    }

    // 3. POST /admin (Manual Control)
    if (req.method === "POST" && new URL(req.url).pathname.endsWith("/admin")) {
        try {
            const body = await req.json() as any;
            console.log(`[L1] 🛡️ Admin Command: ${body.type}`);

            if (body.type === "NEXT_STAGE") {
                this.actor?.send({ type: "ADMIN.NEXT_STAGE" });
            } else if (body.type === "INJECT_TIMELINE_EVENT") {
                this.actor?.send({ 
                    type: "ADMIN.INJECT_TIMELINE_EVENT", 
                    payload: { action: body.action, payload: body.payload } 
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

    return new Response("Not Found", { status: 404 });
  }

  // --- Ticker Pipeline ---

  private broadcastTicker(msg: TickerMessage) {
    // Buffer for late joiners
    this.tickerHistory = [...this.tickerHistory, msg].slice(-20);

    const payload = JSON.stringify({ type: 'TICKER.UPDATE', message: msg });
    for (const ws of this.getConnections()) {
      ws.send(payload);
    }
  }

  private factToTicker(fact: any): TickerMessage | null {
    const roster = this.actor?.getSnapshot()?.context.roster || {};
    const name = (id: string) => roster[id]?.personaName || id;

    switch (fact.type) {
      case 'SILVER_TRANSFER':
        return {
          id: crypto.randomUUID(),
          text: `${name(fact.actorId)} sent ${fact.payload?.amount || '?'} silver to ${name(fact.targetId)}`,
          category: 'SOCIAL',
          timestamp: fact.timestamp,
        };
      case 'GAME_RESULT': {
        const players = fact.payload?.players;
        if (players) {
          const sorted = Object.entries(players)
            .map(([pid, data]: [string, any]) => ({ pid, silver: data.silverReward || 0 }))
            .sort((a, b) => b.silver - a.silver);
          if (sorted.length > 0 && sorted[0].silver > 0) {
            return {
              id: crypto.randomUUID(),
              text: `${name(sorted[0].pid)} earned ${sorted[0].silver} silver in today's game!`,
              category: 'GAME',
              timestamp: fact.timestamp,
            };
          }
        }
        return null;
      }
      case 'PLAYER_GAME_RESULT':
        return {
          id: crypto.randomUUID(),
          text: `${name(fact.actorId)} earned ${fact.payload?.silverReward || 0} silver in today's game!`,
          category: 'GAME',
          timestamp: fact.timestamp,
        };
      case 'ELIMINATION':
        return {
          id: crypto.randomUUID(),
          text: `${name(fact.targetId || fact.actorId)} has been eliminated!`,
          category: 'ELIMINATION',
          timestamp: fact.timestamp,
        };
      case 'WINNER_DECLARED':
        return {
          id: crypto.randomUUID(),
          text: `${name(fact.targetId || fact.actorId)} has won the game!`,
          category: 'SYSTEM',
          timestamp: fact.timestamp,
        };
      default:
        return null;
    }
  }

  private stateToTicker(stateStr: string, context: any): TickerMessage | null {
    const dayIndex = context?.dayIndex || 0;

    if (stateStr.includes('nightSummary')) {
      return { id: crypto.randomUUID(), text: 'Night has fallen...', category: 'SYSTEM', timestamp: Date.now() };
    }
    if (stateStr.includes('morningBriefing')) {
      return { id: crypto.randomUUID(), text: `Day ${dayIndex} has begun!`, category: 'SYSTEM', timestamp: Date.now() };
    }
    if (stateStr.includes('voting')) {
      return { id: crypto.randomUUID(), text: 'Voting has begun!', category: 'VOTE', timestamp: Date.now() };
    }
    if (stateStr.includes('dailyGame')) {
      return { id: crypto.randomUUID(), text: "Today's game is starting!", category: 'GAME', timestamp: Date.now() };
    }
    if (stateStr.includes('gameSummary')) {
      return { id: crypto.randomUUID(), text: 'The winner has been crowned!', category: 'SYSTEM', timestamp: Date.now() };
    }
    if (stateStr.includes('gameOver')) {
      return { id: crypto.randomUUID(), text: 'The game is over!', category: 'SYSTEM', timestamp: Date.now() };
    }
    return null;
  }

  // Flatten nested XState state value to a dot path: { dayLoop: { activeSession: 'running' } } → "dayLoop.activeSession.running"
  private static flattenState(value: any): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      return Object.entries(value).map(([k, v]) => `${k}.${GameServer.flattenState(v)}`).join(', ');
    }
    return String(value);
  }

  private buildDebugSummary(snapshot: any, l3Snapshot: any): string {
    const dayIndex = snapshot.context.dayIndex || 0;
    const l2State = GameServer.flattenState(snapshot.value);
    const manifest = snapshot.context.manifest;
    const currentDay = manifest?.days?.find((d: any) => d.dayIndex === dayIndex);
    const voteType = currentDay?.voteType || '—';
    const gameType = currentDay?.gameType || 'NONE';
    const dmsOpen = l3Snapshot?.context?.dmsOpen ? 'OPEN' : 'CLOSED';

    // Extract L3 mainStage state
    let mainStage = '—';
    if (l3Snapshot?.value?.running?.mainStage) {
      mainStage = l3Snapshot.value.running.mainStage;
    } else if (!l3Snapshot) {
      mainStage = 'NO L3';
    }

    return `DAY ${dayIndex} · L2: ${l2State} · VOTE: ${voteType} · GAME: ${gameType} · DMs: ${dmsOpen} · STAGE: ${mainStage}`;
  }

  private broadcastDebugTicker(summary: string) {
    const payload = JSON.stringify({ type: 'TICKER.DEBUG', summary });
    for (const ws of this.getConnections()) {
      ws.send(payload);
    }
  }

  /**
   * 3. CLIENT SYNC: WebSocket Connection
   */
  onConnect(ws: Connection, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    const playerId = url.searchParams.get("playerId");
    const roster = this.actor?.getSnapshot().context.roster || {};

    if (!playerId || !roster[playerId]) {
      console.log(`[L1] Rejecting connection: Invalid Player ID ${playerId}`);
      ws.close(4001, "Invalid Player ID");
      return;
    }

    // Attach identity to connection
    ws.setState({ playerId });
    console.log(`[L1] Player Connected: ${playerId}`);
    
    // Send current state immediately so client UI hydrates
    const snapshot = this.actor?.getSnapshot();
    if (snapshot) {
      // Build explicit SYNC payload — L2's roster is authoritative, no blind spread
      let l3Context: any = {};
      let activeVotingCartridge: any = null;
      let rawGameCartridge: any = null;
      const l3Ref = snapshot.children['l3-session'];
      if (l3Ref) {
        const l3Snapshot = l3Ref.getSnapshot();
        if (l3Snapshot) {
          l3Context = l3Snapshot.context;
          const votingCartridgeRef = (l3Snapshot.children as any)?.['activeVotingCartridge'];
          if (votingCartridgeRef) {
            activeVotingCartridge = votingCartridgeRef.getSnapshot()?.context || null;
          }
          const gameCartridgeRef = (l3Snapshot.children as any)?.['activeGameCartridge'];
          if (gameCartridgeRef) {
            rawGameCartridge = gameCartridgeRef.getSnapshot()?.context || null;
          }
        }
      }

      const fullChatLog = l3Context.chatLog ?? this.lastKnownChatLog;
      const playerChatLog = fullChatLog.filter((msg: any) =>
        msg.channel === 'MAIN' ||
        (msg.channel === 'DM' && (msg.senderId === playerId || msg.targetId === playerId))
      );
      const activeGameCartridge = GameServer.projectGameCartridge(rawGameCartridge, playerId);

      ws.send(JSON.stringify({
        type: "SYSTEM.SYNC",
        state: snapshot.value,
        context: {
          gameId: snapshot.context.gameId,
          dayIndex: snapshot.context.dayIndex,
          roster: snapshot.context.roster,       // Always L2's authoritative roster
          manifest: snapshot.context.manifest,
          chatLog: playerChatLog,
          activeVotingCartridge,
          activeGameCartridge,
          winner: snapshot.context.winner,
        }
      }));

      // Send ticker history so late joiners see recent events
      if (this.tickerHistory.length > 0) {
        ws.send(JSON.stringify({
          type: 'TICKER.HISTORY',
          messages: this.tickerHistory
        }));
      }

      // Send current debug ticker state
      if (this.lastDebugSummary) {
        ws.send(JSON.stringify({ type: 'TICKER.DEBUG', summary: this.lastDebugSummary }));
      }
    }
  }

  /**
   * 4. MESSAGE: Receive social events from clients
   */
  /**
   * Project game cartridge context per-player.
   * Async games (with `players` record) get filtered to the requesting player's view.
   * Real-time games are broadcast as-is.
   */
  private static projectGameCartridge(gameCtx: any, playerId: string): any {
    if (!gameCtx) return null;

    // Async per-player games have a `players` record
    if (gameCtx.players) {
      const playerState = gameCtx.players[playerId];
      if (!playerState) return null;
      return {
        gameType: gameCtx.gameType,
        status: playerState.status,
        currentRound: playerState.currentRound,
        totalRounds: playerState.totalRounds,
        currentQuestion: playerState.currentQuestion,
        roundDeadline: playerState.status === 'PLAYING' && playerState.questionStartedAt
          ? playerState.questionStartedAt + 15_000
          : null,
        lastRoundResult: playerState.lastRoundResult,
        score: playerState.score,
        correctCount: playerState.correctCount,
        silverReward: playerState.silverReward,
        goldContribution: gameCtx.goldContribution,
      };
    }

    // Real-time games: broadcast full context
    return gameCtx;
  }

  private static ALLOWED_CLIENT_EVENTS = ['SOCIAL.SEND_MSG', 'SOCIAL.SEND_SILVER'];

  onMessage(ws: Connection, message: string) {
    try {
      const event = JSON.parse(message);
      const state = ws.state as { playerId: string } | null;

      console.log(`[L1] 📨 Received message from ${state?.playerId}:`, JSON.stringify(event));

      if (!state?.playerId) {
        console.warn("[L1] Message received from connection without playerId");
        ws.close(4001, "Missing Identity");
        return;
      }

      const isAllowed = GameServer.ALLOWED_CLIENT_EVENTS.includes(event.type)
        || (typeof event.type === 'string' && event.type.startsWith('VOTE.'))
        || (typeof event.type === 'string' && event.type.startsWith('GAME.'));
      if (!isAllowed) {
        console.warn(`[L1] Rejected event type from client: ${event.type}`);
        return;
      }

      // Inject senderId to prevent spoofing
      this.actor?.send({
        ...event,
        senderId: state.playerId
      });

    } catch (err) {
      console.error("[L1] Error processing message:", err);
    }
  }

  /**
   * 5. TIME: The Cloudflare Alarm wakes us up
   */
  async onAlarm() {
    // Delegate to PartyWhen Scheduler instance
    await this.scheduler.alarm();
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return (await routePartykitRequest(request, env)) || new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;