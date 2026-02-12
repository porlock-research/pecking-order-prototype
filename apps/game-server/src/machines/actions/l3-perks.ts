import { assign, sendParent } from 'xstate';
import { PERK_COSTS, type PerkType } from '@pecking-order/shared-types';

export const l3PerkActions = {
  deductPerkCost: assign({
    roster: ({ context, event }: any) => {
      if (event.type !== 'SOCIAL.USE_PERK') return context.roster;
      const { senderId, perkType } = event;
      const cost = PERK_COSTS[perkType as PerkType];
      if (!cost) return context.roster;
      const player = context.roster[senderId];
      if (!player) return context.roster;
      return { ...context.roster, [senderId]: { ...player, silver: player.silver - cost } };
    },
  }),
  recordPerkOverride: assign({
    perkOverrides: ({ context, event }: any) => {
      if (event.type !== 'SOCIAL.USE_PERK') return context.perkOverrides;
      const { senderId, perkType } = event;
      const current = context.perkOverrides[senderId] || { extraPartners: 0, extraChars: 0 };
      let updated = { ...current };
      if (perkType === 'EXTRA_DM_PARTNER') {
        updated.extraPartners = current.extraPartners + 1;
      } else if (perkType === 'EXTRA_DM_CHARS') {
        updated.extraChars = current.extraChars + 600;
      }
      // SPY_DMS doesn't modify overrides
      return { ...context.perkOverrides, [senderId]: updated };
    },
  }),
  emitPerkFact: sendParent(({ event }: any) => {
    if (event.type !== 'SOCIAL.USE_PERK') return { type: 'FACT.RECORD', fact: { type: 'PERK_USED', actorId: '', timestamp: 0 } };
    return {
      type: 'FACT.RECORD',
      fact: {
        type: 'PERK_USED',
        actorId: event.senderId,
        targetId: event.targetId,
        payload: { perkType: event.perkType },
        timestamp: Date.now(),
      },
    };
  }),
  rejectPerk: sendParent(({ context, event }: any): any => {
    if (event.type !== 'SOCIAL.USE_PERK') return { type: 'NOOP' };
    const { senderId, perkType } = event;
    const cost = PERK_COSTS[perkType as PerkType];
    let reason = 'UNKNOWN';
    if (!cost) reason = 'INVALID_PERK_TYPE';
    else if ((context.roster[senderId]?.silver ?? 0) < cost) reason = 'INSUFFICIENT_SILVER';
    else if (context.roster[senderId]?.status === 'ELIMINATED') reason = 'PLAYER_ELIMINATED';
    return { type: 'PERK.REJECTED', senderId, reason };
  }),
};

export const l3PerkGuards = {
  canAffordPerk: ({ context, event }: any) => {
    if (event.type !== 'SOCIAL.USE_PERK') return false;
    const { senderId, perkType } = event;
    const cost = PERK_COSTS[perkType as PerkType];
    if (!cost) return false;
    const player = context.roster[senderId];
    if (!player) return false;
    if (player.status === 'ELIMINATED') return false;
    return player.silver >= cost;
  },
};
