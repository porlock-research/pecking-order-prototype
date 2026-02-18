import { assign, enqueueActions } from 'xstate';
import { Events, FactTypes, PlayerStatuses } from '@pecking-order/shared-types';

export const l2EliminationActions = {
  storeVoteResult: assign({
    pendingElimination: ({ event }: any) =>
      event.type === Events.Cartridge.VOTE_RESULT ? event.result : null,
  }),
  processNightSummary: enqueueActions(({ enqueue, context }: any) => {
    const pending = context.pendingElimination;
    console.log(`[L2] processNightSummary: pending=${JSON.stringify(pending)}, goldPool=${context.goldPool}`);
    // Build one unified roster update to avoid XState v5 stale-context pitfall
    const rosterUpdate = { ...context.roster };
    let rosterChanged = false;

    // Elimination (normal vote or FINALS loser)
    if (pending?.eliminatedId && rosterUpdate[pending.eliminatedId]) {
      const id = pending.eliminatedId;
      console.log(`[L2] Eliminating player: ${id}`);
      rosterUpdate[id] = { ...rosterUpdate[id], status: PlayerStatuses.ELIMINATED };
      rosterChanged = true;
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

    // FINALS winner declaration — build gold payouts and apply additively
    const goldPayouts: Array<{ playerId: string; amount: number; reason: string }> = [];
    if (pending?.winnerId) {
      const winnerId = pending.winnerId;
      const goldPool = context.goldPool || 0;
      console.log(`[L2] Winner declared: ${winnerId} (gold pool: ${goldPool})`);
      if (goldPool > 0) {
        goldPayouts.push({ playerId: winnerId, amount: goldPool, reason: 'WINNER' });
      }
      // Apply payouts additively to roster
      for (const payout of goldPayouts) {
        if (rosterUpdate[payout.playerId]) {
          rosterUpdate[payout.playerId] = {
            ...rosterUpdate[payout.playerId],
            gold: (rosterUpdate[payout.playerId].gold || 0) + payout.amount,
          };
          rosterChanged = true;
        }
      }
      enqueue.assign({
        winner: { playerId: winnerId, mechanism: 'FINALS', summary: pending.summary },
        goldPayouts,
        goldPool: 0,
      });
      enqueue.raise({
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.WINNER_DECLARED,
          actorId: 'SYSTEM',
          targetId: winnerId,
          payload: { ...pending.summary, goldPool },
          timestamp: Date.now(),
        },
      } as any);
    }

    if (rosterChanged) {
      enqueue.assign({ roster: rosterUpdate });
    }
    enqueue.assign({ pendingElimination: null });
  }),
};
