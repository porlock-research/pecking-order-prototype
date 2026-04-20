import { assign, sendParent } from 'xstate';
import type { DmRejectionReason, Channel, ChannelCapability } from '@pecking-order/shared-types';
import { DM_MAX_CHARS_PER_DAY, DM_MAX_GROUPS_PER_DAY, Config, groupDmChannelId, Events, FactTypes, PlayerStatuses } from '@pecking-order/shared-types';
import { buildChatMessage, appendToChatLog, deductSilver, transferSilverBetween, resolveExistingChannel } from './social-helpers';

function channelHasCapability(
  channels: Record<string, Channel>,
  channelId: string | undefined,
  capability: ChannelCapability,
): boolean {
  if (!channelId) return false;
  const ch = channels[channelId];
  if (!ch) return false;
  return ch.capabilities?.includes(capability) ?? false;
}

export const l3SocialActions = {
  // Unified message handler — handles existing channels, new channel creation, and legacy targetId
  processChannelMessage: assign(({ context, event }: any) => {
    if (event.type !== Events.Social.SEND_MSG) return {};
    const senderId = event.senderId;
    const existingChannelId = resolveExistingChannel(context.channels, event);

    let channels = { ...context.channels };
    let channelId: string;
    let slotsUsedByPlayer = { ...context.slotsUsedByPlayer };
    const isInviteMode = context.requireDmInvite;

    if (existingChannelId) {
      channelId = existingChannelId;
    } else {
      // First message — create new channel
      const recipientIds: string[] = event.recipientIds || (event.targetId ? [event.targetId] : []);
      if (recipientIds.length === 0) {
        // MAIN channel message
        channelId = 'MAIN';
      } else {
        channelId = crypto.randomUUID();
        const isGroup = recipientIds.length > 1;
        const channelType = isGroup ? 'GROUP_DM' : 'DM';

        if (isInviteMode) {
          channels[channelId] = {
            id: channelId,
            type: channelType,
            memberIds: [senderId],
            pendingMemberIds: recipientIds,
            createdBy: senderId,
            createdAt: Date.now(),
            capabilities: channelType === 'DM'
              ? ['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER', 'NUDGE']
              : ['CHAT', 'INVITE_MEMBER'],
          };
        } else {
          channels[channelId] = {
            id: channelId,
            type: channelType,
            memberIds: [senderId, ...recipientIds],
            createdBy: senderId,
            createdAt: Date.now(),
            capabilities: channelType === 'DM'
              ? ['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER', 'NUDGE']
              : ['CHAT', 'INVITE_MEMBER'],
          };
        }
        // Sender consumes a slot for new conversation
        slotsUsedByPlayer[senderId] = (slotsUsedByPlayer[senderId] ?? 0) + 1;
      }
    }

    // Membership check: sender must be in memberIds to send (skip for MAIN)
    if (channelId !== 'MAIN') {
      const channel = channels[channelId];
      if (channel && !channel.memberIds.includes(senderId)) {
        return {};
      }
    }

    const msg = buildChatMessage(senderId, event.content, channelId, {
      replyTo: event.replyTo,
    });
    const chatLog = appendToChatLog(context.chatLog, msg);

    // Silver cost
    const ch = channels[channelId];
    const isExempt = ch?.constraints?.exempt;
    const isMainOrExempt = channelId === 'MAIN' || isExempt;
    const silverCost = isMainOrExempt ? 0 : (ch?.constraints?.silverCost ?? Config.dm.silverCost);
    const roster = silverCost > 0
      ? deductSilver(context.roster, senderId, silverCost)
      : context.roster;

    // DM char tracking (skip for MAIN and exempt channels)
    let dmCharsByPlayer = context.dmCharsByPlayer;
    if (!isMainOrExempt && channelId !== 'MAIN') {
      const charsUsed = dmCharsByPlayer[senderId] || 0;
      dmCharsByPlayer = { ...dmCharsByPlayer, [senderId]: charsUsed + event.content.length };
    }

    return { channels, chatLog, roster, slotsUsedByPlayer, dmCharsByPlayer };
  }),

  // Side-effect: emit DM_INVITE_SENT when SEND_MSG creates a new DM/GROUP_DM channel.
  // Fires push notifications to invited recipients (covers invite-mode gap where
  // emitChatFact's DM_SENT has no target since memberIds only has the sender).
  // Also feeds the narrator ticker pipeline for fact-driven "started talking to someone"
  // / "is scheming with someone" lines.
  // Emits nothing for MAIN messages or messages into an existing channel.
  emitInitialDmInviteFact: sendParent(({ context, event }: any) => {
    if (event.type !== Events.Social.SEND_MSG) return { type: 'NOOP' };
    const lastMsg = context.chatLog[context.chatLog.length - 1];
    const channelId = lastMsg?.channelId;
    if (!channelId || channelId === 'MAIN') return { type: 'NOOP' };
    const channel = context.channels[channelId];
    if (!channel || channel.createdBy !== event.senderId) return { type: 'NOOP' };
    // Fire only on channel creation: the first message in this channel is the one we just appended.
    const priorMessagesInChannel = context.chatLog
      .slice(0, -1)
      .some((m: any) => m.channelId === channelId);
    if (priorMessagesInChannel) return { type: 'NOOP' };
    const allRecipients = [
      ...channel.memberIds.filter((id: string) => id !== event.senderId),
      ...(channel.pendingMemberIds ?? []),
    ];
    if (allRecipients.length === 0) return { type: 'NOOP' };
    return {
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.DM_INVITE_SENT,
        actorId: event.senderId,
        payload: { channelId, memberIds: allRecipients, kind: 'initial' },
        timestamp: Date.now(),
      },
    };
  }),

  // Side-effect: emit FACT.RECORD to L2 for journaling + sync trigger
  // NOTE: sendParent() runs AFTER assign(), so context.chatLog already has the new message
  emitChatFact: sendParent(({ context, event }: any) => {
    if (event.type !== Events.Social.SEND_MSG) return { type: Events.Fact.RECORD, fact: { type: FactTypes.CHAT_MSG, actorId: '', timestamp: 0 } };
    // Read channelId from the last message in chatLog (processChannelMessage already ran)
    const lastMsg = context.chatLog[context.chatLog.length - 1];
    const channelId = lastMsg?.channelId ?? event.channelId ?? 'MAIN';
    const isDM = channelId !== 'MAIN';

    // Resolve target(s) from channel members (needed for push notifications)
    let targetId: string | undefined;
    let targetIds: string[] | undefined;
    if (isDM) {
      const channel = context.channels[channelId];
      if (channel) {
        const others = channel.memberIds.filter((id: string) => id !== event.senderId);
        if (channel.type === 'DM' && others.length === 1) {
          targetId = others[0];
        } else if (others.length > 0) {
          targetIds = others;
        }
      }
    }

    // Enrich MAIN messages with reply-to author and @mention target ids so
    // handleFactPush can route MENTION/REPLY pushes without needing chatLog
    // access. Scoped to MAIN — DMs already get DM_SENT pushes per-recipient.
    let replyToAuthorId: string | undefined;
    let mentionedIds: string[] | undefined;
    if (!isDM) {
      if (event.replyTo) {
        const orig = context.chatLog.find((m: any) => m.id === event.replyTo);
        if (orig && orig.senderId !== event.senderId) replyToAuthorId = orig.senderId;
      }
      const content: string = event.content || '';
      const ids: string[] = [];
      for (const [pid, p] of Object.entries(context.roster)) {
        if (pid === event.senderId) continue;
        const personaName = (p as any)?.personaName;
        if (personaName && content.includes(`@${personaName}`)) ids.push(pid);
      }
      if (ids.length > 0) mentionedIds = ids;
    }

    return {
      type: Events.Fact.RECORD,
      fact: {
        type: isDM ? FactTypes.DM_SENT : FactTypes.CHAT_MSG,
        actorId: event.senderId,
        targetId,
        payload: {
          content: event.content,
          channelId,
          targetIds,
          ...(replyToAuthorId ? { replyToAuthorId } : {}),
          ...(mentionedIds ? { mentionedIds } : {}),
        },
        timestamp: Date.now(),
      },
    };
  }),

  // Channel message rejected: determine reason and notify parent (L2 -> L1 -> client)
  rejectChannelMessage: sendParent(({ context, event }: any): any => {
    if (event.type !== Events.Social.SEND_MSG) return { type: 'NOOP' };
    const senderId = event.senderId;
    const existingChannelId = resolveExistingChannel(context.channels, event);

    let reason: DmRejectionReason = 'DMS_CLOSED';

    if (existingChannelId === 'MAIN' || (!existingChannelId && !event.recipientIds?.length && !event.targetId)) {
      reason = 'GROUP_CHAT_CLOSED';
    } else if (!context.dmsOpen) {
      reason = 'DMS_CLOSED';
    } else if (existingChannelId) {
      const channel = context.channels[existingChannelId];
      if (!channel) {
        reason = 'INVITE_REQUIRED';
      } else if (!channel.memberIds.includes(senderId)) {
        reason = 'INVITE_REQUIRED';
      } else if ((context.roster[senderId]?.silver ?? 0) < Config.dm.silverCost) {
        reason = 'INSUFFICIENT_SILVER';
      } else {
        reason = 'CHAR_LIMIT';
      }
    } else {
      // New channel creation rejected
      const recipientIds = event.recipientIds || (event.targetId ? [event.targetId] : []);
      if (recipientIds.includes(senderId)) {
        reason = 'SELF_DM';
      } else if (recipientIds.some((id: string) => context.roster[id]?.status === PlayerStatuses.ELIMINATED)) {
        reason = 'TARGET_ELIMINATED';
      } else if ((context.roster[senderId]?.silver ?? 0) < Config.dm.silverCost) {
        reason = 'INSUFFICIENT_SILVER';
      } else {
        const used = context.slotsUsedByPlayer[senderId] ?? 0;
        if (used >= context.dmSlotsPerPlayer) {
          reason = 'CONVERSATION_LIMIT';
        }
      }
    }

    console.warn(JSON.stringify({ level: 'warn', component: 'L3', event: 'social.reject.message', senderId, reason }));
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
  // Silver transfer rejected: notify parent (L2 -> L1 -> client)
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

  // --- Reactions ---
  processReaction: assign(({ context, event }: any) => {
    if (event.type !== Events.Social.REACT) return {};
    const { senderId, messageId, emoji } = event;
    const ALLOWED_EMOJIS = ['😂', '👀', '🔥', '💀', '❤️'];
    if (!ALLOWED_EMOJIS.includes(emoji)) return {};

    const chatLog = context.chatLog.map((msg: any) => {
      if (msg.id !== messageId) return msg;
      const reactions: Record<string, string[]> = { ...(msg.reactions || {}) };
      const reactors = reactions[emoji] ? [...reactions[emoji]] : [];
      const idx = reactors.indexOf(senderId);
      if (idx >= 0) {
        reactors.splice(idx, 1);
        if (reactors.length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = reactors;
        }
      } else {
        reactions[emoji] = [...reactors, senderId];
      }
      return { ...msg, reactions: Object.keys(reactions).length > 0 ? reactions : undefined };
    });
    return { chatLog };
  }),

  emitReactionFact: sendParent(({ event }: any) => {
    if (event.type !== Events.Social.REACT) return { type: Events.Fact.RECORD, fact: { type: FactTypes.REACTION, actorId: '', timestamp: 0 } };
    return {
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.REACTION,
        actorId: event.senderId,
        payload: { messageId: event.messageId, emoji: event.emoji },
        timestamp: Date.now(),
      },
    };
  }),

  // --- Nudge ---
  trackNudge: assign(({ context, event }: any) => {
    if (event.type !== Events.Social.NUDGE) return {};
    const nudgesThisDay = { ...(context.nudgesThisDay || {}) };
    nudgesThisDay[`${event.senderId}:${event.targetId}`] = true;
    return { nudgesThisDay };
  }),

  processNudge: sendParent(({ event }: any) => {
    if (event.type !== Events.Social.NUDGE) return { type: Events.Fact.RECORD, fact: { type: FactTypes.NUDGE, actorId: '', timestamp: 0 } };
    return {
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.NUDGE,
        actorId: event.senderId,
        targetId: event.targetId,
        payload: {},
        timestamp: Date.now(),
      },
    };
  }),

  // --- Whisper ---
  processWhisper: assign(({ context, event }: any) => {
    if (event.type !== Events.Social.WHISPER) return {};
    const msg = buildChatMessage(event.senderId, event.text, 'MAIN', {
      whisperTarget: event.targetId,
    });
    const chatLog = appendToChatLog(context.chatLog, msg);
    return { chatLog };
  }),

  emitWhisperFact: sendParent(({ event }: any) => {
    if (event.type !== Events.Social.WHISPER) return { type: Events.Fact.RECORD, fact: { type: FactTypes.WHISPER, actorId: '', timestamp: 0 } };
    return {
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.WHISPER,
        actorId: event.senderId,
        targetId: event.targetId,
        payload: {},
        timestamp: Date.now(),
      },
    };
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
    const recipientIds: string[] = event.memberIds;
    const allMembers = [senderId, ...recipientIds];
    const channelId = groupDmChannelId(allMembers);

    // Idempotent: if channel already exists, no-op
    if (context.channels[channelId]) return {};

    const isInviteMode = context.requireDmInvite;

    const newChannel: Channel = {
      id: channelId,
      type: 'GROUP_DM',
      ...(isInviteMode
        ? { memberIds: [senderId], pendingMemberIds: recipientIds }
        : { memberIds: allMembers }),
      createdBy: senderId,
      createdAt: Date.now(),
      capabilities: ['CHAT', 'INVITE_MEMBER'],
    };

    const dmGroupsByPlayer = { ...context.dmGroupsByPlayer };
    const groups = dmGroupsByPlayer[senderId] || [];
    dmGroupsByPlayer[senderId] = [...groups, channelId];

    // Consume a whisper slot for the sender
    const slotsUsedByPlayer = { ...context.slotsUsedByPlayer };
    slotsUsedByPlayer[senderId] = (slotsUsedByPlayer[senderId] ?? 0) + 1;

    return {
      channels: { ...context.channels, [channelId]: newChannel },
      dmGroupsByPlayer,
      slotsUsedByPlayer,
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

  // --- DM Invitation Actions (unified channel model) ---

  // Add member to an existing channel
  addMemberToChannel: assign(({ context, event }: any) => {
    if (event.type !== Events.Social.ADD_MEMBER) return {};
    const { senderId, channelId, memberIds: newMemberIds, message } = event;
    const channels = { ...context.channels };
    const channel = channels[channelId];
    if (!channel) return {};

    const isInviteMode = context.requireDmInvite;
    const updatedMemberIds = isInviteMode
      ? channel.memberIds
      : [...channel.memberIds, ...newMemberIds];
    const updatedPendingIds = isInviteMode
      ? [...(channel.pendingMemberIds ?? []), ...newMemberIds]
      : channel.pendingMemberIds;

    const totalMembers = updatedMemberIds.length + (updatedPendingIds?.length ?? 0);
    const shouldPromote = channel.type === 'DM' && totalMembers > 2;

    // On promotion to GROUP_DM, strip caps that only make sense 1:1:
    // NUDGE (spammy in groups) and SILVER_TRANSFER (silver is a 1:1 social proof).
    const promotedCaps = shouldPromote
      ? (channel.capabilities ?? []).filter(
          (c: ChannelCapability) => c !== 'NUDGE' && c !== 'SILVER_TRANSFER',
        )
      : channel.capabilities;

    channels[channelId] = {
      ...channel,
      memberIds: updatedMemberIds,
      pendingMemberIds: updatedPendingIds,
      capabilities: promotedCaps,
      ...(shouldPromote ? { type: 'GROUP_DM' as const } : {}),
    };

    let chatLog = context.chatLog;
    if (message) {
      const msg = buildChatMessage(senderId, message, channelId);
      chatLog = appendToChatLog(chatLog, msg);
    }

    return { channels, chatLog };
  }),

  // Record fact for ADD_MEMBER
  recordAddMemberFact: sendParent(({ event }: any) => {
    if (event.type !== Events.Social.ADD_MEMBER) return { type: Events.Fact.RECORD, fact: { type: FactTypes.DM_INVITE_SENT, actorId: '', timestamp: 0 } };
    return {
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.DM_INVITE_SENT,
        actorId: event.senderId,
        payload: { channelId: event.channelId, memberIds: event.memberIds, kind: 'add_member' },
        timestamp: Date.now(),
      },
    };
  }),

  // Reject ADD_MEMBER
  rejectAddMember: sendParent(({ event }: any): any => {
    if (event.type !== Events.Social.ADD_MEMBER) return { type: 'NOOP' };
    return { type: Events.Rejection.CHANNEL, reason: 'UNAUTHORIZED', senderId: event.senderId };
  }),

  // Accept DM invite: move player from pendingMemberIds to memberIds
  acceptDmInvite: assign(({ context, event }: any) => {
    if (event.type !== Events.Social.ACCEPT_DM) return {};
    const acceptorId = event.senderId;
    const { channelId } = event;
    const channels = { ...context.channels };
    const channel = channels[channelId];
    if (!channel) return {};

    const pendingMemberIds = (channel.pendingMemberIds || []).filter((id: string) => id !== acceptorId);
    const memberIds = channel.memberIds.includes(acceptorId)
      ? channel.memberIds
      : [...channel.memberIds, acceptorId];

    channels[channelId] = { ...channel, memberIds, pendingMemberIds };

    const slotsUsedByPlayer = { ...context.slotsUsedByPlayer };
    slotsUsedByPlayer[acceptorId] = (slotsUsedByPlayer[acceptorId] ?? 0) + 1;

    return { channels, slotsUsedByPlayer };
  }),

  recordInviteAcceptedFact: sendParent(({ event }: any) => {
    if (event.type !== Events.Social.ACCEPT_DM) return { type: Events.Fact.RECORD, fact: { type: FactTypes.DM_INVITE_ACCEPTED, actorId: '', timestamp: 0 } };
    return {
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.DM_INVITE_ACCEPTED,
        actorId: event.senderId,
        payload: { channelId: event.channelId },
        timestamp: Date.now(),
      },
    };
  }),

  // Decline DM invite: remove from pendingMemberIds, free sender slot
  declineDmInvite: assign(({ context, event }: any) => {
    if (event.type !== Events.Social.DECLINE_DM) return {};
    const declinerId = event.senderId;
    const { channelId } = event;
    const channels = { ...context.channels };
    const channel = channels[channelId];
    if (!channel) return {};

    const pendingMemberIds = (channel.pendingMemberIds || []).filter((id: string) => id !== declinerId);
    channels[channelId] = { ...channel, pendingMemberIds };

    // Free the sender's slot (channel creator)
    const slotsUsedByPlayer = { ...context.slotsUsedByPlayer };
    const creatorId = channel.createdBy;
    if (creatorId && slotsUsedByPlayer[creatorId] > 0) {
      slotsUsedByPlayer[creatorId] -= 1;
    }

    return { channels, slotsUsedByPlayer };
  }),

  recordInviteDeclinedFact: sendParent(({ event }: any) => {
    if (event.type !== Events.Social.DECLINE_DM) return { type: Events.Fact.RECORD, fact: { type: FactTypes.DM_INVITE_DECLINED, actorId: '', timestamp: 0 } };
    return {
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.DM_INVITE_DECLINED,
        actorId: event.senderId,
        payload: { channelId: event.channelId },
        timestamp: Date.now(),
      },
    };
  }),

  // Reject DM accept (e.g., slot limit reached)
  rejectDmAccept: sendParent(({ event }: any): any => {
    if (event.type !== Events.Social.ACCEPT_DM) return { type: 'NOOP' };
    const reason: DmRejectionReason = 'CONVERSATION_LIMIT';
    return { type: Events.Rejection.DM, reason, senderId: event.senderId };
  }),
};

export const l3SocialGuards = {
  // Guard for ADD_MEMBER
  canAddMember: ({ context, event }: any) => {
    if (event.type !== Events.Social.ADD_MEMBER) return false;
    const { senderId, channelId, memberIds: newMemberIds } = event;
    const channel = context.channels[channelId];
    if (!channel) return false;
    if (!channelHasCapability(context.channels, channelId, 'INVITE_MEMBER')) return false;
    if (channel.createdBy !== senderId) return false;
    if (!context.dmsOpen) return false;

    const existingIds = new Set([...(channel.memberIds || []), ...(channel.pendingMemberIds || [])]);
    for (const id of newMemberIds) {
      if (existingIds.has(id)) return false;
      if (!context.roster[id] || context.roster[id].status !== PlayerStatuses.ALIVE) return false;
    }
    return true;
  },

  // Guard for ACCEPT_DM: acceptor must be in pendingMemberIds + have slot available
  canAcceptDm: ({ context, event }: any) => {
    if (event.type !== Events.Social.ACCEPT_DM) return false;
    const acceptorId = event.senderId;
    const { channelId } = event;
    const channel = context.channels[channelId];
    if (!channel) return false;
    if (!(channel.pendingMemberIds || []).includes(acceptorId)) return false;
    const used = context.slotsUsedByPlayer[acceptorId] ?? 0;
    if (used >= context.dmSlotsPerPlayer) return false;
    return true;
  },

  // Guard for DECLINE_DM: decliner must be in pendingMemberIds
  canDeclineDm: ({ context, event }: any) => {
    if (event.type !== Events.Social.DECLINE_DM) return false;
    const declinerId = event.senderId;
    const { channelId } = event;
    const channel = context.channels[channelId];
    if (!channel) return false;
    return (channel.pendingMemberIds || []).includes(declinerId);
  },

  // Guard: reaction target message must exist in chatLog
  isReactionAllowed: ({ context, event }: any) => {
    if (event.type !== Events.Social.REACT) return false;
    const ALLOWED_EMOJIS = ['😂', '👀', '🔥', '💀', '❤️'];
    if (!ALLOWED_EMOJIS.includes(event.emoji)) return false;
    return context.chatLog.some((msg: any) => msg.id === event.messageId);
  },

  // Guard: nudge target must be alive, one per sender→target per day
  isNudgeAllowed: ({ context, event }: any) => {
    if (event.type !== Events.Social.NUDGE) return false;
    const { senderId, targetId } = event;
    if (senderId === targetId) return false;
    if (!context.roster[targetId] || context.roster[targetId].status !== PlayerStatuses.ALIVE) return false;
    if (!context.roster[senderId] || context.roster[senderId].status !== PlayerStatuses.ALIVE) return false;
    // Rate limit: check facts for existing NUDGE from sender→target today
    // Facts are recorded via L2, not directly available in L3 context.
    // We use a lightweight tracking approach: store nudges in context.
    const nudges = context.nudgesThisDay || {};
    const key = `${senderId}:${targetId}`;
    if (nudges[key]) return false;
    return true;
  },

  // Guard: whisper target must be alive, text non-empty, MAIN must carry the WHISPER cap,
  // AND DMs must be open (whisper delivers as a DM — if DMs are closed, the underlying
  // channel for whispers is gated closed too).
  isWhisperAllowed: ({ context, event }: any) => {
    if (event.type !== Events.Social.WHISPER) return false;
    // Consistency check: whispers require MAIN to carry the WHISPER capability.
    // Drop the cap (test harness / future feature flag) → whispers are disabled.
    if (!channelHasCapability(context.channels, 'MAIN', 'WHISPER')) return false;
    // Phase gate: whispers share the DM channel lifecycle. When DMs are closed
    // (before OPEN_DMS, after CLOSE_DMS), whispers must be rejected. Without this
    // the client could send whispers during the post-chat window even though the
    // underlying private-message surface is closed.
    if (!context.dmsOpen) return false;
    const { senderId, targetId, text } = event;
    if (senderId === targetId) return false;
    if (!text || text.length === 0) return false;
    if (!context.roster[targetId] || context.roster[targetId].status !== PlayerStatuses.ALIVE) return false;
    if (!context.roster[senderId] || context.roster[senderId].status !== PlayerStatuses.ALIVE) return false;
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

    // Check unified whisper slot limit
    const used = context.slotsUsedByPlayer[senderId] ?? 0;
    if (used >= context.dmSlotsPerPlayer) return false;

    // Check group creation limit
    const groups = context.dmGroupsByPlayer[senderId] || [];
    if (groups.length >= DM_MAX_GROUPS_PER_DAY) return false;

    return true;
  },
  isSilverTransferAllowed: ({ context, event }: any) => {
    if (event.type !== Events.Social.SEND_SILVER) return false;
    const { senderId, targetId, amount } = event;
    // Capability check — if within a channel, require SILVER_TRANSFER
    const resolvedChannel = resolveExistingChannel(context.channels, event);
    if (resolvedChannel && !channelHasCapability(context.channels, resolvedChannel, 'SILVER_TRANSFER')) return false;
    if (senderId === targetId) return false;
    if (!amount || amount <= 0) return false;
    if ((context.roster[senderId]?.silver ?? 0) < amount) return false;
    if (!context.roster[targetId]) return false;
    if (context.roster[targetId]?.status === PlayerStatuses.ELIMINATED) return false;
    return true;
  },

  // Unified channel message guard
  isChannelMessageAllowed: ({ context, event }: any) => {
    if (event.type !== Events.Social.SEND_MSG) return false;
    const senderId = event.senderId;
    const existingChannelId = resolveExistingChannel(context.channels, event);

    if (existingChannelId) {
      const channel = context.channels[existingChannelId];
      if (!channel) return false;
      if (!channel.capabilities?.includes('CHAT')) return false;
      if (channel.constraints?.exempt) return true;
      if (existingChannelId === 'MAIN') return context.groupChatOpen;
      if (!context.dmsOpen && !channel.constraints?.exempt) return false;
      if (!channel.memberIds.includes(senderId)) return false;
      // Char limit
      const overrides = context.perkOverrides?.[senderId] || { extraPartners: 0, extraChars: 0 };
      const charLimit = (context.dmCharsLimit ?? DM_MAX_CHARS_PER_DAY) + overrides.extraChars;
      const charsUsed = context.dmCharsByPlayer[senderId] || 0;
      if (charsUsed + event.content.length > charLimit) return false;
      // Silver check
      const silverCost = channel.constraints?.silverCost ?? Config.dm.silverCost;
      if ((context.roster[senderId]?.silver ?? 0) < silverCost) return false;
      return true;
    }

    // New channel
    const recipientIds: string[] = event.recipientIds || (event.targetId ? [event.targetId] : []);
    if (recipientIds.length === 0) return context.groupChatOpen; // MAIN channel

    if (!context.dmsOpen) return false;
    if (!context.roster[senderId] || context.roster[senderId].status !== PlayerStatuses.ALIVE) return false;

    for (const rid of recipientIds) {
      if (rid === senderId) return false;
      if (!context.roster[rid] || context.roster[rid].status !== PlayerStatuses.ALIVE) return false;
    }

    // Slot check
    const used = context.slotsUsedByPlayer[senderId] ?? 0;
    if (used >= context.dmSlotsPerPlayer) return false;

    // Silver check
    if ((context.roster[senderId]?.silver ?? 0) < Config.dm.silverCost) return false;

    return true;
  },
};
