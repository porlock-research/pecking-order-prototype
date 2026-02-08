import { Server, routePartykitRequest, Connection, ConnectionContext } from "partyserver";
import { createActor, ActorRefFrom } from "xstate";
import { orchestratorMachine } from "./machines/l2-orchestrator";

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

  /**
   * 1. LIFECYCLE: Boot up the Brain
   * Called automatically when the Durable Object is instantiated
   */
  async onStart() {
    // Load previous state from disk
    const snapshotStr = await this.ctx.storage.get<string>(STORAGE_KEY);
    
    if (snapshotStr) {
      console.log(`[L1] ♻️  Resuming Game`);
      const snapshot = JSON.parse(snapshotStr);
      this.actor = createActor(orchestratorMachine, { snapshot });
    } else {
      console.log(`[L1] ✨ Fresh Boot`);
      this.actor = createActor(orchestratorMachine);
    }

    // AUTO-SAVE & ALARM SYSTEM
    this.actor.subscribe((snapshot) => {
      // A. Save State to Disk (Critical for crash recovery)
      this.ctx.storage.put(STORAGE_KEY, JSON.stringify(snapshot));

      // B. Schedule Physical Alarm if Logic requests it
      const nextWakeup = snapshot.context.nextWakeup;
      if (nextWakeup && nextWakeup > Date.now()) {
        console.log(`[L1] ⏰ Setting Alarm for: ${new Date(nextWakeup).toISOString()}`);
        this.ctx.storage.setAlarm(nextWakeup);
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
          gameId: "game-1" // Fallback since this.name might be flaky in local dev during early lifecycle
        });

        return new Response(JSON.stringify({ status: "OK" }), { status: 200 });
      } catch (err) {
        return new Response("Invalid Payload", { status: 400 });
      }
    }
    
    // 2. GET /state (Debugging Endpoint)
    if (req.method === "GET") {
        const snapshot = this.actor?.getSnapshot();
        return new Response(JSON.stringify({
            state: snapshot?.value,     // e.g., "preGame"
            day: snapshot?.context.dayIndex,
            nextWakeup: snapshot?.context.nextWakeup ? new Date(snapshot.context.nextWakeup).toISOString() : null
        }, null, 2), { 
            status: 200, 
            headers: { "Content-Type": "application/json" } 
        });
    }

    return new Response("Method Not Allowed", { status: 405 });
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
      ws.send(JSON.stringify({
        type: "SYSTEM.SYNC",
        state: snapshot.value,
        context: snapshot.context
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
    console.log(`[L1] ⏰ RRRRING! Alarm fired.`);
    // Tell the Brain to wake up.
    this.actor?.send({ type: "SYSTEM.WAKEUP" });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return (await routePartykitRequest(request, env)) || new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;