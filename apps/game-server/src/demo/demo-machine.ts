/**
 * Demo Game Machine — lightweight XState machine for UI testing.
 *
 * No voting, no games, no day progression, no alarms.
 * Just chat (main + DMs + group DMs) with pre-populated personas.
 */
import { setup, assign } from 'xstate';
import { buildDemoSeed } from './demo-seed';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DemoContext {
  gameId: string;
  dayIndex: number;
  roster: Record<string, any>;
  manifest: any;
  chatLog: any[];
  channels: Record<string, any>;
  completedPhases: any[];
  gameHistory: any[];
  goldPool: number;
  winner: null;
}

type DemoEvent =
  | { type: 'SOCIAL.SEND_MSG'; senderId: string; content: string; channelId?: string; targetId?: string }
  | { type: 'SOCIAL.CREATE_CHANNEL'; senderId: string; memberIds: string[] }
  | { type: 'SOCIAL.SEND_SILVER'; senderId: string; amount: number; targetId: string };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function dmChannelId(a: string, b: string): string {
  const sorted = [a, b].sort();
  return `dm:${sorted[0]}:${sorted[1]}`;
}

function makeMessage(senderId: string, content: string, channelId: string): any {
  return {
    id: crypto.randomUUID(),
    senderId,
    content: content.slice(0, 2000), // cap length
    channelId,
    timestamp: Date.now(),
  };
}

/* ------------------------------------------------------------------ */
/*  Machine                                                            */
/* ------------------------------------------------------------------ */

export const demoMachine = setup({
  types: {
    context: {} as DemoContext,
    events: {} as DemoEvent,
    input: {} as { gameId: string },
  },
  actions: {
    handleSendMsg: assign(({ context, event }) => {
      if (event.type !== 'SOCIAL.SEND_MSG') return {};
      const channelId = event.channelId || 'MAIN';
      const channels = { ...context.channels };

      // Auto-create DM channel if targeting a player directly
      if (channelId.startsWith('dm:') && !channels[channelId] && event.targetId) {
        channels[channelId] = {
          id: channelId,
          type: 'DM',
          memberIds: [event.senderId, event.targetId].sort(),
          createdBy: event.senderId,
          createdAt: Date.now(),
          capabilities: ['CHAT', 'SILVER_TRANSFER'],
          constraints: { silverCost: 0 }, // free in demo
        };
      }

      const channel = channels[channelId];
      if (!channel) return {};
      // For non-MAIN channels, verify sender is a member
      if (channelId !== 'MAIN' && !channel.memberIds.includes(event.senderId)) return {};

      return {
        channels,
        chatLog: [...context.chatLog, makeMessage(event.senderId, event.content, channelId)],
      };
    }),

    handleCreateChannel: assign(({ context, event }) => {
      if (event.type !== 'SOCIAL.CREATE_CHANNEL') return {};
      const memberIds = [...new Set([event.senderId, ...event.memberIds])].sort();
      if (memberIds.length < 3) return {}; // need at least 3 for a group
      const chId = `gdm:${memberIds.join(':')}`;

      if (context.channels[chId]) return {}; // already exists

      return {
        channels: {
          ...context.channels,
          [chId]: {
            id: chId,
            type: 'GROUP_DM',
            memberIds,
            createdBy: event.senderId,
            createdAt: Date.now(),
            capabilities: ['CHAT'],
            constraints: { silverCost: 0 },
          },
        },
      };
    }),

    handleSendSilver: assign(({ context, event }) => {
      if (event.type !== 'SOCIAL.SEND_SILVER') return {};
      const { senderId, targetId, amount } = event;
      if (amount < 1 || !context.roster[senderId] || !context.roster[targetId]) return {};
      const senderSilver = context.roster[senderId].silver ?? 0;
      if (senderSilver < amount) return {};

      const roster = { ...context.roster };
      roster[senderId] = { ...roster[senderId], silver: senderSilver - amount };
      roster[targetId] = { ...roster[targetId], silver: (roster[targetId].silver ?? 0) + amount };
      return { roster };
    }),
  },
}).createMachine({
  id: 'demo',
  initial: 'active',
  context: ({ input }) => ({
    ...buildDemoSeed(input.gameId),
  }),
  states: {
    active: {
      on: {
        'SOCIAL.SEND_MSG': { actions: 'handleSendMsg' },
        'SOCIAL.CREATE_CHANNEL': { actions: 'handleCreateChannel' },
        'SOCIAL.SEND_SILVER': { actions: 'handleSendSilver' },
      },
    },
  },
});

export type DemoMachineActor = ReturnType<typeof import('xstate').createActor<typeof demoMachine>>;
