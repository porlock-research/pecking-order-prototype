import { log } from './log';

/** Events that should always be logged at info level. */
const INFO_EVENTS_PREFIX = ['ADMIN.', 'INTERNAL.INJECT_PROMPT'];

function isInfoEvent(eventType: string): boolean {
  return INFO_EVENTS_PREFIX.some((p) => eventType.startsWith(p));
}

/**
 * Creates an XState inspect callback for runtime event tracing.
 * Attach to `createActor(machine, { inspect })`.
 *
 * ONLY logs things that aren't visible through normal application logs:
 * - warn: events that arrived at an actor but were silently ignored (the bug detector)
 * - info: admin/GM events that flow through the actor hierarchy (confirms delivery)
 *
 * Everything else (actor lifecycle, forwarding, state changes) is already
 * covered by application-level log() calls in server.ts and action files.
 */
export function createInspector(gameId: string) {
  const lastEventByActor = new Map<string, { type: string; ts: number }>();

  return (inspEvent: any) => {
    const type: string = inspEvent.type;

    if (type === '@xstate.event') {
      const eventType: string = inspEvent.event?.type || '';
      const actorId: string = inspEvent.actorRef?.id || inspEvent.actorRef?.sessionId || '?';
      const sourceId: string = inspEvent.sourceRef?.id || inspEvent.sourceRef?.sessionId || 'external';

      // Only track admin events — these are the ones we need to verify delivery for
      if (isInfoEvent(eventType)) {
        log('info', 'Inspector', 'event.admin', { gameId, eventType, actorId, sourceId });
        lastEventByActor.set(actorId, { type: eventType, ts: Date.now() });
      }
      return;
    }

    if (type === '@xstate.snapshot') {
      const actorId: string = inspEvent.actorRef?.id || inspEvent.actorRef?.sessionId || '?';
      const last = lastEventByActor.get(actorId);
      if (!last) return;

      // THE KEY VALUE: detect silently dropped events.
      // If an admin event arrived but the state didn't change, it was ignored.
      const snapshot = inspEvent.snapshot;
      if (snapshot && snapshot.changed === false) {
        log('warn', 'Inspector', 'event.unhandled', {
          gameId,
          eventType: last.type,
          actorId,
          stateValue: JSON.stringify(snapshot.value),
        });
      }

      // Clear after checking — one check per event
      lastEventByActor.delete(actorId);
      return;
    }

    // Skip @xstate.actor — actor lifecycle is already logged by L1
  };
}
