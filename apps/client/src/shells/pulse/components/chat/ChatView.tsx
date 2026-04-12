import { useRef, useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { MessageCard } from './MessageCard';
import { BroadcastCard } from './BroadcastCard';
import { WhisperCard } from './WhisperCard';
import { SilverTransferCard } from './SilverTransferCard';
import { TypingIndicator } from './TypingIndicator';
import { DayPhases, GAME_MASTER_ID, TickerCategories } from '@pecking-order/shared-types';
import type { TickerMessage } from '@pecking-order/shared-types';

export function ChatView() {
  const chatLog = useGameStore(s => s.chatLog);
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const phase = useGameStore(s => s.phase);
  const { playerId } = usePulse();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [openReactionId, setOpenReactionId] = useState<string | null>(null);

  // Filter to MAIN channel messages
  const mainMessages = chatLog.filter(
    m => m.channelId === 'MAIN' || (!m.channelId && m.channel === 'MAIN'),
  );

  // Social events from ticker that should render as inline broadcast cards
  // (silver transfers, nudges — these are facts, not chat messages)
  const socialEvents: TickerMessage[] = tickerMessages.filter(
    t => t.category === TickerCategories.SOCIAL_TRANSFER
      || t.category === TickerCategories.SOCIAL_PERK
      || t.category === TickerCategories.SOCIAL_NUDGE,
  );

  // Interleave messages and social events by timestamp
  type TimelineEntry =
    | { type: 'msg'; data: any; ts: number }
    | { type: 'social'; data: TickerMessage; ts: number };

  const timeline: TimelineEntry[] = [
    ...mainMessages.map(m => ({ type: 'msg' as const, data: m, ts: m.timestamp })),
    ...socialEvents.map(t => ({ type: 'social' as const, data: t, ts: t.timestamp })),
  ].sort((a, b) => a.ts - b.ts);

  // Auto-scroll on new entries
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [timeline.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 80);
  }, []);

  const isSocialPhase = phase !== DayPhases.ELIMINATION && phase !== DayPhases.GAME_OVER;

  // Group consecutive messages from the same sender within 2 minutes
  // (Only applies to message entries; social events break the grouping)
  const grouped: Array<{ entry: TimelineEntry; showHeader: boolean }> = [];
  for (let i = 0; i < timeline.length; i++) {
    const entry = timeline[i];
    const prev = i > 0 ? timeline[i - 1] : null;
    let showHeader = true;
    if (entry.type === 'msg' && prev?.type === 'msg') {
      showHeader =
        prev.data.senderId !== entry.data.senderId ||
        entry.data.timestamp - prev.data.timestamp > 120_000;
    }
    grouped.push({ entry, showHeader });
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        height: '100%',
      }}
    >
      {!isSocialPhase && (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--pulse-text-3)',
            fontSize: 12,
            padding: 16,
            fontStyle: 'italic',
          }}
        >
          Chat opens at dawn
        </div>
      )}

      {grouped.map(({ entry, showHeader }) => {
        // Social event from ticker (silver, nudge, perk) — inline broadcast card
        if (entry.type === 'social') {
          const t = entry.data;
          // Silver transfers get the richer avatar-based card
          if (t.category === TickerCategories.SOCIAL_TRANSFER) {
            return (
              <SilverTransferCard
                key={`social-${t.timestamp}-${t.text.slice(0, 20)}`}
                text={t.text}
                timestamp={t.timestamp}
              />
            );
          }
          // Other social events (nudge, perk) use the simpler broadcast card
          return (
            <BroadcastCard
              key={`social-${t.timestamp}-${t.text.slice(0, 20)}`}
              message={{
                id: `social-${t.timestamp}`,
                senderId: 'SYSTEM',
                timestamp: t.timestamp,
                content: t.text,
                channelId: 'MAIN',
              } as any}
            />
          );
        }

        const msg = entry.data;
        // Redacted whisper
        if (msg.whisperTarget && msg.redacted) {
          return <WhisperCard key={msg.id} message={msg} />;
        }

        // Broadcast event cards (system messages, GM briefings)
        if (msg.senderId === 'SYSTEM' || msg.senderId === 'GM' || msg.senderId === GAME_MASTER_ID) {
          return <BroadcastCard key={msg.id} message={msg} />;
        }

        return (
          <MessageCard
            key={msg.id}
            message={msg}
            showHeader={showHeader}
            isSelf={msg.senderId === playerId}
            openReactionId={openReactionId}
            onOpenReaction={setOpenReactionId}
          />
        );
      })}

      <TypingIndicator />

      {/* Jump to latest */}
      {!autoScroll && (
        <button
          onClick={() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              setAutoScroll(true);
            }
          }}
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 16px',
            borderRadius: 20,
            background: 'var(--pulse-accent)',
            color: '#fff',
            border: 'none',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--po-font-body)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 5,
          }}
        >
          Jump to latest
        </button>
      )}
    </div>
  );
}
