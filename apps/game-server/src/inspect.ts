import { log } from './log';

/** High-frequency events logged at debug level to avoid noise. */
const DEBUG_EVENTS = new Set([
  'xstate.init',
  'xstate.stop',
  'SOCIAL.SEND_MSG',
  'PRESENCE.TYPING',
  'PRESENCE.STOP_TYPING',
]);

/** Events that should always be logged at info level. */
const INFO_EVENTS_PREFIX = ['ADMIN.', 'INTERNAL.INJECT_PROMPT'];

function isInfoEvent(eventType: string): boolean {
  return INFO_EVENTS_PREFIX.some((p) => eventType.startsWith(p));
}

/**
 * Creates an XState inspect callback for runtime event tracing.
 * Attach to `createActor(machine, { inspect })`.
 *
 * Traces:
 * - Admin/GM events at info level (always visible)
 * - L2→L3 forwarding at debug level
 * - Actor lifecycle (spawn/done) at info level
 * - Potential event drops at warn level
 */
export function createInspector(gameId: string) {
  // Track last event per actor to detect potential drops
  const lastEventByActor = new Map<string, { type: string; ts: number }>();

  return (inspEvent: any) => {
    const type: string = inspEvent.type;

    if (type === '@xstate.event') {
      const eventType: string = inspEvent.event?.type || '';
      const actorId: string = inspEvent.actorRef?.id || inspEvent.actorRef?.sessionId || '?';
      const sourceId: string = inspEvent.sourceRef?.id || inspEvent.sourceRef?.sessionId || 'external';

      if (DEBUG_EVENTS.has(eventType)) {
        log('debug', 'Inspector', 'event', { gameId, eventType, actorId, sourceId });
        return;
      }

      if (isInfoEvent(eventType)) {
        log('info', 'Inspector', 'event.admin', { gameId, eventType, actorId, sourceId });
      } else if (sourceId !== 'external' && actorId === 'l3-session') {
        log('debug', 'Inspector', 'event.forward', { gameId, eventType, from: sourceId, to: actorId });
      }

      // Actor lifecycle: done events
      if (eventType.startsWith('xstate.done.actor.')) {
        log('info', 'Inspector', 'actor.done', { gameId, eventType, actorId });
      }

      lastEventByActor.set(actorId, { type: eventType, ts: Date.now() });
      return;
    }

    if (type === '@xstate.snapshot') {
      const actorId: string = inspEvent.actorRef?.id || inspEvent.actorRef?.sessionId || '?';
      const last = lastEventByActor.get(actorId);
      if (!last) return;

      // Detect potential drops: event arrived but state value unchanged
      // Only warn for events we expect to cause transitions (admin, internal)
      const snapshot = inspEvent.snapshot;
      if (last.type && isInfoEvent(last.type) && snapshot) {
        const changed = snapshot.changed;
        if (changed === false) {
          log('warn', 'Inspector', 'event.unhandled', {
            gameId,
            eventType: last.type,
            actorId,
            stateValue: JSON.stringify(snapshot.value),
          });
        }
      }
      return;
    }

    if (type === '@xstate.actor') {
      const actorId: string = inspEvent.actorRef?.id || inspEvent.actorRef?.sessionId || '?';
      log('info', 'Inspector', 'actor.create', { gameId, actorId });
    }
  };
}
