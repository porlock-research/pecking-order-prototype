import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import type { TimelineEntry } from '../types/timeline';

/**
 * Main chat timeline: only chat messages.
 * Cartridges are now rendered in the Today tab (ADR-124).
 */
export function useTimeline(): TimelineEntry[] {
  const chatLog = useGameStore(s => s.chatLog);

  return useMemo(() => {
    const entries: TimelineEntry[] = [];

    const mainChat = chatLog.filter(m => m.channelId === 'MAIN' || (!m.channelId && m.channel === 'MAIN'));
    for (const msg of mainChat) {
      entries.push({ kind: 'chat', key: `chat-${msg.id}`, timestamp: msg.timestamp, data: msg });
    }

    // Sort chronologically
    entries.sort((a, b) => a.timestamp - b.timestamp);

    return entries;
  }, [chatLog]);
}
