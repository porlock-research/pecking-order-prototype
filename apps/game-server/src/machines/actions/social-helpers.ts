import type { ChatMessage, SocialPlayer } from '@pecking-order/shared-types';
import { dmChannelId } from '@pecking-order/shared-types';

const MAX_CHAT_LOG = 50;

export function buildChatMessage(
  senderId: string,
  content: string,
  channelId: string,
): ChatMessage {
  // Derive deprecated fields for backward compat
  const channel = channelId === 'MAIN' ? 'MAIN' as const : 'DM' as const;
  const targetId = channelId.startsWith('dm:')
    ? channelId.split(':').find(s => s !== 'dm' && s !== senderId)
    : undefined;
  return {
    id: crypto.randomUUID(),
    senderId,
    timestamp: Date.now(),
    content,
    channelId,
    channel,
    targetId,
  };
}

/** Bridge old events (with targetId) to channelId-based model */
export function resolveChannelId(event: any): string {
  if (event.channelId) return event.channelId;
  if (event.targetId) return dmChannelId(event.senderId, event.targetId);
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
