import type { ChatMessage, SocialPlayer } from '@pecking-order/shared-types';

const MAX_CHAT_LOG = 50;

export function buildChatMessage(
  senderId: string,
  content: string,
  channel: 'MAIN' | 'DM',
  targetId?: string,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    senderId,
    timestamp: Date.now(),
    content,
    channel,
    targetId,
  };
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
