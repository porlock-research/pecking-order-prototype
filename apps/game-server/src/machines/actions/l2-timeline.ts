import { enqueueActions } from 'xstate';
import { resolveScheduling } from '@pecking-order/shared-types';
import { log } from '../../log';

export const l2TimelineActions = {
  processTimelineEvent: enqueueActions(({ enqueue, context }: any) => {
    if (!context.manifest) return;
    if (resolveScheduling(context.manifest) === 'ADMIN') return;
    const currentDay = context.manifest.days.find((d: any) => d.dayIndex === context.dayIndex);
    if (!currentDay) return;

    const now = Date.now();
    let newProcessedTime = context.lastProcessedTime;

    const recentEvents = [...currentDay.timeline]
      .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .filter((e: any) => {
        const t = new Date(e.time).getTime();
        return t > context.lastProcessedTime && t <= now + 2000 && t > now - 300_000;
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
