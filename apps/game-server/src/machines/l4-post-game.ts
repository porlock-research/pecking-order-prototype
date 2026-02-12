import { setup, assign, sendParent } from 'xstate';
import type { ChatMessage, SocialPlayer, Fact } from '@pecking-order/shared-types';
import { buildChatMessage, appendToChatLog } from './actions/social-helpers';

interface PostGameContext {
  chatLog: ChatMessage[];
  roster: Record<string, SocialPlayer>;
  winner: { playerId: string; mechanism: string; summary: Record<string, any> } | null;
}

type PostGameEvent =
  | { type: 'SOCIAL.SEND_MSG'; senderId: string; content: string; targetId?: string }
  | { type: 'FACT.RECORD'; fact: Fact };

export const postGameMachine = setup({
  types: {
    input: {} as { roster: Record<string, SocialPlayer>; winner: any },
    context: {} as PostGameContext,
    events: {} as PostGameEvent,
  },
  actions: {
    processMessage: assign({
      chatLog: ({ context, event }: any) => {
        if (event.type !== 'SOCIAL.SEND_MSG') return context.chatLog;
        const sender = context.roster[event.senderId];
        if (!sender) return context.chatLog;
        // Post-game: group chat only, no DMs, no silver cost
        const msg = buildChatMessage(event.senderId, event.content, 'MAIN');
        return appendToChatLog(context.chatLog, msg);
      },
    }),
    emitChatFact: sendParent(({ event }: any) => {
      if (event.type !== 'SOCIAL.SEND_MSG')
        return { type: 'FACT.RECORD', fact: { type: 'CHAT_MSG', actorId: '', timestamp: 0 } };
      return {
        type: 'FACT.RECORD',
        fact: {
          type: 'CHAT_MSG',
          actorId: event.senderId,
          payload: { content: event.content },
          timestamp: Date.now(),
        },
      };
    }),
  },
}).createMachine({
  id: 'post-game',
  initial: 'active',
  context: ({ input }) => ({
    chatLog: [],
    roster: input.roster || {},
    winner: input.winner || null,
  }),
  states: {
    active: {
      on: {
        'SOCIAL.SEND_MSG': { actions: ['processMessage', 'emitChatFact'] },
      },
    },
  },
});
