/**
 * ShowcaseServer — singleton Durable Object for feature demos.
 *
 * No auth, no alarms, no timeline. Spawns real cartridge machines
 * triggered via admin panel. Round-robin player assignment.
 */
import { Server, type Connection, type ConnectionContext } from 'partyserver';
import { createActor, type AnyActorRef } from 'xstate';
import { Events } from '@pecking-order/shared-types';
import type { DilemmaType } from '@pecking-order/shared-types';
import { showcaseMachine, type ShowcaseConfig } from './showcase-machine';
import { buildShowcaseRoster } from './showcase-seed';
import { buildShowcaseSyncPayload, broadcastShowcaseSync, type ShowcaseSyncDeps } from './showcase-sync';
import { getOnlinePlayerIds, broadcastPresence } from '../ws-handlers';
import type { Env } from '../types';

const DEFAULT_CONFIG: ShowcaseConfig = {
  features: ['dilemma'],
  players: 4,
  dilemma: { types: ['SILVER_GAMBIT', 'SPOTLIGHT', 'GIFT_OR_GRIEF'] as DilemmaType[] },
};

export class ShowcaseServer extends Server<Env> {
  static options = { hibernate: true };

  private actor: ReturnType<typeof createActor<typeof showcaseMachine>> | undefined;
  private connectedPlayers = new Map<string, Set<string>>();
  private nextSlot = 0;

  async onStart() {
    const config = this.loadConfig() || DEFAULT_CONFIG;
    const roster = buildShowcaseRoster(config.players, this.env.PERSONA_ASSETS_URL);
    this.initActor(config, roster);
  }

  private initActor(config: ShowcaseConfig, roster: Record<string, any>) {
    if (this.actor) {
      this.actor.stop();
    }

    this.actor = createActor(showcaseMachine, {
      input: { gameId: 'SHOWCASE', roster, config },
    });
    this.actor.subscribe(() => {
      this.broadcastSync();
    });
    this.actor.start();
    this.nextSlot = 0;
  }

  // --- Config Persistence (SQLite) ---

  private loadConfig(): ShowcaseConfig | null {
    try {
      this.ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS showcase_config (key TEXT PRIMARY KEY, value TEXT)`
      );
      const rows = this.ctx.storage.sql.exec(
        `SELECT value FROM showcase_config WHERE key = 'config'`
      ).toArray();
      if (rows.length > 0) {
        return JSON.parse(rows[0].value as string);
      }
    } catch { /* first boot — no table yet */ }
    return null;
  }

  private saveConfig(config: ShowcaseConfig) {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS showcase_config (key TEXT PRIMARY KEY, value TEXT)`
    );
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO showcase_config (key, value) VALUES ('config', ?)`,
      JSON.stringify(config),
    );
  }

  // --- Sync ---

  private buildSyncDeps(): ShowcaseSyncDeps {
    const snap = this.actor!.getSnapshot();
    const ctx = snap.context;
    const stateValue = typeof snap.value === 'string' ? snap.value : 'idle';

    let dilemmaChildSnapshot = null;
    if (stateValue === 'running') {
      const child = snap.children['activeDilemmaCartridge'] as AnyActorRef | undefined;
      if (child) {
        dilemmaChildSnapshot = child.getSnapshot();
      }
    }

    return {
      gameId: ctx.gameId,
      roster: ctx.roster,
      config: ctx.config,
      showcaseState: stateValue,
      dilemmaChildSnapshot,
      lastResults: ctx.lastResults,
    };
  }

  private broadcastSync() {
    broadcastShowcaseSync(
      this.buildSyncDeps(),
      () => this.getConnections(),
      this.connectedPlayers,
    );
  }

  // --- HTTP ---

  async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop() || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method === 'POST' && path === 'configure') {
      const config = await req.json() as ShowcaseConfig;
      this.saveConfig(config);
      const roster = buildShowcaseRoster(config.players, this.env.PERSONA_ASSETS_URL);
      this.initActor(config, roster);
      this.broadcastSync();
      return Response.json({ ok: true, config }, { headers: corsHeaders });
    }

    if (req.method === 'GET' && path === 'config') {
      const snap = this.actor!.getSnapshot();
      return Response.json({
        config: snap.context.config,
        roster: snap.context.roster,
        state: typeof snap.value === 'string' ? snap.value : 'idle',
      }, { headers: corsHeaders });
    }

    if (req.method === 'POST' && path === 'admin') {
      const action = await req.json() as any;
      return this.handleAdmin(action, corsHeaders);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  private handleAdmin(action: any, headers: Record<string, string>): Response {
    if (!this.actor) {
      return Response.json({ error: 'Not initialized' }, { status: 500, headers });
    }

    switch (action.type) {
      case 'ADMIN.START_DILEMMA':
        this.actor.send({ type: 'ADMIN.START_DILEMMA', dilemmaType: action.dilemmaType });
        break;

      case 'ADMIN.FORCE_END':
        this.actor.send({ type: 'ADMIN.FORCE_END' });
        break;

      case 'ADMIN.RESET':
        this.actor.send({ type: 'ADMIN.RESET' });
        break;

      case 'ADMIN.SIMULATE': {
        const snap = this.actor.getSnapshot();
        const child = snap.children['activeDilemmaCartridge'] as AnyActorRef | undefined;
        if (child) {
          child.send({ ...action.event, senderId: action.playerId });
          this.broadcastSync();
        }
        break;
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400, headers });
    }

    return Response.json({ ok: true }, { headers });
  }

  // --- WEBSOCKET ---

  async onConnect(ws: Connection, ctx: ConnectionContext) {
    if (!this.actor) return;

    const snap = this.actor.getSnapshot();
    const playerCount = Object.keys(snap.context.roster).length;
    const playerId = `p${this.nextSlot % playerCount}`;
    this.nextSlot++;

    ws.setState({ playerId });
    ws.serializeAttachment({ playerId });

    const existing = this.connectedPlayers.get(playerId) || new Set();
    existing.add(ws.id);
    this.connectedPlayers.set(playerId, existing);

    const onlinePlayers = getOnlinePlayerIds(this.connectedPlayers);
    ws.send(JSON.stringify(buildShowcaseSyncPayload(this.buildSyncDeps(), playerId, onlinePlayers)));
    ws.send(JSON.stringify({ type: 'SHOWCASE.PLAYER_ASSIGNED', playerId }));

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
    if (!this.actor) return;

    try {
      const event = JSON.parse(message);
      const state = ws.state as { playerId: string } | null;
      const playerId = state?.playerId || ws.deserializeAttachment()?.playerId;
      if (!playerId) {
        ws.close(4001, 'Missing Identity');
        return;
      }

      if (!state?.playerId) ws.setState({ playerId });

      if (event.type?.startsWith('DILEMMA.')) {
        const snap = this.actor.getSnapshot();
        const child = snap.children['activeDilemmaCartridge'] as AnyActorRef | undefined;
        if (child) {
          child.send({ ...event, senderId: playerId });
          this.broadcastSync();
        }
      }
    } catch { /* ignore malformed messages */ }
  }
}
