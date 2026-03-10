import { assign, sendParent } from 'xstate';
import type { DmRejectionReason, Channel, PendingInvite } from '@pecking-order/shared-types';
import { DM_MAX_CHARS_PER_DAY, DM_MAX_GROUPS_PER_DAY, Config, dmChannelId, groupDmChannelId, Events, FactTypes, PlayerStatuses } from '@pecking-order/shared-types';
import { buildChatMessage, appendToChatLog, deductSilver, transferSilverBetween, resolveChannelId } from './social-helpers';

export const l3SocialActions = {
  // Unified message handler — replaces processMessage + processDm
  processChannelMessage: assign(({ context, event }: any) => {
    if (event.type !== Events.Social.SEND_MSG) return {};
    const senderId = event.senderId;
    const channelId = resolveChannelId(event);
    const channels = context.channels;

    const msg = buildChatMessage(senderId, event.content, channelId);
    const chatLog = appendToChatLog(context.chatLog, msg);

    // Determine silver cost from channel constraints
    const ch = channels[channelId];
    const isExempt = ch?.constraints?.exempt;
    const isMainOrExempt = channelId === 'MAIN' || isExempt;
    const silverCost = isMainOrExempt ? 0 : (ch?.constraints?.silverCost ?? Config.dm.silverCost);
    const roster = silverCost > 0
      ? deductSilver(context.roster, senderId, silverCost)
      : context.roster;

    // Update DM tracking (skip for MAIN and exempt channels)
    let dmPartnersByPlayer = context.dmPartnersByPlayer;
    let dmCharsByPlayer = context.dmCharsByPlayer;
    const isDmOrGroupDm = channelId.startsWith('dm:') || channelId.startsWith('gdm:');
    if (!isMainOrExempt && isDmOrGroupDm) {
      // Partner tracking: only for 1-to-1 DMs
      if (channelId.startsWith('dm:')) {
        const targetId = channelId.split(':').find((s: string) => s !== 'dm' && s !== senderId);
        if (targetId) {
          const partners = dmPartnersByPlayer[senderId] || [];
          if (!partners.includes(targetId)) {
            dmPartnersByPlayer = { ...dmPartnersByPlayer, [senderId]: [...partners, targetId] };
          }
        }
      }
      // Char tracking: shared pool for both 1-to-1 and group DMs
      const charsUsed = dmCharsByPlayer[senderId] || 0;
      dmCharsByPlayer = { ...dmCharsByPlayer, [senderId]: charsUsed + event.content.length };
    }

    return { channels, chatLog, roster, dmPartnersByPlayer, dmCharsByPlayer };
  }),

  // Side-effect: emit FACT.RECORD to L2 for journaling + sync trigger
  emitChatFact: sendParent(({ event }: any) => {
    if (event.type !== Events.Social.SEND_MSG) return { type: Events.Fact.RECORD, fact: { type: FactTypes.CHAT_MSG, actorId: '', timestamp: 0 } };
    const channelId = resolveChannelId(event);
    const isDM = channelId !== 'MAIN';
    return {
      type: Events.Fact.RECORD,
      fact: {
        type: isDM ? FactTypes.DM_SENT : FactTypes.CHAT_MSG,
        actorId: event.senderId,
        targetId: event.targetId,
        payload: { content: event.content, channelId },
        timestamp: Date.now(),
      },
    };
  }),

  // Channel message rejected: determine reason and notify parent (L2 → L1 → client)
  rejectChannelMessage: sendParent(({ context, event }: any): any => {
    if (event.type !== Events.Social.SEND_MSG) return { type: 'NOOP' };
    const senderId = event.senderId;
    const channelId = resolveChannelId(event);
    const content = event.content;
    const channel = context.channels[channelId];

    const overrides = context.perkOverrides?.[senderId] || { extraPartners: 0, extraChars: 0 };
    const charLimit = (context.dmCharsLimit ?? DM_MAX_CHARS_PER_DAY) + overrides.extraChars;

    let reason: DmRejectionReason = 'DMS_CLOSED';
    if (channelId === 'MAIN') {
      reason = 'GROUP_CHAT_CLOSED';
    } else if (!context.dmsOpen) {
      reason = 'DMS_CLOSED';
    } else if (channelId.startsWith('dm:')) {
      if (!channel) {
        reason = 'INVITE_REQUIRED';
      } else {
        const targetId = channelId.split(':').find((s: string) => s !== 'dm' && s !== senderId);
        if (senderId === targetId) {
          reason = 'SELF_DM';
        } else if (targetId && context.roster[targetId]?.status === PlayerStatuses.ELIMINATED) {
          reason = 'TARGET_ELIMINATED';
        } else if ((context.roster[senderId]?.silver ?? 0) < Config.dm.silverCost) {
          reason = 'INSUFFICIENT_SILVER';
        } else {
          const charsUsed = context.dmCharsByPlayer[senderId] || 0;
          if (charsUsed + content.length > charLimit) {
            reason = 'CHAR_LIMIT';
          }
        }
      }
    } else if (channelId.startsWith('gdm:')) {
      if (!channel) {
        reason = 'INVALID_MEMBERS'; // Group DM channel doesn't exist (must be pre-created)
      } else if ((context.roster[senderId]?.silver ?? 0) < Config.dm.silverCost) {
        reason = 'INSUFFICIENT_SILVER';
      } else {
        const charsUsed = context.dmCharsByPlayer[senderId] || 0;
        if (charsUsed + content.length > charLimit) {
          reason = 'CHAR_LIMIT';
        }
      }
    }

    console.warn(JSON.stringify({ level: 'warn', component: 'L3', event: 'social.reject.message', senderId, channelId, reason }));
    return { type: Events.Rejection.DM, reason, senderId };
  }),

  // Pure context update — transfers silver between players
  transferSilver: assign({
    roster: ({ context, event }: any) => {
      if (event.type !== Events.Social.SEND_SILVER) return context.roster;
      return transferSilverBetween(context.roster, event.senderId, event.targetId, event.amount);
    },
  }),
  // Side-effect: emit FACT.RECORD for silver transfer
  emitSilverFact: sendParent(({ event }: any) => {
    if (event.type !== Events.Social.SEND_SILVER) return { type: Events.Fact.RECORD, fact: { type: FactTypes.SILVER_TRANSFER, actorId: '', timestamp: 0 } };
    return {
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.SILVER_TRANSFER,
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
    if (event.type !== Events.Social.SEND_SILVER) return { type: 'NOOP' };
    const { senderId, targetId, amount } = event;
    let reason = 'UNKNOWN';
    if (senderId === targetId) reason = 'SELF_SEND';
    else if (!amount || amount <= 0) reason = 'INVALID_AMOUNT';
    else if ((context.roster[senderId]?.silver ?? 0) < amount) reason = 'INSUFFICIENT_SILVER';
    else if (context.roster[targetId]?.status === PlayerStatuses.ELIMINATED) reason = 'TARGET_ELIMINATED';
    else if (!context.roster[targetId]) reason = 'TARGET_NOT_FOUND';
    console.warn(JSON.stringify({ level: 'warn', component: 'L3', event: 'social.reject.silver', senderId, targetId, amount, reason }));
    return { type: Events.Rejection.SILVER_TRANSFER, senderId, reason };
  }),

  // Game channel management
  createGameChannel: assign(({ context, event }: any) => {
    const { channelId, memberIds, gameType, label, capabilities } = event;
    if (!channelId || context.channels[channelId]) return {};
    const newChannel: Channel = {
      id: channelId,
      type: 'GAME_DM',
      memberIds: memberIds || [],
      createdBy: `GAME:${gameType}`,
      createdAt: Date.now(),
      label,
      gameType,
      capabilities: capabilities || ['CHAT', 'GAME_ACTIONS'],
      constraints: { exempt: true, silverCost: 0 },
    };
    return { channels: { ...context.channels, [channelId]: newChannel } };
  }),
  destroyGameChannels: assign(({ context }: any) => {
    const channels = { ...context.channels };
    const chatLog = context.chatLog.filter((msg: any) => {
      const ch = channels[msg.channelId];
      return !ch || ch.type !== 'GAME_DM';
    });
    for (const [id, ch] of Object.entries(channels)) {
      if ((ch as Channel).type === 'GAME_DM') delete channels[id];
    }
    return { channels, chatLog };
  }),

  // Group DM channel creation
  createGroupDmChannel: assign(({ context, event }: any) => {
    if (event.type !== Events.Social.CREATE_CHANNEL) return {};
    const senderId = event.senderId;
    const allMembers = [senderId, ...event.memberIds];
    const channelId = groupDmChannelId(allMembers);

    // Idempotent: if channel already exists, no-op
    if (context.channels[channelId]) return {};

    const newChannel: Channel = {
      id: channelId,
      type: 'GROUP_DM',
      memberIds: allMembers,
      createdBy: senderId,
      createdAt: Date.now(),
      capabilities: ['CHAT'],
    };

    const dmGroupsByPlayer = { ...context.dmGroupsByPlayer };
    const groups = dmGroupsByPlayer[senderId] || [];
    dmGroupsByPlayer[senderId] = [...groups, channelId];

    return {
      channels: { ...context.channels, [channelId]: newChannel },
      dmGroupsByPlayer,
    };
  }),

  // Group DM creation rejected: determine reason and notify parent
  rejectGroupDmCreation: sendParent(({ context, event }: any): any => {
    if (event.type !== Events.Social.CREATE_CHANNEL) return { type: 'NOOP' };
    const senderId = event.senderId;
    const memberIds = event.memberIds || [];

    let reason: DmRejectionReason = 'DMS_CLOSED';
    if (!context.dmsOpen) {
      reason = 'DMS_CLOSED';
    } else if (memberIds.length < 2) {
      reason = 'INVALID_MEMBERS';
    } else if (memberIds.includes(senderId)) {
      reason = 'INVALID_MEMBERS';
    } else {
      // Check all members exist and are alive
      const allValid = memberIds.every((id: string) =>
        context.roster[id] && context.roster[id].status === PlayerStatuses.ALIVE
      );
      if (!allValid) {
        // Determine if it's eliminated or invalid
        const hasEliminated = memberIds.some((id: string) =>
          context.roster[id]?.status === 'ELIMINATED'
        );
        reason = hasEliminated ? 'TARGET_ELIMINATED' : 'INVALID_MEMBERS';
      } else {
        reason = 'GROUP_LIMIT';
      }
    }

    return { type: Events.Rejection.CHANNEL, reason, senderId };
  }),

  // --- DM Invitation Actions ---

  createPendingInvite: assign(({ context, event }: any) => {
    if (event.type !== Events.Social.INVITE_DM) return {};
    const senderId = event.senderId;
    const recipientIds = event.recipientIds || [];
    const type = recipientIds.length === 1 ? 'DM' : 'GROUP_DM';
    const channelId = type === 'DM'
      ? dmChannelId(senderId, recipientIds[0])
      : groupDmChannelId([senderId, ...recipientIds]);

    const invite: PendingInvite = {
      id: `inv_${Date.now()}_${senderId}`,
      channelId,
      senderId,
      recipientIds,
      acceptedBy: [],
      declinedBy: [],
      timestamp: Date.now(),
      type,
    };

    return { pendingInvites: [...context.pendingInvites, invite] };
  }),

  acceptDmInvite: assign(({ context, event }: any) => {
    if (event.type !== Events.Social.ACCEPT_DM) return {};
    const { senderId, inviteId } = event;

    const inviteIndex = context.pendingInvites.findIndex((inv: PendingInvite) => inv.id === inviteId);
    if (inviteIndex === -1) return {};

    const invite = context.pendingInvites[inviteIndex];
    const updatedAcceptedBy = [...invite.acceptedBy, senderId];
    const allAccepted = invite.recipientIds.every((id: string) => updatedAcceptedBy.includes(id));

    // Update conversation counts
    const acceptedConversationsByPlayer = { ...context.acceptedConversationsByPlayer };
    acceptedConversationsByPlayer[senderId] = (acceptedConversationsByPlayer[senderId] || 0) + 1;

    if (allAccepted) {
      // All recipients accepted — create the channel and remove the invite
      const allMembers = [invite.senderId, ...invite.recipientIds];
      const newChannel: Channel = {
        id: invite.channelId,
        type: invite.type === 'DM' ? 'DM' : 'GROUP_DM',
        memberIds: allMembers,
        createdBy: invite.senderId,
        createdAt: Date.now(),
        capabilities: ['CHAT', 'SILVER_TRANSFER'],
      };

      // Also increment sender's conversation count
      acceptedConversationsByPlayer[invite.senderId] = (acceptedConversationsByPlayer[invite.senderId] || 0) + 1;

      const pendingInvites = context.pendingInvites.filter((_: any, i: number) => i !== inviteIndex);
      return {
        pendingInvites,
        channels: { ...context.channels, [invite.channelId]: newChannel },
        acceptedConversationsByPlayer,
      };
    } else {
      // Update the invite with this acceptance
      const updatedInvite = { ...invite, acceptedBy: updatedAcceptedBy };
      const pendingInvites = [...context.pendingInvites];
      pendingInvites[inviteIndex] = updatedInvite;
      return { pendingInvites, acceptedConversationsByPlayer };
    }
  }),

  declineDmInvite: assign(({ context, event }: any) => {
    if (event.type !== Events.Social.DECLINE_DM) return {};
    const { senderId, inviteId } = event;

    const inviteIndex = context.pendingInvites.findIndex((inv: PendingInvite) => inv.id === inviteId);
    if (inviteIndex === -1) return {};

    const invite = context.pendingInvites[inviteIndex];

    // For 1:1 DM, just remove the invite
    // For group DM, mark declined and check if all have responded
    if (invite.type === 'DM') {
      return { pendingInvites: context.pendingInvites.filter((_: any, i: number) => i !== inviteIndex) };
    }

    const updatedDeclinedBy = [...invite.declinedBy, senderId];
    const allResponded = invite.recipientIds.every((id: string) =>
      invite.acceptedBy.includes(id) || updatedDeclinedBy.includes(id)
    );

    if (allResponded) {
      // Remove invite
      return { pendingInvites: context.pendingInvites.filter((_: any, i: number) => i !== inviteIndex) };
    }

    const updatedInvite = { ...invite, declinedBy: updatedDeclinedBy };
    const pendingInvites = [...context.pendingInvites];
    pendingInvites[inviteIndex] = updatedInvite;
    return { pendingInvites };
  }),

  rejectDmInvite: sendParent(({ context, event }: any): any => {
    if (event.type !== Events.Social.INVITE_DM) return { type: 'NOOP' };
    const senderId = event.senderId;
    const recipientIds = event.recipientIds || [];

    let reason: DmRejectionReason = 'DMS_CLOSED';
    if (!context.dmsOpen) {
      reason = 'DMS_CLOSED';
    } else if (recipientIds.includes(senderId)) {
      reason = 'SELF_DM';
    } else {
      const hasEliminated = recipientIds.some((id: string) =>
        context.roster[id]?.status === PlayerStatuses.ELIMINATED
      );
      if (hasEliminated) {
        reason = 'TARGET_ELIMINATED';
      } else {
        const senderConvs = context.acceptedConversationsByPlayer[senderId] || 0;
        if (senderConvs >= context.maxConversationsPerDay) {
          reason = 'CONVERSATION_LIMIT';
        } else {
          reason = 'DUPLICATE_INVITE';
        }
      }
    }
    return { type: Events.Rejection.DM, reason, senderId };
  }),

  rejectDmAccept: sendParent(({ event }: any): any => {
    if (event.type !== Events.Social.ACCEPT_DM) return { type: 'NOOP' };
    const reason: DmRejectionReason = 'CONVERSATION_LIMIT';
    return { type: Events.Rejection.DM, reason, senderId: event.senderId };
  }),
};

export const l3SocialGuards = {
  canInviteDm: ({ context, event }: any) => {
    if (event.type !== Events.Social.INVITE_DM) return false;
    if (!context.dmsOpen) return false;
    const senderId = event.senderId;
    const recipientIds = event.recipientIds || [];

    // Sender must be alive
    if (context.roster[senderId]?.status !== PlayerStatuses.ALIVE) return false;

    // Can't invite self
    if (recipientIds.includes(senderId)) return false;

    // All recipients must be alive
    for (const id of recipientIds) {
      if (!context.roster[id] || context.roster[id].status !== PlayerStatuses.ALIVE) return false;
    }

    // Check sender conversation limit
    const senderConvs = context.acceptedConversationsByPlayer[senderId] || 0;
    if (senderConvs >= context.maxConversationsPerDay) return false;

    // No duplicate invites
    const isDuplicate = context.pendingInvites.some((inv: PendingInvite) =>
      inv.senderId === senderId &&
      recipientIds.length === inv.recipientIds.length &&
      recipientIds.every((id: string) => inv.recipientIds.includes(id))
    );
    if (isDuplicate) return false;

    // Check if channel already exists (already accepted)
    // For 1:1 DM
    if (recipientIds.length === 1) {
      const channelId = dmChannelId(senderId, recipientIds[0]);
      if (context.channels[channelId]) return false;
    }

    return true;
  },

  canAcceptDm: ({ context, event }: any) => {
    if (event.type !== Events.Social.ACCEPT_DM) return false;
    const { senderId, inviteId } = event;

    // Find the invite
    const invite = context.pendingInvites.find((inv: PendingInvite) => inv.id === inviteId);
    if (!invite) return false;

    // Sender must be a recipient of this invite
    if (!invite.recipientIds.includes(senderId)) return false;

    // Check conversation limit for the acceptor
    const acceptorConvs = context.acceptedConversationsByPlayer[senderId] || 0;
    if (acceptorConvs >= context.maxConversationsPerDay) return false;

    // Can't accept twice
    if (invite.acceptedBy.includes(senderId)) return false;

    return true;
  },

  isGroupDmCreationAllowed: ({ context, event }: any) => {
    if (event.type !== Events.Social.CREATE_CHANNEL) return false;
    if (!context.dmsOpen) return false;

    const senderId = event.senderId;
    const memberIds = event.memberIds || [];

    // Must be alive
    if (context.roster[senderId]?.status !== PlayerStatuses.ALIVE) return false;

    // Need at least 2 other members, no self-inclusion
    if (memberIds.length < 2) return false;
    if (memberIds.includes(senderId)) return false;

    // All members must exist in roster and be alive
    for (const id of memberIds) {
      if (!context.roster[id] || context.roster[id].status !== PlayerStatuses.ALIVE) return false;
    }

    // Idempotent: if channel already exists, allow (no limit consumed)
    const allMembers = [senderId, ...memberIds];
    const channelId = groupDmChannelId(allMembers);
    if (context.channels[channelId]) return true;

    // Check group creation limit
    const groups = context.dmGroupsByPlayer[senderId] || [];
    if (groups.length >= DM_MAX_GROUPS_PER_DAY) return false;

    return true;
  },
  isSilverTransferAllowed: ({ context, event }: any) => {
    if (event.type !== Events.Social.SEND_SILVER) return false;
    const { senderId, targetId, amount } = event;
    if (senderId === targetId) return false;
    if (!amount || amount <= 0) return false;
    if ((context.roster[senderId]?.silver ?? 0) < amount) return false;
    if (!context.roster[targetId]) return false;
    if (context.roster[targetId]?.status === PlayerStatuses.ELIMINATED) return false;
    return true;
  },
  isChannelMessageAllowed: ({ context, event }: any) => {
    if (event.type !== Events.Social.SEND_MSG) return false;
    const channelId = resolveChannelId(event);
    const channel = context.channels[channelId];

    // Exempt channels (GAME_DM): always allowed while they exist
    if (channel?.constraints?.exempt) return true;

    // MAIN channel: check groupChatOpen
    if (channelId === 'MAIN') return context.groupChatOpen;

    // DM/GROUP_DM: check dmsOpen + limits
    if (!context.dmsOpen) return false;

    // DM channels must exist (created via invitation accept)
    if (channelId.startsWith('dm:') && !channel) return false;

    // Group DMs must be pre-created (no lazy creation)
    if (channelId.startsWith('gdm:') && !channel) return false;

    const senderId = event.senderId;
    const target = channelId.startsWith('dm:')
      ? channelId.split(':').find((s: string) => s !== 'dm' && s !== senderId)
      : null;
    if (senderId === target) return false;
    if (target && context.roster[target]?.status === PlayerStatuses.ELIMINATED) return false;
    if ((context.roster[senderId]?.silver ?? 0) < Config.dm.silverCost) return false;
    // Char limit
    const overrides = context.perkOverrides?.[senderId] || { extraPartners: 0, extraChars: 0 };
    const charLimit = (context.dmCharsLimit ?? DM_MAX_CHARS_PER_DAY) + overrides.extraChars;
    const charsUsed = context.dmCharsByPlayer[senderId] || 0;
    if (charsUsed + event.content.length > charLimit) return false;
    // Channel membership (if channel exists)
    if (channel && !channel.memberIds.includes(senderId)) return false;
    return true;
  },
};
