import { assign } from 'xstate';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { Events, PlayerStatuses, normalizeManifest } from '@pecking-order/shared-types';

export const l2InitializationActions = {
  initializeContext: assign({
    gameId: ({ event }: any) => (event.type === Events.System.INIT ? event.gameId : ''),
    inviteCode: ({ event }: any) => (event.type === Events.System.INIT ? (event.inviteCode || '') : ''),
    roster: ({ event }: any) => {
      if (event.type !== Events.System.INIT) return {};
      const internalRoster: Record<string, any> = {};
      for (const [id, p] of Object.entries(event.payload.roster) as any) {
        internalRoster[id] = {
          id,
          personaName: p.personaName,
          avatarUrl: p.avatarUrl,
          bio: p.bio || '',
          status: p.isAlive ? PlayerStatuses.ALIVE : PlayerStatuses.ELIMINATED,
          silver: p.silver,
          gold: p.gold || 0,
          realUserId: p.realUserId || '',
        };
      }
      return internalRoster;
    },
    manifest: ({ event }: any) => (event.type === Events.System.INIT ? normalizeManifest(event.payload.manifest) : null),
    dayIndex: 0,
    lastProcessedTime: 0,
    lastJournalEntry: 0,
    goldPool: 0,
  }),
  incrementDay: assign({
    dayIndex: ({ context }: any) => context.dayIndex + 1,
  }),
  clearRestoredChatLog: assign({
    restoredChatLog: undefined,
  }),
};
