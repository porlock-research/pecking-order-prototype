import { log } from './log';

/**
 * Flatten XState v5 state value to a readable dot-path.
 * e.g. { dayLoop: { activeSession: { running: {} } } } → "dayLoop.activeSession.running"
 */
function flattenValue(value: unknown): string {
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

/**
 * Creates an XState inspect callback for runtime state transition tracing.
 *
 * Logs ONE entry per meaningful state transition:
 * {
 *   actor: "l3-session",
 *   eventType: "INTERNAL.INJECT_PROMPT",
 *   from: "running.mainStage.voting | running.social.active",
 *   to: "running.mainStage.voting | running.social.active",
 *   changed: true
 * }
 *
 * This lets you trace the full event→state flow in Axiom by filtering
 * on component == "XState" and sorting by time.
 *
 * Also emits warn-level entries when events are silently dropped.
 */
export function createInspector(gameId: string) {
  // Track: actorId → { eventType, sourceId, previousState }
  const actorState = new Map<string, { previousState: string }>();
  const pendingEvent = new Map<string, { eventType: string; sourceId: string }>();

  return (inspEvent: any) => {
    const type: string = inspEvent.type;

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
