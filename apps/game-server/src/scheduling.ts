import type { Scheduler } from "partywhen";
import { Events } from "@pecking-order/shared-types";
import { log } from "./log";

/**
 * Fire a wakeup event to the L2 actor. If the actor isn't ready yet
 * (during Scheduler init race — ADR-012), buffer it for replay.
 */
export function wakeUpL2(
  scheduler: Scheduler<any>,
  actor: { send: (event: any) => void } | undefined,
  onBuffered: () => void,
): void {
  let remaining = '?';
  try {
    const rows = (scheduler as any).querySql([
      { sql: "SELECT COUNT(*) as count FROM tasks", params: [] }
    ]);
    remaining = rows?.result?.[0]?.count ?? '?';
  } catch { /* non-critical */ }
  log('info', 'L1', 'Alarm: wakeUpL2 fired', { remaining });
  if (actor) {
    actor.send({ type: Events.System.WAKEUP });
  } else {
    log('info', 'L1', 'Actor not ready — buffering wakeup for replay after onStart');
    onBuffered();
  }
}

/**
 * Schedule all manifest timeline events as individual PartyWhen tasks.
 * Called once at init — the manifest is the single source of truth.
 * Each event gets its own task ID so PartyWhen fires them independently.
 * PartyWhen stores all tasks in SQLite and chains the single DO alarm to
 * fire for the earliest task. After processing, it re-arms for the next.
 * For non-CONFIGURABLE_CYCLE modes, schedules a single immediate start.
 */
export async function scheduleManifestAlarms(scheduler: Scheduler<any>, manifest: any): Promise<void> {
  if (!manifest) return;

  if (manifest.gameMode === 'DEBUG_PECKING_ORDER') {
    log('info', 'L1', 'Debug mode — no alarms scheduled (admin-triggered)');
    return;
  }

  if (manifest.gameMode === 'CONFIGURABLE_CYCLE' && manifest.days) {
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
    return;
  }

  // Standard PECKING_ORDER: immediate start (1s)
  await scheduler.scheduleTask({
    id: "wakeup-gamestart",
    type: "scheduled",
    time: new Date(Date.now() + 1000),
    callback: { type: "self", function: "wakeUpL2" }
  });
  log('info', 'L1', 'Scheduled immediate game start (1s)');
}
