import { assign, enqueueActions } from 'xstate';

export const l2TimelineActions = {
  scheduleGameStart: assign({
    nextWakeup: ({ context }: any) => {
      if (context.manifest?.gameMode === 'DEBUG_PECKING_ORDER') {
        console.log('[L2] Debug Mode: Skipping Game Start Alarm. Waiting for Admin trigger.');
        return null;
      }
      console.log('[L2] Scheduling Game Start (1s)...');
      return Date.now() + 1000;
    },
  }),
  scheduleNextTimelineEvent: assign({
    nextWakeup: ({ context }: any) => {
      if (!context.manifest) return null;

      if (context.manifest.gameMode === 'DEBUG_PECKING_ORDER') {
        console.log('[L2] Debug Mode: Skipping automatic scheduling.');
        return null;
      }

      const currentDay = context.manifest.days.find((d: any) => d.dayIndex === context.dayIndex);
      if (!currentDay) {
        console.warn(`[L2] Day ${context.dayIndex} not found in manifest.`);
        return null;
      }

      const now = Date.now();
      const effectiveNow = Math.max(now, context.lastProcessedTime);
      const nextEvent = currentDay.timeline.find((e: any) => new Date(e.time).getTime() > effectiveNow + 100);

      if (nextEvent) {
        console.log(`[L2] Scheduling next event: ${nextEvent.action} at ${nextEvent.time}`);
        return new Date(nextEvent.time).getTime();
      } else {
        console.log(`[L2] No more events for Day ${context.dayIndex}.`);
        return null;
      }
    },
  }),
  processTimelineEvent: enqueueActions(({ enqueue, context }: any) => {
    if (!context.manifest) return;
    if (context.manifest.gameMode === 'DEBUG_PECKING_ORDER') return;
    const currentDay = context.manifest.days.find((d: any) => d.dayIndex === context.dayIndex);
    if (!currentDay) return;

    const now = Date.now();
    let newProcessedTime = context.lastProcessedTime;

    const recentEvents = currentDay.timeline.filter((e: any) => {
      const t = new Date(e.time).getTime();
      return t > context.lastProcessedTime && t <= now + 2000 && t > now - 10000;
    });

    if (recentEvents.length === 0) return;

    for (const e of recentEvents) {
      console.log(`[L2] Processing Timeline Event: ${e.action}`);
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
      console.log(`[L2] Admin Injecting Event: ${event.payload.action}`);
    }
  },
};
