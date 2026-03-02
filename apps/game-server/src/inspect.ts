import { log } from './log';

/**
 * Flatten XState v5 state value to a readable dot-path.
 * e.g. { dayLoop: { activeSession: { running: {} } } } → "dayLoop.activeSession.running"
 */
export function flattenValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value);
    if (entries.length === 0) return '';
    // Parallel states: join with " | "
    return entries
      .map(([k, v]) => {
        const child = flattenValue(v);
        return child ? `${k}.${child}` : k;
      })
      .join(' | ');
  }
  return String(value);
}

/** Actors we care about — ignore internal XState bookkeeping actors */
const TRACKED_ACTORS = new Set([
  'pecking-order-l2',  // L2 orchestrator (root actor ID)
  'l3-session',        // L3 daily session / post-game
]);

/** Events that are high-frequency noise — don't log transitions for these */
const SKIP_EVENTS = new Set([
  'xstate.init',
  'xstate.stop',
  'SOCIAL.SEND_MSG',
  'PRESENCE.TYPING',
  'PRESENCE.STOP_TYPING',
]);

/** Broadcast callback type for sending inspection events to admin clients */
export type InspectBroadcast = (message: object) => void;

/**
 * Depth-limited serialization of snapshot context.
 * Prevents bloating WebSocket with deeply nested state (roster, chatLog, etc.).
 */
export function safeSerializeSnapshot(snapshot: any): object {
  if (!snapshot) return {};
  return {
    value: snapshot.value,
    status: snapshot.status,
    changed: snapshot.changed,
    // Context keys only (no deep values) to keep payload small
    contextKeys: snapshot.context ? Object.keys(snapshot.context) : [],
  };
}

/**
 * Creates an XState inspect callback for runtime state transition tracing.
 *
 * Two responsibilities:
 * 1. Axiom logging (existing) — structured logs for each meaningful transition
 * 2. WebSocket broadcast (new) — streams INSPECT.* events to admin clients
 *    for real-time visualization in Stately Inspector
 *
 * The broadcast callback is optional; if no admin clients are subscribed,
 * the callback is a no-op and adds zero overhead.
 */
export function createInspector(gameId: string, broadcast?: InspectBroadcast) {
  // Track: actorId → { eventType, sourceId, previousState }
  const actorState = new Map<string, { previousState: string }>();
  const pendingEvent = new Map<string, { eventType: string; sourceId: string }>();

  return (inspEvent: any) => {
    const type: string = inspEvent.type;

    // --- Broadcast to admin clients (all actor events, not just tracked) ---
    if (broadcast) {
      if (type === '@xstate.actor') {
        const actorId: string = inspEvent.actorRef?.id || inspEvent.actorRef?.sessionId || '?';
        broadcast({
          type: 'INSPECT.ACTOR',
          actorId,
          snapshot: safeSerializeSnapshot(inspEvent.snapshot),
          timestamp: Date.now(),
        });
      }

      if (type === '@xstate.event') {
        const actorId: string = inspEvent.actorRef?.id || inspEvent.actorRef?.sessionId || '?';
        const sourceId: string = inspEvent.sourceRef?.id || inspEvent.sourceRef?.sessionId || 'external';
        const eventType: string = inspEvent.event?.type || '';
        broadcast({
          type: 'INSPECT.EVENT',
          actorId,
          sourceId,
          eventType,
          event: { type: eventType },
          timestamp: Date.now(),
        });
      }

      if (type === '@xstate.snapshot') {
        const actorId: string = inspEvent.actorRef?.id || inspEvent.actorRef?.sessionId || '?';
        broadcast({
          type: 'INSPECT.SNAPSHOT',
          actorId,
          snapshot: safeSerializeSnapshot(inspEvent.snapshot),
          timestamp: Date.now(),
        });
      }
    }

    // --- Axiom logging (existing behavior, unchanged) ---

    if (type === '@xstate.event') {
      const eventType: string = inspEvent.event?.type || '';
      const actorId: string = inspEvent.actorRef?.id || inspEvent.actorRef?.sessionId || '?';
      const sourceId: string = inspEvent.sourceRef?.id || inspEvent.sourceRef?.sessionId || 'external';

      // Only track events on actors we care about
      if (!TRACKED_ACTORS.has(actorId)) return;
      if (SKIP_EVENTS.has(eventType)) return;

      pendingEvent.set(actorId, { eventType, sourceId });
      return;
    }

    if (type === '@xstate.snapshot') {
      const actorId: string = inspEvent.actorRef?.id || inspEvent.actorRef?.sessionId || '?';
      const pending = pendingEvent.get(actorId);
      if (!pending) return;
      pendingEvent.delete(actorId);

      const snapshot = inspEvent.snapshot;
      if (!snapshot) return;

      const toState = flattenValue(snapshot.value);
      const fromState = actorState.get(actorId)?.previousState || '(init)';
      const changed = snapshot.changed !== false;

      // Update tracked state
      actorState.set(actorId, { previousState: toState });

      if (!changed) {
        // Event arrived but state didn't change — potential silent drop
        log('warn', 'XState', 'event.unhandled', {
          gameId, actor: actorId,
          eventType: pending.eventType, source: pending.sourceId,
          state: toState,
        });
        return;
      }

      // Log the transition
      const level = fromState === toState ? 'debug' as const : 'info' as const;
      log(level, 'XState', 'transition', {
        gameId, actor: actorId,
        eventType: pending.eventType, source: pending.sourceId,
        from: fromState, to: toState,
      });
      return;
    }

    // Skip @xstate.actor — actor lifecycle logged by L1 application code
  };
}
