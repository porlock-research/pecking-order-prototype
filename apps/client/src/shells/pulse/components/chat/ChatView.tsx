import { useRef, useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { MessageCard } from './MessageCard';
import { BroadcastCard } from './BroadcastCard';
import { WhisperCard } from './WhisperCard';
import { TypingIndicator } from './TypingIndicator';
import { DayPhases, GAME_MASTER_ID } from '@pecking-order/shared-types';

export function ChatView() {
  const chatLog = useGameStore(s => s.chatLog);
  const phase = useGameStore(s => s.phase);
  const { playerId } = usePulse();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [openReactionId, setOpenReactionId] = useState<string | null>(null);

  // Filter to MAIN channel messages
  const mainMessages = chatLog.filter(
    m => m.channelId === 'MAIN' || (!m.channelId && m.channel === 'MAIN'),
  );

  // Auto-scroll on new messages
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mainMessages.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 80);
  }, []);

  const isSocialPhase = phase !== DayPhases.ELIMINATION && phase !== DayPhases.GAME_OVER;

  // Group consecutive messages from the same sender within 2 minutes
  const groupedMessages: Array<{ msg: any; showHeader: boolean }> = [];
  for (let i = 0; i < mainMessages.length; i++) {
    const msg = mainMessages[i];
    const prev = i > 0 ? mainMessages[i - 1] : null;
    const showHeader =
      !prev ||
      prev.senderId !== msg.senderId ||
      msg.timestamp - prev.timestamp > 120_000;
    groupedMessages.push({ msg, showHeader });
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

      {groupedMessages.map(({ msg, showHeader }) => {
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
