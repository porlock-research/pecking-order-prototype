import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { ChannelTypes } from '@pecking-order/shared-types';
import type { TimelineEntry } from '../types/timeline';

/**
 * Merges DM messages with filtered ticker messages for a specific player pair.
 * - DM messages: from DM channels between playerId and targetPlayerId
 * - Ticker messages: where involvedPlayerIds includes targetPlayerId
 *   (bilateral events like silver transfers, or unilateral like elimination)
 */
export function usePlayerTimeline(targetPlayerId: string): TimelineEntry[] {
  const playerId = useGameStore(s => s.playerId);
  const chatLog = useGameStore(s => s.chatLog);
  const channels = useGameStore(s => s.channels);
  const tickerMessages = useGameStore(s => s.tickerMessages);

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

    // Ticker messages involving BOTH players in the DM conversation
    for (const t of tickerMessages) {
      if (t.involvedPlayerIds && t.involvedPlayerIds.includes(targetPlayerId) && t.involvedPlayerIds.includes(playerId)) {
        entries.push({ kind: 'system', key: `sys-${t.id}`, timestamp: t.timestamp, data: t });
      }
    }

    entries.sort((a, b) => a.timestamp - b.timestamp);
    return entries;
  }, [playerId, targetPlayerId, chatLog, channels, tickerMessages]);
}
