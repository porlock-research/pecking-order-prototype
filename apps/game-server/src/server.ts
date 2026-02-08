import { Server, routePartykitRequest, Connection, ConnectionContext } from "partyserver";
import { Roster, InitPayloadSchema } from "@pecking-order/shared-types";
import { log } from "@pecking-order/logger";

export interface Env {
  GameServer: DurableObjectNamespace;
  DB: D1Database;
  AXIOM_DATASET: string;
  AXIOM_TOKEN?: string;
  AXIOM_ORG_ID?: string;
}

export class GameServer extends Server<Env> {
  
  onConnect(ws: Connection, ctx: ConnectionContext) {
    log(null, "INFO", "Client connected", { layer: "L1", roomId: this.name }, this.env);
    console.log(`[GameServer] Client connected to ${this.name}`);
  }

  async onRequest(req: Request): Promise<Response> {
    if (req.method === "POST" && new URL(req.url).pathname.endsWith("/init")) {
      try {
        const json = await req.json();
        
        // 1. Validate Payload
        const payload = InitPayloadSchema.parse(json);
        
        // 2. Persist State
        await this.ctx.storage.put("roster", payload.roster);
        await this.ctx.storage.put("manifest", payload.manifest);
        await this.ctx.storage.put("status", "PRE_GAME");

        // 3. Log
        log(null, "INFO", "Game Initialized", { 
          layer: "L1", 
          roomId: this.name, 
          playerCount: Object.keys(payload.roster).length 
        }, this.env);

        // 4. Set Alarm (Stub: Wake up in 10 seconds to prove aliveness)
        await this.ctx.storage.setAlarm(Date.now() + 10000);

        return new Response(JSON.stringify({ status: "OK", room: this.name }), { 
          status: 200, 
          headers: { "Content-Type": "application/json" } 
        });

      } catch (err) {
        console.error(err);
        return new Response("Invalid Payload", { status: 400 });
      }
    }
    
    if (req.method === "GET") {
        return new Response(`Game Server Active: ${this.name}`);
    }

    return new Response("Method Not Allowed", { status: 405 });
  }

  async onAlarm() {
    console.log(`[GameServer] Alarm fired for ${this.name}! The Game Loop begins...`);
    // In real implementation: Check L2 state, process day/night cycle.
    
    // Check D1 Binding (Smoke Test)
    if (this.env.DB) {
        console.log("[GameServer] D1 Binding is present.");
    } else {
        console.error("[GameServer] D1 Binding MISSING.");
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    console.log(`[GameServer] Incoming: ${request.method} ${url.pathname}`);

    // Manual Routing: /parties/GameServer/:id/...
    // This bypasses `routePartykitRequest` which was failing to detect the binding
    if (url.pathname.startsWith("/parties/GameServer/")) {
      const parts = url.pathname.split("/");
      const roomId = parts[3]; // ["", "parties", "GameServer", "ROOM_ID", ...]

      if (!roomId) {
        return new Response("Missing Room ID", { status: 400 });
      }

      console.log(`[GameServer] Routing to Room: ${roomId}`);
      
      try {
        const id = env.GameServer.idFromName(roomId);
        const stub = env.GameServer.get(id);
        return await stub.fetch(request);
      } catch (err: any) {
        console.error("[GameServer] DO Error:", err);
        return new Response(`DO Error: ${err.message}`, { status: 500 });
      }
    }

    return new Response("Not Found (Manual Router)", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
