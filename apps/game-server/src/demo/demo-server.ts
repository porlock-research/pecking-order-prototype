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
import { DEMO_PERSONAS } from './demo-seed';
import { buildDemoSyncPayload, broadcastDemoSync } from './demo-sync';
import { ensureSnapshotsTable } from '../snapshot';
import { getOnlinePlayerIds, broadcastPresence } from '../ws-handlers';
import type { Env } from '../types';

export class DemoServer extends Server<Env> {
  static options = { hibernate: true };

  private demoActor: ReturnType<typeof createActor<typeof demoMachine>> | undefined;
  private connectedPlayers = new Map<string, Set<string>>();

  async onStart() {
    ensureSnapshotsTable(this.ctx.storage);

    // Check if already initialized (survives DO restarts)
    const rows = this.ctx.storage.sql
      .exec("SELECT value FROM snapshots WHERE key = 'demo_mode'")
      .toArray();

    if (rows.length > 0) {
      this.initDemoActor((rows[0] as any).value || 'DEMO');
    }
  }

  private initDemoActor(gameId: string) {
    this.demoActor = createActor(demoMachine, { input: { gameId } });
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

    // POST /init-demo — admin-authed, initializes demo game
    if (req.method === 'POST' && path.endsWith('/init-demo')) {
      const auth = req.headers.get('Authorization');
      if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== this.env.AUTH_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }

      const gameId = path.split('/').slice(-2, -1)[0] || 'DEMO';
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO snapshots (key, value, updated_at) VALUES ('demo_mode', ?, unixepoch())",
        gameId,
      );
      this.initDemoActor(gameId);

      return Response.json(
        { status: 'OK', gameId, personas: DEMO_PERSONAS.map(p => ({ id: p.id, personaName: p.personaName, avatarUrl: p.avatarUrl })) },
        { headers: corsHeaders },
      );
    }

    // GET /join-demo — unauthenticated, returns persona list
    if (req.method === 'GET' && path.endsWith('/join-demo')) {
      if (!this.demoActor) {
        return Response.json({ error: 'Demo not initialized' }, { status: 400, headers: corsHeaders });
      }
      const roster = this.demoActor.getSnapshot().context.roster;
      return Response.json(
        {
          gameId: this.demoActor.getSnapshot().context.gameId,
          personas: DEMO_PERSONAS.map(p => ({
            id: p.id,
            personaName: p.personaName,
            avatarUrl: p.avatarUrl,
            silver: roster[p.id]?.silver ?? 0,
          })),
        },
        { headers: corsHeaders },
      );
    }

    return new Response('Not Found', { status: 404 });
  }

  // --- WEBSOCKET ---

  async onConnect(ws: Connection, ctx: ConnectionContext) {
    if (!this.demoActor) {
      ws.close(4001, 'Demo not initialized');
      return;
    }

    const url = new URL(ctx.request.url);
    const playerId = url.searchParams.get('playerId');
    const roster = this.demoActor.getSnapshot().context.roster;

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
    ws.send(JSON.stringify(buildDemoSyncPayload(this.demoActor.getSnapshot().context, playerId, onlinePlayers)));

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
