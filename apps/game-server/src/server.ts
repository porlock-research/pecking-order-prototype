import { Server, routePartykitRequest, Connection, ConnectionContext } from "partyserver";
import { Roster, GameStatus } from "@pecking-order/shared-types";
import { log } from "@pecking-order/logger";

// Define the Environment bindings (Must match wrangler.toml)
export interface Env {
  GAME: DurableObjectNamespace;
  DB: D1Database;
  AXIOM_DATASET: string;
  AXIOM_TOKEN?: string;
  AXIOM_ORG_ID?: string;
}

// The Durable Object Class (Party)
export class GameServer extends Server<Env> {
  
  onConnect(ws: Connection, ctx: ConnectionContext) {
    // Access environment via this.env
    log(null, "INFO", "Client connected to Game Server", { 
      layer: "L1", 
      roomId: this.name, // In partyserver, `name` is the room ID? Verify via docs or assume standard DO pattern
    }, this.env);
    
    console.log(`Server Ready. Room: ${this.name}`);
  }

  // Handle HTTP requests sent to this specific room (e.g. from Lobby Handoff)
  async onRequest(req: Request): Promise<Response> {
    if (req.method === "POST") {
      const body = await req.json();
      // TODO: Implement Handoff Logic (save Roster, init L2)
      return new Response(JSON.stringify({ status: "OK", room: this.name }), { status: 200 });
    }
    return new Response("Method Not Allowed", { status: 405 });
  }
}

// The Worker Entry Point (Router)
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;