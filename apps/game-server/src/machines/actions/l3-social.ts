import { assign, sendParent } from 'xstate';
import type { DmRejectionReason } from '@pecking-order/shared-types';
import { DM_MAX_PARTNERS_PER_DAY, DM_MAX_CHARS_PER_DAY } from '@pecking-order/shared-types';
import { buildChatMessage, appendToChatLog, deductSilver, transferSilverBetween } from './social-helpers';

export const l3SocialActions = {
  // Pure context update — adds message to chatLog, deducts silver for DMs
  processMessage: assign({
    chatLog: ({ context, event }: any) => {
      if (event.type !== 'SOCIAL.SEND_MSG') return context.chatLog;
      const sender = context.roster[event.senderId];
      if (!sender) return context.chatLog;
      const isDM = !!event.targetId;
      const msg = buildChatMessage(event.senderId, event.content, isDM ? 'DM' : 'MAIN', event.targetId);
      return appendToChatLog(context.chatLog, msg);
    },
    roster: ({ context, event }: any) => {
      if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return context.roster;
      const sender = context.roster[event.senderId];
      if (!sender || sender.silver < 1) return context.roster;
      return deductSilver(context.roster, event.senderId, 1);
    },
  }),
  // Side-effect: emit FACT.RECORD to L2 for journaling + sync trigger
  emitChatFact: sendParent(({ event }: any) => {
    if (event.type !== 'SOCIAL.SEND_MSG') return { type: 'FACT.RECORD', fact: { type: 'CHAT_MSG', actorId: '', timestamp: 0 } };
    const isDM = !!event.targetId;
    return {
      type: 'FACT.RECORD',
      fact: {
        type: isDM ? 'DM_SENT' : 'CHAT_MSG',
        actorId: event.senderId,
        targetId: event.targetId,
        payload: { content: event.content },
        timestamp: Date.now(),
      },
    };
  }),
  // DM approved: add message to chatLog + deduct silver + update tracking
  processDm: assign({
    chatLog: ({ context, event }: any) => {
      if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return context.chatLog;
      const msg = buildChatMessage(event.senderId, event.content, 'DM', event.targetId);
      return appendToChatLog(context.chatLog, msg);
    },
    roster: ({ context, event }: any) => {
      if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return context.roster;
      return deductSilver(context.roster, event.senderId, 1);
    },
    dmPartnersByPlayer: ({ context, event }: any) => {
      if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return context.dmPartnersByPlayer;
      const partners = context.dmPartnersByPlayer[event.senderId] || [];
      if (partners.includes(event.targetId)) return context.dmPartnersByPlayer;
      return { ...context.dmPartnersByPlayer, [event.senderId]: [...partners, event.targetId] };
    },
    dmCharsByPlayer: ({ context, event }: any) => {
      if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return context.dmCharsByPlayer;
      const used = context.dmCharsByPlayer[event.senderId] || 0;
      return { ...context.dmCharsByPlayer, [event.senderId]: used + event.content.length };
    },
  }),
  // DM rejected: determine reason and notify parent (L2 → L1 → client)
  rejectDm: sendParent(({ context, event }: any): any => {
    if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return { type: 'NOOP' };
    const senderId = event.senderId;
    const targetId = event.targetId;
    const content = event.content;

    const overrides = context.perkOverrides?.[senderId] || { extraPartners: 0, extraChars: 0 };
    const partnerLimit = DM_MAX_PARTNERS_PER_DAY + overrides.extraPartners;
    const charLimit = DM_MAX_CHARS_PER_DAY + overrides.extraChars;

    let reason: DmRejectionReason = 'DMS_CLOSED';
    if (!context.dmsOpen) {
      reason = 'DMS_CLOSED';
    } else if (senderId === targetId) {
      reason = 'SELF_DM';
    } else if (context.roster[targetId]?.status === 'ELIMINATED') {
      reason = 'TARGET_ELIMINATED';
    } else if ((context.roster[senderId]?.silver ?? 0) < 1) {
      reason = 'INSUFFICIENT_SILVER';
    } else {
      const partners = context.dmPartnersByPlayer[senderId] || [];
      if (!partners.includes(targetId) && partners.length >= partnerLimit) {
        reason = 'PARTNER_LIMIT';
      } else {
        const charsUsed = context.dmCharsByPlayer[senderId] || 0;
        if (charsUsed + content.length > charLimit) {
          reason = 'CHAR_LIMIT';
        }
      }
    }

    return { type: 'DM.REJECTED', reason, senderId };
  }),
  // Pure context update — transfers silver between players
  transferSilver: assign({
    roster: ({ context, event }: any) => {
      if (event.type !== 'SOCIAL.SEND_SILVER') return context.roster;
      return transferSilverBetween(context.roster, event.senderId, event.targetId, event.amount);
    },
  }),
  // Side-effect: emit FACT.RECORD for silver transfer
  emitSilverFact: sendParent(({ event }: any) => {
    if (event.type !== 'SOCIAL.SEND_SILVER') return { type: 'FACT.RECORD', fact: { type: 'SILVER_TRANSFER', actorId: '', timestamp: 0 } };
    return {
      type: 'FACT.RECORD',
      fact: {
        type: 'SILVER_TRANSFER',
        actorId: event.senderId,
        targetId: event.targetId,
        payload: { amount: event.amount },
        timestamp: Date.now(),
      },
    };
  }),
  forwardToL2: sendParent(({ event }: any) => event),
  // Silver transfer rejected: notify parent (L2 → L1 → client)
  rejectSilverTransfer: sendParent(({ context, event }: any): any => {
    if (event.type !== 'SOCIAL.SEND_SILVER') return { type: 'NOOP' };
    const { senderId, targetId, amount } = event;
    let reason = 'UNKNOWN';
    if (senderId === targetId) reason = 'SELF_SEND';
    else if (!amount || amount <= 0) reason = 'INVALID_AMOUNT';
    else if ((context.roster[senderId]?.silver ?? 0) < amount) reason = 'INSUFFICIENT_SILVER';
    else if (context.roster[targetId]?.status === 'ELIMINATED') reason = 'TARGET_ELIMINATED';
    else if (!context.roster[targetId]) reason = 'TARGET_NOT_FOUND';
    return { type: 'SILVER_TRANSFER.REJECTED', senderId, reason };
  }),
};

export const l3SocialGuards = {
  isSilverTransferAllowed: ({ context, event }: any) => {
    if (event.type !== 'SOCIAL.SEND_SILVER') return false;
    const { senderId, targetId, amount } = event;
    if (senderId === targetId) return false;
    if (!amount || amount <= 0) return false;
    if ((context.roster[senderId]?.silver ?? 0) < amount) return false;
    if (!context.roster[targetId]) return false;
    if (context.roster[targetId]?.status === 'ELIMINATED') return false;
    return true;
  },
  isDmAllowed: ({ context, event }: any) => {
    if (event.type !== 'SOCIAL.SEND_MSG' || !event.targetId) return false;
    const { senderId, targetId, content } = event;
    if (!context.dmsOpen) return false;
    if (senderId === targetId) return false;
    if (context.roster[targetId]?.status === 'ELIMINATED') return false;
    if ((context.roster[senderId]?.silver ?? 0) < 1) return false;
    const overrides = context.perkOverrides?.[senderId] || { extraPartners: 0, extraChars: 0 };
    const partnerLimit = DM_MAX_PARTNERS_PER_DAY + overrides.extraPartners;
    const charLimit = DM_MAX_CHARS_PER_DAY + overrides.extraChars;
    const partners = context.dmPartnersByPlayer[senderId] || [];
    if (!partners.includes(targetId) && partners.length >= partnerLimit) return false;
    const charsUsed = context.dmCharsByPlayer[senderId] || 0;
    if (charsUsed + content.length > charLimit) return false;
    return true;
  },
};
