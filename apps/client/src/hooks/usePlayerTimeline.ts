import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { dmChannelId } from '@pecking-order/shared-types';
import type { TimelineEntry } from '../types/timeline';

/**
 * Merges DM messages with filtered ticker messages for a specific player pair.
 * - DM messages: from the channel between playerId and targetPlayerId
 * - Ticker messages: where involvedPlayerIds includes targetPlayerId
 *   (bilateral events like silver transfers, or unilateral like elimination)
 */
export function usePlayerTimeline(targetPlayerId: string): TimelineEntry[] {
  const playerId = useGameStore(s => s.playerId);
  const chatLog = useGameStore(s => s.chatLog);
  const tickerMessages = useGameStore(s => s.tickerMessages);

  return useMemo(() => {
    if (!playerId) return [];

    const entries: TimelineEntry[] = [];

    // DM messages between me and the target player
    const channelId = dmChannelId(playerId, targetPlayerId);
    const dmMessages = chatLog.filter(m => m.channelId === channelId);
    for (const msg of dmMessages) {
      entries.push({ kind: 'chat', key: `chat-${msg.id}`, timestamp: msg.timestamp, data: msg });
    }

    // Ticker messages involving the target player
    for (const t of tickerMessages) {
      if (t.involvedPlayerIds && t.involvedPlayerIds.includes(targetPlayerId)) {
        entries.push({ kind: 'system', key: `sys-${t.id}`, timestamp: t.timestamp, data: t });
      }
    }

    entries.sort((a, b) => a.timestamp - b.timestamp);
    return entries;
  }, [playerId, targetPlayerId, chatLog, tickerMessages]);
}
