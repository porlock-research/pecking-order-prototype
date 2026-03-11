import type { ChatMessage, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';

const MAX_CHAT_LOG = Config.chat.maxLogSize;

export function buildChatMessage(
  senderId: string,
  content: string,
  channelId: string,
): ChatMessage {
  const channel = channelId === 'MAIN' ? 'MAIN' as const : 'DM' as const;
  return {
    id: crypto.randomUUID(),
    senderId,
    timestamp: Date.now(),
    content,
    channelId,
    channel,
  };
}

/**
 * Resolve an existing channel for a SEND_MSG event.
 * - If channelId is present -> use it directly
 * - If recipientIds present (no channelId) -> find existing channel by member set
 * - If targetId present (legacy compat) -> find existing channel by member pair
 * - Otherwise -> MAIN
 * Returns null if no existing channel found (signals new channel needed).
 */
export function resolveExistingChannel(
  channels: Record<string, any>,
  event: any,
): string | null {
  if (event.channelId) return event.channelId;

  const recipientIds: string[] = event.recipientIds || (event.targetId ? [event.targetId] : []);
  if (recipientIds.length === 0) return 'MAIN';

  const senderId = event.senderId;
  const allMembers = new Set([senderId, ...recipientIds]);

  for (const ch of Object.values(channels) as any[]) {
    if (ch.type !== 'DM' && ch.type !== 'GROUP_DM') continue;
    const chMembers = new Set([...(ch.memberIds || []), ...(ch.pendingMemberIds || [])]);
    if (chMembers.size !== allMembers.size) continue;
    if ([...allMembers].every((id: string) => chMembers.has(id))) return ch.id;
  }

  return null;
}

/** Backward-compat wrapper: resolves to an existing channel or falls back to 'MAIN'. */
export function resolveChannelId(event: any, channels?: Record<string, any>): string {
  if (event.channelId) return event.channelId;
  if (channels) {
    const found = resolveExistingChannel(channels, event);
    if (found) return found;
  }
  return 'MAIN';
}

export function appendToChatLog(
  chatLog: ChatMessage[],
  msg: ChatMessage,
  max: number = MAX_CHAT_LOG,
): ChatMessage[] {
  const updated = [...chatLog, msg];
  return updated.length > max ? updated.slice(-max) : updated;
}

export function deductSilver(
  roster: Record<string, SocialPlayer>,
  playerId: string,
  amount: number,
): Record<string, SocialPlayer> {
  const player = roster[playerId];
  if (!player) return roster;
  return { ...roster, [playerId]: { ...player, silver: player.silver - amount } };
}

export function transferSilverBetween(
  roster: Record<string, SocialPlayer>,
  fromId: string,
  toId: string,
  amount: number,
): Record<string, SocialPlayer> {
  const from = roster[fromId];
  const to = roster[toId];
  if (!from || !to || from.silver < amount) return roster;
  return {
    ...roster,
    [fromId]: { ...from, silver: from.silver - amount },
    [toId]: { ...to, silver: to.silver + amount },
  };
}
