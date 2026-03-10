/**
 * DemoServer — isolated Durable Object for UI/UX testing.
 *
 * Separate from GameServer (ADR-095). No voting, games, day progression,
 * alarms, or persistence. Pre-seeded mid-game state with real personas.
 */
import { Server, type Connection, type ConnectionContext } from 'partyserver';
import { createActor } from 'xstate';
import { Events } from '@pecking-order/shared-types';
import { demoMachine } from './demo-machine';
import { getDemoPersonas } from './demo-seed';
import { buildDemoSyncPayload, broadcastDemoSync } from './demo-sync';
import { getOnlinePlayerIds, broadcastPresence } from '../ws-handlers';
import type { Env } from '../types';

export class DemoServer extends Server<Env> {
  static options = { hibernate: true };

  private demoActor: ReturnType<typeof createActor<typeof demoMachine>> | undefined;
  private connectedPlayers = new Map<string, Set<string>>();

  async onStart() {
    // Always auto-initialize — the demo is always on
    this.initDemoActor('DEMO');
  }

  private initDemoActor(gameId: string) {
    this.demoActor = createActor(demoMachine, {
      input: { gameId, assetsBase: this.env.PERSONA_ASSETS_URL },
    });
    this.demoActor.subscribe(() => {
      broadcastDemoSync(
        this.demoActor!.getSnapshot().context,
        () => this.getConnections(),
        this.connectedPlayers,
      );
    });
    this.demoActor.start();
  }

  // --- HTTP ---

  async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // GET /join-demo — unauthenticated, returns persona list
    if (req.method === 'GET' && path.endsWith('/join-demo')) {
      const ctx = this.demoActor!.getSnapshot().context;
      const personas = getDemoPersonas(this.env.PERSONA_ASSETS_URL);
      return Response.json(
        {
          gameId: ctx.gameId,
          personas: personas.map(p => ({
            id: p.id,
            personaName: p.personaName,
            avatarUrl: p.avatarUrl,
            silver: ctx.roster[p.id]?.silver ?? 0,
          })),
        },
        { headers: corsHeaders },
      );
    }

    return new Response('Not Found', { status: 404 });
  }

  // --- WEBSOCKET ---

  async onConnect(ws: Connection, ctx: ConnectionContext) {
    const url = new URL(ctx.request.url);
    const playerId = url.searchParams.get('playerId');
    const roster = this.demoActor!.getSnapshot().context.roster;

    if (!playerId || !roster[playerId]) {
      ws.close(4001, 'Invalid Player ID');
      return;
    }

    ws.setState({ playerId });
    ws.serializeAttachment({ playerId });

    // Track presence
    const existing = this.connectedPlayers.get(playerId) || new Set();
    existing.add(ws.id);
    this.connectedPlayers.set(playerId, existing);

    // Send initial SYNC
    const onlinePlayers = getOnlinePlayerIds(this.connectedPlayers);
    ws.send(JSON.stringify(buildDemoSyncPayload(this.demoActor!.getSnapshot().context, playerId, onlinePlayers)));

    broadcastPresence(this.connectedPlayers, () => this.getConnections());
  }

  onClose(ws: Connection) {
    const state = ws.state as { playerId: string } | null;
    const playerId = state?.playerId || ws.deserializeAttachment()?.playerId;
    if (!playerId) return;

    const conns = this.connectedPlayers.get(playerId);
    if (conns) {
      conns.delete(ws.id);
      if (conns.size === 0) this.connectedPlayers.delete(playerId);
    }
    broadcastPresence(this.connectedPlayers, () => this.getConnections());
  }

  onMessage(ws: Connection, message: string) {
    if (!this.demoActor) return;

    try {
      const event = JSON.parse(message);
      const state = ws.state as { playerId: string } | null;
      const playerId = state?.playerId || ws.deserializeAttachment()?.playerId;
      if (!playerId) {
        ws.close(4001, 'Missing Identity');
        return;
      }

      // Re-set ws.state if lost after hibernation
      if (!state?.playerId) ws.setState({ playerId });

      // Presence: relay typing indicators
      if (event.type === Events.Presence.TYPING || event.type === Events.Presence.STOP_TYPING) {
        const msg = JSON.stringify({ type: event.type, playerId, channel: event.channel || 'MAIN' });
        for (const other of this.getConnections()) {
          if (other !== ws) other.send(msg);
        }
        return;
      }

      // Only allow social events
      const allowed = [Events.Social.SEND_MSG, Events.Social.CREATE_CHANNEL, Events.Social.SEND_SILVER];
      if (allowed.includes(event.type)) {
        this.demoActor.send({ ...event, senderId: playerId });
      }
    } catch { /* ignore malformed messages */ }
  }
}
