import { assign } from 'xstate';
import { Events, FactTypes, PlayerStatuses, Config } from '@pecking-order/shared-types';
import type { Channel, ChannelCapability } from '@pecking-order/shared-types';
import { assignPhaseHandles } from '../observations/confession-handles';
import { log } from '../../log';

export const confessionChannelId = (dayIndex: number) => `CONFESSION-d${dayIndex}`;

/**
 * Pure computation: patch for confessionLayer entry.
 * Exported for direct unit testing; wrapped with xstate `assign()` in the action bag.
 */
export function computeOpenConfessionAssignment(context: any) {
  const aliveIds = Object.entries(context.roster || {})
    .filter(([, p]: [string, any]) => p?.status === PlayerStatuses.ALIVE)
    .map(([id]) => id);

  const seed = `${context.gameId ?? ''}:${context.dayIndex}:confession`;
  const handlesByPlayer = assignPhaseHandles(aliveIds, seed);

  const channelId = confessionChannelId(context.dayIndex);
  const newChannel: Channel = {
    id: channelId,
    type: 'CONFESSION',
    memberIds: aliveIds,
    createdBy: 'SYSTEM',
    createdAt: Date.now(),
    capabilities: ['CONFESS'] as ChannelCapability[],
  };

  return {
    channels: { ...(context.channels || {}), [channelId]: newChannel },
    confessionPhase: {
      active: true,
      handlesByPlayer,
      posts: [] as Array<{ handle: string; text: string; ts: number }>,
    },
    groupChatOpen: false,
  };
}

/**
 * Pure computation: patch for confessionLayer exit.
 * Destroys the phase channel, restores groupChatOpen, clears confessionPhase in-memory.
 * (D1 journal is the persistent record.)
 */
export function computeCloseConfessionAssignment(context: any) {
  const channelId = confessionChannelId(context.dayIndex);
  const channels = { ...(context.channels || {}) };
  delete channels[channelId];
  return {
    channels,
    confessionPhase: {
      active: false,
      handlesByPlayer: {} as Record<string, string>,
      posts: [] as Array<{ handle: string; text: string; ts: number }>,
    },
    groupChatOpen: true,
  };
}

/**
 * Guard: every validation rule a CONFESSION.POST must clear before recordConfession runs.
 * Spec C R3 P1: alive-sender check lives HERE (no global alive-sender gate in L3 today).
 */
export function isConfessionPostAllowed(context: any, event: any): boolean {
  if (!context?.confessionPhase?.active) return false;
  const channel = context.channels?.[event.channelId];
  if (!channel) return false;
  if (channel.type !== 'CONFESSION') return false;
  if (!channel.capabilities?.includes('CONFESS')) return false;
  if (!channel.memberIds?.includes(event.senderId)) return false;
  const sender = context.roster?.[event.senderId];
  if (!sender || sender.status !== PlayerStatuses.ALIVE) return false;
  const text = typeof event.text === 'string' ? event.text : '';
  const max = Config.confession?.maxConfessionLength ?? 280;
  if (text.length === 0 || text.length > max) return false;
  return true;
}

export const l3ConfessionActions = {
  /**
   * Phase-open entry action. Assigns handles, creates the CONFESSION channel,
   * pauses MAIN via groupChatOpen=false, flips confessionPhase.active=true.
   */
  openConfessionChannel: assign(({ context }: any) => computeOpenConfessionAssignment(context)),

  /**
   * Phase-close exit action. Destroys the channel, restores groupChatOpen,
   * clears confessionPhase in-memory (D1 archive is the persistent record).
   */
  closeConfessionChannel: assign(({ context }: any) => computeCloseConfessionAssignment(context)),

  /**
   * POST handler. Guard isConfessionPostAllowed runs before this on the transition.
   * Records the post under the sender's handle and raises CONFESSION_POSTED.
   */
  recordConfession: assign(({ context, event, enqueue }: any) => {
    const handle = context.confessionPhase?.handlesByPlayer?.[event.senderId];
    if (!handle) {
      log('warn', 'L3', 'recordConfession: sender has no handle', { senderId: event.senderId });
      return {};
    }
    const ts = Date.now();
    const text = String(event.text);
    const post = { handle, text, ts };

    enqueue.raise({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.CONFESSION_POSTED,
        actorId: event.senderId,
        payload: {
          channelId: event.channelId,
          handle,
          text,
          dayIndex: context.dayIndex,
        },
        timestamp: ts,
      },
    });

    log('info', 'confession', 'post-recorded', {
      dayIndex: context.dayIndex,
      handle,
      actorId: event.senderId,
      textLength: text.length,
    });

    return {
      confessionPhase: {
        ...context.confessionPhase,
        posts: [...(context.confessionPhase?.posts ?? []), post],
      },
    };
  }),

  emitConfessionPhaseStartedFact: ({ context, enqueue }: any) => {
    const channelId = confessionChannelId(context.dayIndex);
    enqueue.raise({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.CONFESSION_PHASE_STARTED,
        actorId: 'SYSTEM',
        payload: { dayIndex: context.dayIndex, channelId },
        timestamp: Date.now(),
      },
    });
    log('info', 'confession', 'phase-started', {
      dayIndex: context.dayIndex,
      channelId,
      playerCount: Object.keys(context.confessionPhase?.handlesByPlayer || {}).length,
    });
  },

  emitConfessionPhaseEndedFact: ({ context, enqueue }: any) => {
    const channelId = confessionChannelId(context.dayIndex);
    const postCount = context.confessionPhase?.posts?.length ?? 0;
    enqueue.raise({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.CONFESSION_PHASE_ENDED,
        actorId: 'SYSTEM',
        payload: { dayIndex: context.dayIndex, channelId, postCount },
        timestamp: Date.now(),
      },
    });
    log('info', 'confession', 'phase-ended', {
      dayIndex: context.dayIndex,
      postCount,
    });
  },
};

export const l3ConfessionGuards = {
  isConfessionPostAllowed: ({ context, event }: any) => isConfessionPostAllowed(context, event),
};
