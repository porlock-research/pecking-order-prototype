import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import type { TimelineEntry } from '../components/timeline/types';

export function useTimeline(): TimelineEntry[] {
  const chatLog = useGameStore(s => s.chatLog);
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const activeVotingCartridge = useGameStore(s => s.activeVotingCartridge);
  const activeGameCartridge = useGameStore(s => s.activeGameCartridge);
  const activePromptCartridge = useGameStore(s => s.activePromptCartridge);
  const completedCartridges = useGameStore(s => s.completedCartridges);

  return useMemo(() => {
    const entries: TimelineEntry[] = [];

    const mainChat = chatLog.filter(m => m.channelId === 'MAIN' || (!m.channelId && m.channel === 'MAIN'));
    for (const msg of mainChat) {
      entries.push({ kind: 'chat', key: `chat-${msg.id}`, timestamp: msg.timestamp, data: msg });
    }

    for (const t of tickerMessages) {
      entries.push({ kind: 'system', key: `sys-${t.id}`, timestamp: t.timestamp, data: t });
    }

    // Include completed cartridges as timeline entries
    for (const c of completedCartridges) {
      entries.push({
        kind: 'completed-cartridge',
        key: c.key,
        timestamp: c.completedAt,
        data: { kind: c.kind, snapshot: c.snapshot },
      });
    }

    // Sort chronologically
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Append active cartridges at the end (always last)
    if (activeVotingCartridge) {
      entries.push({ kind: 'voting', key: 'active-voting', timestamp: Number.MAX_SAFE_INTEGER });
    }
    if (activeGameCartridge) {
      entries.push({ kind: 'game', key: 'active-game', timestamp: Number.MAX_SAFE_INTEGER });
    }
    if (activePromptCartridge) {
      entries.push({ kind: 'prompt', key: 'active-prompt', timestamp: Number.MAX_SAFE_INTEGER });
    }

    return entries;
  }, [chatLog, tickerMessages, activeVotingCartridge, activeGameCartridge, activePromptCartridge, completedCartridges]);
}
