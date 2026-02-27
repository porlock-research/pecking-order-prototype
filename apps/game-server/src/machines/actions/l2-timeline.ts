import { assign, enqueueActions } from 'xstate';
import { log } from '../../log';

export const l2TimelineActions = {
  scheduleGameStart: assign({
    nextWakeup: ({ context }: any) => {
      if (context.manifest?.gameMode === 'DEBUG_PECKING_ORDER') {
        log('info', 'L2', 'Debug Mode: Skipping Game Start Alarm. Waiting for Admin trigger.');
        return null;
      }

      // CONFIGURABLE_CYCLE: schedule wakeup for Day 1's first event (Day 0 is pre-game)
      if (context.manifest?.gameMode === 'CONFIGURABLE_CYCLE') {
        const day1 = context.manifest.days.find((d: any) => d.dayIndex === 1);
        if (day1 && day1.timeline.length > 0) {
          const sorted = [...day1.timeline].sort(
            (a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime()
          );
          const wakeup = new Date(sorted[0].time).getTime();
          log('info', 'L2', 'Configurable Cycle: Scheduling game start', { time: sorted[0].time });
          return wakeup;
        }
        log('warn', 'L2', 'Configurable Cycle: No Day 1 events found. Waiting for Admin trigger.');
        return null;
      }

      log('info', 'L2', 'Scheduling Game Start (1s)');
      return Date.now() + 1000;
    },
  }),
  scheduleNextTimelineEvent: assign({
    nextWakeup: ({ context }: any) => {
      if (!context.manifest) return null;

      if (context.manifest.gameMode === 'DEBUG_PECKING_ORDER') {
        log('debug', 'L2', 'Debug Mode: Skipping automatic scheduling.');
        return null;
      }

      const currentDay = context.manifest.days.find((d: any) => d.dayIndex === context.dayIndex);
      if (!currentDay) {
        log('warn', 'L2', 'Day not found in manifest', { dayIndex: context.dayIndex });
        return null;
      }

      const now = Date.now();
      const effectiveNow = Math.max(now, context.lastProcessedTime);
      const sorted = [...currentDay.timeline].sort(
        (a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime()
      );
      const nextEvent = sorted.find((e: any) => new Date(e.time).getTime() > effectiveNow + 100);

      if (nextEvent) {
        log('info', 'L2', 'Scheduling next event', { action: nextEvent.action, time: nextEvent.time });
        return new Date(nextEvent.time).getTime();
      }

      // Current day exhausted — look ahead to next day's first event
      const nextDay = context.manifest.days.find(
        (d: any) => d.dayIndex === context.dayIndex + 1
      );
      if (nextDay && nextDay.timeline.length > 0) {
        const sorted = [...nextDay.timeline].sort(
          (a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime()
        );
        log('info', 'L2', 'Day exhausted, scheduling next day', { currentDay: context.dayIndex, nextDay: nextDay.dayIndex, time: sorted[0].time });
        return new Date(sorted[0].time).getTime();
      }

      log('debug', 'L2', 'No more events', { dayIndex: context.dayIndex });
      return null;
    },
  }),
  processTimelineEvent: enqueueActions(({ enqueue, context }: any) => {
    if (!context.manifest) return;
    if (context.manifest.gameMode === 'DEBUG_PECKING_ORDER') return;
    const currentDay = context.manifest.days.find((d: any) => d.dayIndex === context.dayIndex);
    if (!currentDay) return;

    const now = Date.now();
    let newProcessedTime = context.lastProcessedTime;

    const recentEvents = [...currentDay.timeline]
      .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .filter((e: any) => {
        const t = new Date(e.time).getTime();
        return t > context.lastProcessedTime && t <= now + 2000 && t > now - 10000;
      });

    if (recentEvents.length === 0) return;

    for (const e of recentEvents) {
      log('info', 'L2', 'Processing timeline event', { action: e.action });
      if (e.action === 'END_DAY') {
        enqueue.raise({ type: 'ADMIN.NEXT_STAGE' } as any);
      } else {
        enqueue.raise({ type: 'ADMIN.INJECT_TIMELINE_EVENT', payload: { action: e.action, payload: e.payload } } as any);
      }
      newProcessedTime = Math.max(newProcessedTime, new Date(e.time).getTime());
    }

    enqueue.assign({ lastProcessedTime: newProcessedTime });
  }),
  logAdminInject: ({ event }: any) => {
    if (event.type === 'ADMIN.INJECT_TIMELINE_EVENT') {
      log('info', 'L2', 'Admin injecting event', { action: event.payload.action });
    }
  },
};
