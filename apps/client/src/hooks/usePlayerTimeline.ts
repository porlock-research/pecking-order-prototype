import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { ChannelTypes } from '@pecking-order/shared-types';
import type { TimelineEntry } from '../types/timeline';

/**
 * DM chat messages only — same filtering rules as the main group chat.
 * System/ticker events live in the notifications feed, not inline.
 */
export function usePlayerTimeline(targetPlayerId: string): TimelineEntry[] {
  const playerId = useGameStore(s => s.playerId);
  const chatLog = useGameStore(s => s.chatLog);
  const channels = useGameStore(s => s.channels);

  return useMemo(() => {
    if (!playerId) return [];

    const entries: TimelineEntry[] = [];

    // Collect all channel IDs for DM conversations between me and the target
    const channelIds = new Set<string>();

    for (const ch of Object.values(channels)) {
      if (ch.type !== ChannelTypes.DM) continue;
      const allIds = [...ch.memberIds, ...(ch.pendingMemberIds || [])];
      if (allIds.includes(playerId) && allIds.includes(targetPlayerId)) {
        channelIds.add(ch.id);
      }
    }

    // DM messages from any matching channel
    const dmMessages = chatLog.filter(m => channelIds.has(m.channelId));
    for (const msg of dmMessages) {
      entries.push({ kind: 'chat', key: `chat-${msg.id}`, timestamp: msg.timestamp, data: msg });
    }

    entries.sort((a, b) => a.timestamp - b.timestamp);
    return entries;
  }, [playerId, targetPlayerId, chatLog, channels]);
}
