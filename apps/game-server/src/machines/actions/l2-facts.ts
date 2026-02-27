import { assign } from 'xstate';
import { Events } from '@pecking-order/shared-types';
import { log } from '../../log';

export const l2FactsActions = {
  updateJournalTimestamp: assign(({ event }: any) => {
    if (event.type !== Events.Fact.RECORD) return {};
    log('debug', 'L2', 'Fact received', { factType: event.fact.type, actorId: event.fact.actorId });
    return { lastJournalEntry: Date.now() };
  }),
  persistFactToD1: () => {
    // No-op in L2 — overridden by L1 via .provide() to inject D1 binding
  },
  sendDmRejection: () => {
    // No-op in L2. Overridden by L1 via .provide() to send rejection to specific client.
  },
  sendSilverTransferRejection: () => {
    // No-op in L2. Overridden by L1 via .provide() to send rejection to specific client.
  },
  deliverPerkResult: () => {
    // No-op in L2. Overridden by L1 via .provide() to send perk result to specific client.
  },
};
