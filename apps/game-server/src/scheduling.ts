import type { Scheduler } from "partywhen";
import { resolveScheduling } from "@pecking-order/shared-types";
import { log } from "./log";

/**
 * PartyWhen task callback — called by the Scheduler when a task fires.
 *
 * This is a NO-OP by design. PartyWhen's constructor processes due tasks
 * inside blockConcurrencyWhile, BEFORE onStart() creates the XState actor.
 * Instead of trying to deliver WAKEUP here, we deliver it from onAlarm()
 * where the actor is guaranteed to exist.
 *
 * This callback exists solely because PartyWhen requires a "self" callback
 * target. The actual event delivery happens in GameServer.onAlarm().
 */
export function wakeUpL2(): void {
  log('info', 'L1', 'Alarm: task executed (WAKEUP deferred to onAlarm)');
}

/**
 * Schedule all manifest timeline events as individual PartyWhen tasks.
 * Called once at init — the manifest is the single source of truth.
 * Each event gets its own task ID so PartyWhen fires them independently.
 * PartyWhen stores all tasks in SQLite and chains the single DO alarm to
 * fire for the earliest task. After processing, it re-arms for the next.
 * ADMIN scheduling skips all alarms (admin-driven via NEXT_STAGE).
 */
export async function scheduleManifestAlarms(scheduler: Scheduler<any>, manifest: any): Promise<void> {
  if (!manifest) return;

  if (resolveScheduling(manifest) === 'ADMIN') {
    log('info', 'L1', 'Admin scheduling — no alarms scheduled (admin-triggered)');
    return;
  }

  if (!manifest.days) return;

  // Deduplicate by timestamp — one PartyWhen task per unique wakeup time.
  // processTimelineEvent handles finding all events due at that time.
  const uniqueTimestamps = new Map<number, string>(); // timestamp(s) → label
  const now = Date.now();
  for (const day of manifest.days) {
    for (const event of day.timeline || []) {
      const timeMs = new Date(event.time).getTime();
      if (timeMs > now) {
        const ts = Math.floor(timeMs / 1000);
        const existing = uniqueTimestamps.get(ts);
        uniqueTimestamps.set(ts, existing ? `${existing}+${event.action}` : `d${day.dayIndex}-${event.action}`);
      }
    }
  }

  if (uniqueTimestamps.size === 0) {
    log('info', 'L1', 'No future timeline events to schedule');
    return;
  }

  const callback = JSON.stringify({ type: "self", function: "wakeUpL2" });
  for (const [timestamp, label] of uniqueTimestamps) {
    (scheduler as any).querySql([{
      sql: `INSERT OR REPLACE INTO tasks (id, description, payload, callback, type, time)
            VALUES (?, ?, ?, ?, 'scheduled', ?)`,
      params: [`wakeup-${label}`, null, null, callback, timestamp]
    }]);
  }
  // Arm the DO alarm for the earliest task
  await (scheduler as any).scheduleNextAlarm();
  log('info', 'L1', 'Scheduled alarms', {
    uniqueAlarms: uniqueTimestamps.size,
    totalEvents: manifest.days.reduce((n: number, d: any) => n + (d.timeline?.length || 0), 0),
    days: manifest.days.length,
  });
}
