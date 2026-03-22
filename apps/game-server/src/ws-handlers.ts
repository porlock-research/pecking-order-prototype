import type { Connection, ConnectionContext } from "partyserver";
import type { ActorRefFrom } from "xstate";
import type { TickerMessage } from "@pecking-order/shared-types";
import { Events, ALLOWED_CLIENT_EVENTS as CLIENT_EVENTS } from "@pecking-order/shared-types";
import type { orchestratorMachine } from "./machines/l2-orchestrator";
import { extractCartridges, extractL3Context, buildSyncPayload } from "./sync";
import { safeSerializeSnapshot } from "./inspect";
import { log } from "./log";
import { timingSafeEqual } from "./http-handlers";
import type { Env } from "./types";

const ALLOWED_CLIENT_EVENTS = CLIENT_EVENTS as readonly string[];

export interface WsContext {
  actor: ActorRefFrom<typeof orchestratorMachine> | undefined;
  env: Env;
  connectedPlayers: Map<string, Set<string>>;
  inspectSubscribers: Set<Connection>;
  tickerHistory: TickerMessage[];
  lastDebugSummary: string;
  lastKnownChatLog: any[];
  getConnections: () => Iterable<Connection>;
}

// --- Presence ---

export function getOnlinePlayerIds(connectedPlayers: Map<string, Set<string>>): string[] {
  return Array.from(connectedPlayers.keys());
}

export function broadcastPresence(connectedPlayers: Map<string, Set<string>>, getConnections: () => Iterable<Connection>): void {
  const msg = JSON.stringify({
    type: Events.Presence.UPDATE,
    onlinePlayers: getOnlinePlayerIds(connectedPlayers),
  });
  for (const ws of getConnections()) {
    ws.send(msg);
  }
}

export function rebuildConnectedPlayers(connectedPlayers: Map<string, Set<string>>, getConnections: () => Iterable<Connection>): void {
  connectedPlayers.clear();
  for (const ws of getConnections()) {
    const attachment = ws.deserializeAttachment();
    if (attachment?.playerId) {
      const existing = connectedPlayers.get(attachment.playerId) || new Set();
      existing.add(ws.id);
      connectedPlayers.set(attachment.playerId, existing);
    }
  }
}

/** Send a JSON message to a specific player's WebSocket connection. */
export function sendToPlayer(getConnections: () => Iterable<Connection>, playerId: string, message: any): void {
  for (const ws of getConnections()) {
    const state = ws.state as { playerId: string } | null;
    const wsPlayerId = state?.playerId || ws.deserializeAttachment()?.playerId;
    if (wsPlayerId === playerId) {
      ws.send(JSON.stringify(message));
      break;
    }
  }
}

// --- WebSocket lifecycle ---

export async function handleConnect(ctx: WsContext, ws: Connection, connCtx: ConnectionContext): Promise<void> {
  const url = new URL(connCtx.request.url);

  // --- Standard game mode ---
  const roster = ctx.actor?.getSnapshot().context.roster || {};

  // Admin connections: Bearer token auth for inspector/admin tools
  const adminSecret = url.searchParams.get("adminSecret");
  if (adminSecret) {
    if (!ctx.env.AUTH_SECRET || !timingSafeEqual(adminSecret, ctx.env.AUTH_SECRET)) {
      ws.close(4003, "Invalid admin secret");
      return;
    }
    ws.setState({ playerId: '__admin__', isAdmin: true });
    ws.serializeAttachment({ playerId: '__admin__', isAdmin: true });
    log('info', 'L1', 'Admin connection established');
    return;
  }

  let playerId: string | null = null;
  const token = url.searchParams.get("token");
  if (token) {
    try {
      const { verifyGameToken } = await import("@pecking-order/auth");
      const payload = await verifyGameToken(token, ctx.env.AUTH_SECRET);
      playerId = payload.playerId;
    } catch (err) {
      log('warn', 'L1', 'JWT verification failed', { error: String(err) });
      ws.close(4003, "Invalid token");
      return;
    }
  } else {
    playerId = url.searchParams.get("playerId");
  }

  if (!playerId || !roster[playerId]) {
    log('warn', 'L1', 'Rejecting connection: invalid player ID', { playerId });
    ws.close(4001, "Invalid Player ID");
    return;
  }

  ws.setState({ playerId });
  ws.serializeAttachment({ playerId });
  log('info', 'L1', 'Player connected', { playerId, auth: token ? 'JWT' : 'legacy' });

  // Track connection for presence
  const connId = ws.id;
  const existing = ctx.connectedPlayers.get(playerId) || new Set();
  existing.add(connId);
  ctx.connectedPlayers.set(playerId, existing);

  const snapshot = ctx.actor?.getSnapshot();
  if (snapshot) {
    const { l3Context, l3Snapshot, chatLog } = extractL3Context(snapshot, ctx.lastKnownChatLog);
    const cartridges = extractCartridges(snapshot);
    const onlinePlayers = getOnlinePlayerIds(ctx.connectedPlayers);
    ws.send(JSON.stringify(buildSyncPayload({ snapshot, l3Context, l3SnapshotValue: l3Snapshot?.value, chatLog, cartridges }, playerId, onlinePlayers)));

    if (ctx.tickerHistory.length > 0) {
      ws.send(JSON.stringify({ type: Events.Ticker.HISTORY, messages: ctx.tickerHistory }));
    }
    if (ctx.lastDebugSummary) {
      ws.send(JSON.stringify({ type: Events.Ticker.DEBUG, summary: ctx.lastDebugSummary }));
    }
  }

  broadcastPresence(ctx.connectedPlayers, ctx.getConnections);
}

export function handleClose(ctx: WsContext, ws: Connection): void {
  // ws.state may be lost after hibernation — fall back to attachment
  const state = ws.state as { playerId: string } | null;
  const playerId = state?.playerId || ws.deserializeAttachment()?.playerId;
  if (!playerId) return;

  const conns = ctx.connectedPlayers.get(playerId);
  if (conns) {
    conns.delete(ws.id);
    if (conns.size === 0) {
      ctx.connectedPlayers.delete(playerId);
    }
  }
  ctx.inspectSubscribers.delete(ws);
  broadcastPresence(ctx.connectedPlayers, ctx.getConnections);
}

export function handleMessage(ctx: WsContext, ws: Connection, message: string): void {
  try {
    const event = JSON.parse(message);
    // ws.state may be lost after hibernation — fall back to attachment
    const state = ws.state as { playerId: string; isAdmin?: boolean } | null;
    const attachment = ws.deserializeAttachment();
    const playerId = state?.playerId || attachment?.playerId;
    const isAdmin = state?.isAdmin || attachment?.isAdmin;

    if (!playerId) {
      log('warn', 'L1', 'Message received from connection without playerId');
      ws.close(4001, "Missing Identity");
      return;
    }

    // Re-set ws.state if it was lost (so subsequent reads in this session work)
    if (!state?.playerId && playerId) {
      ws.setState({ playerId, isAdmin });
    }

    // Inspector: admin clients can subscribe to inspection events
    if (event.type === 'INSPECT.SUBSCRIBE') {
      ctx.inspectSubscribers.add(ws);
      log('info', 'L1', 'Inspector subscriber added', { playerId });

      // Replay current actor state so late-connecting inspectors see existing actors
      if (ctx.actor) {
        const snapshot = ctx.actor.getSnapshot();
        const now = Date.now();
        const rootId = ctx.actor.id || 'pecking-order-l2';

        // Replay root (L2) actor
        ws.send(JSON.stringify({
          type: 'INSPECT.ACTOR',
          actorId: rootId,
          snapshot: safeSerializeSnapshot(snapshot),
          timestamp: now,
        }));
        ws.send(JSON.stringify({
          type: 'INSPECT.SNAPSHOT',
          actorId: rootId,
          snapshot: safeSerializeSnapshot(snapshot),
          timestamp: now,
        }));

        // Replay child actors (L3 session, cartridges, etc.)
        if (snapshot.children) {
          for (const [childId, childRef] of Object.entries(snapshot.children)) {
            try {
              const childSnapshot = (childRef as any).getSnapshot?.();
              if (childSnapshot) {
                ws.send(JSON.stringify({
                  type: 'INSPECT.ACTOR',
                  actorId: childId,
                  snapshot: safeSerializeSnapshot(childSnapshot),
                  timestamp: now,
                }));
                ws.send(JSON.stringify({
                  type: 'INSPECT.SNAPSHOT',
                  actorId: childId,
                  snapshot: safeSerializeSnapshot(childSnapshot),
                  timestamp: now,
                }));
              }
            } catch { /* child may not have a snapshot */ }
          }
        }
      }
      return;
    }
    if (event.type === 'INSPECT.UNSUBSCRIBE') {
      ctx.inspectSubscribers.delete(ws);
      return;
    }

    // Admin connections can only use inspector events
    if (isAdmin) return;

    // Presence: relay typing indicators without touching XState
    if (event.type === Events.Presence.TYPING) {
      const msg = JSON.stringify({
        type: Events.Presence.TYPING,
        playerId,
        channel: event.channel || 'MAIN',
      });
      for (const other of ctx.getConnections()) {
        if (other !== ws) other.send(msg);
      }
      return;
    }
    if (event.type === Events.Presence.STOP_TYPING) {
      const msg = JSON.stringify({
        type: Events.Presence.STOP_TYPING,
        playerId,
        channel: event.channel || 'MAIN',
      });
      for (const other of ctx.getConnections()) {
        if (other !== ws) other.send(msg);
      }
      return;
    }

    const isAllowed = ALLOWED_CLIENT_EVENTS.includes(event.type)
      || (typeof event.type === 'string' && event.type.startsWith(Events.Vote.PREFIX))
      || (typeof event.type === 'string' && event.type.startsWith(Events.Game.PREFIX))
      || (typeof event.type === 'string' && event.type.startsWith(Events.Activity.PREFIX))
      || (typeof event.type === 'string' && event.type.startsWith(Events.Dilemma.PREFIX));
    if (!isAllowed) {
      log('warn', 'L1', 'Rejected event type from client', { eventType: event.type });
      return;
    }

    ctx.actor?.send({ ...event, senderId: playerId });
  } catch (err) {
    log('error', 'L1', 'Error processing message', { error: String(err) });
  }
}
