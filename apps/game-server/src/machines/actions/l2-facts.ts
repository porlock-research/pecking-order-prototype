import { assign } from 'xstate';

export const l2FactsActions = {
  updateJournalTimestamp: assign(({ event }: any) => {
    if (event.type !== 'FACT.RECORD') return {};
    console.log(`[L2 Journal] Fact received: ${event.fact.type} by ${event.fact.actorId}`);
    return { lastJournalEntry: Date.now() };
  }),
  persistFactToD1: () => {
    // No-op in L2 — overridden by L1 via .provide() to inject D1 binding
  },
  applyFactToRoster: assign({
    roster: ({ context, event }: any) => {
      if (event.type !== 'FACT.RECORD') return context.roster;
      const fact = event.fact;
      switch (fact.type) {
        case 'DM_SENT': {
          const sender = context.roster[fact.actorId];
          if (!sender) return context.roster;
          return { ...context.roster, [fact.actorId]: { ...sender, silver: sender.silver - 1 } };
        }
        case 'SILVER_TRANSFER': {
          const from = context.roster[fact.actorId];
          const to = context.roster[fact.targetId];
          if (!from || !to) return context.roster;
          const amount = fact.payload?.amount || 0;
          return {
            ...context.roster,
            [fact.actorId]: { ...from, silver: from.silver - amount },
            [fact.targetId]: { ...to, silver: to.silver + amount },
          };
        }
        default:
          return context.roster;
      }
    },
  }),
  sendDmRejection: () => {
    // No-op in L2. Overridden by L1 via .provide() to send rejection to specific client.
  },
};
