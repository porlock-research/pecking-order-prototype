import { Server, routePartykitRequest, Connection, ConnectionContext } from "partyserver";
import { createActor, ActorRefFrom } from "xstate";
import { orchestratorMachine } from "./machines/l2-orchestrator";
import { Scheduler } from "partywhen";

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
    const machineWithPersistence = orchestratorMachine.provide({
      actions: {
        logToJournal: ({ event }) => {
          if (event.type !== 'FACT.RECORD') return;
          const fact = event.fact;
          console.log(`[L1] 📝 Persisting Fact: ${fact.type}`);
          
          // Fire and forget D1 insert
          this.env.DB.prepare(
            `INSERT INTO GameJournal (id, game_id, day_index, timestamp, event_type, actor_id, target_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            crypto.randomUUID(),
            'game-1', // TODO: Get from context if possible, or use fixed
            0, // TODO: Get dayIndex from context if possible
            fact.timestamp,
            fact.type,
            fact.actorId,
            fact.targetId || null,
            JSON.stringify(fact.payload || {})
          ).run().catch(err => {
            console.error("[L1] 💥 Failed to write to Journal:", err);
          });
        }
      }
    });

    if (snapshotStr) {
      console.log(`[L1] ♻️  Resuming Game`);
      const snapshot = JSON.parse(snapshotStr);
      this.actor = createActor(machineWithPersistence, { snapshot });
    } else {
      console.log(`[L1] ✨ Fresh Boot`);
      this.actor = createActor(machineWithPersistence);
    }

    // AUTO-SAVE & ALARM SYSTEM
    this.actor.subscribe(async (snapshot) => {
      // A. Save State to Disk (Critical for crash recovery)
      this.ctx.storage.put(STORAGE_KEY, JSON.stringify(snapshot));

      // B. Schedule via PartyWhen
      const nextWakeup = snapshot.context.nextWakeup;
      if (nextWakeup && nextWakeup > Date.now()) {
        console.log(`[L1] 📅 Scheduling Wakeup via PartyWhen for: ${new Date(nextWakeup).toISOString()}`);
        
        await this.scheduler.scheduleTask({
          id: `wakeup-${Date.now()}`,
          type: "scheduled",
          time: new Date(nextWakeup),
          callback: { type: "self", function: "wakeUpL2" }
        });

        const alarm = await this.ctx.storage.getAlarm();
        console.log(`[L1] Debug: Alarm status after schedule: ${alarm ? new Date(alarm).toISOString() : "None"}`);
      }

      // C. Broadcast State to Clients
      // We attempt to grab L3 context if it exists, as it holds the "Real" roster/chat during the day
      let l3Context = {};
      const l3Ref = snapshot.children['l3-session'];
      if (l3Ref) {
        const l3Snapshot = l3Ref.getSnapshot();
        if (l3Snapshot) {
          l3Context = l3Snapshot.context;
        }
      }

      const combinedContext = {
        ...snapshot.context,
        ...l3Context
      };

      this.broadcast(JSON.stringify({
        type: "SYSTEM.SYNC",
        state: snapshot.value,
        context: combinedContext
      }));
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
      // START MERGE LOGIC
      let l3Context = {};
      const l3Ref = snapshot.children['l3-session'];
      if (l3Ref) {
        const l3Snapshot = l3Ref.getSnapshot();
        if (l3Snapshot) {
          l3Context = l3Snapshot.context;
        }
      }
      
      const combinedContext = {
        ...snapshot.context,
        ...l3Context
      };
      // END MERGE LOGIC

      ws.send(JSON.stringify({
        type: "SYSTEM.SYNC",
        state: snapshot.value,
        context: combinedContext
      }));
    }
  }

  /**
   * 4. MESSAGE: Receive social events from clients
   */
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