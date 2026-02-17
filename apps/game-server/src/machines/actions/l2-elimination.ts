import { assign, enqueueActions } from 'xstate';
import { Events, FactTypes, PlayerStatuses } from '@pecking-order/shared-types';

export const l2EliminationActions = {
  storeVoteResult: assign({
    pendingElimination: ({ event }: any) =>
      event.type === Events.Cartridge.VOTE_RESULT ? event.result : null,
  }),
  processNightSummary: enqueueActions(({ enqueue, context }: any) => {
    const pending = context.pendingElimination;
    // Elimination (normal vote or FINALS loser)
    if (pending?.eliminatedId) {
      const id = pending.eliminatedId;
      console.log(`[L2] Eliminating player: ${id}`);
      enqueue.assign({
        roster: {
          ...context.roster,
          [id]: { ...context.roster[id], status: PlayerStatuses.ELIMINATED },
        },
      });
      enqueue.raise({
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.ELIMINATION,
          actorId: 'SYSTEM',
          targetId: id,
          payload: { mechanism: pending.mechanism, summary: pending.summary },
          timestamp: Date.now(),
        },
      } as any);
    }
    // FINALS winner declaration (in addition to elimination above)
    if (pending?.winnerId) {
      const winnerId = pending.winnerId;
      console.log(`[L2] Winner declared: ${winnerId}`);
      enqueue.assign({
        winner: { playerId: winnerId, mechanism: 'FINALS', summary: pending.summary },
      });
      enqueue.raise({
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.WINNER_DECLARED,
          actorId: 'SYSTEM',
          targetId: winnerId,
          payload: pending.summary,
          timestamp: Date.now(),
        },
      } as any);
    }
    enqueue.assign({ pendingElimination: null });
  }),
};
