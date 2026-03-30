import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { useTimeline } from '../../../hooks/useTimeline';
import { MessageCard } from './MessageCard';
import { ChatInput } from './ChatInput';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import type { ChatMessage } from '@pecking-order/shared-types';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';
import { AltArrowDown, Crown } from '@solar-icons/react';
import { WELCOME_MESSAGES } from '@pecking-order/shared-types';
import { VIVID_SPRING, VIVID_TAP } from '../springs';
import { CompactProgressBar } from './dashboard/CompactProgressBar';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StageChatProps {
  engine: any;
  playerColorMap: Record<string, string>;
  onTapAvatar?: (playerId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SCROLL_THRESHOLD = 100;

function formatTimeSeparator(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'JUST NOW';
  // Always use absolute clock time — broadcast-style timestamps
  if (diff < 86400_000) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ------------------------------------------------------------------ */
/*  Pregame empty state — welcome + gameplay overview                   */
/* ------------------------------------------------------------------ */

function GmBubble({ text, delay }: { text: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        padding: '10px 14px',
        borderRadius: '4px 16px 16px 16px',
        background: 'rgba(212, 150, 10, 0.08)',
        border: '1px solid rgba(212, 150, 10, 0.15)',
        maxWidth: '85%',
      }}
    >
      <span style={{
        fontFamily: 'var(--vivid-font-body)',
        fontSize: 14,
        fontWeight: 500,
        color: '#3D2E1F',
        lineHeight: 1.5,
      }}>
        {text}
      </span>
    </motion.div>
  );
}

function PregameEmptyState() {
  const dayIndex = useGameStore(s => s.dayIndex);

  if (dayIndex > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--vivid-bg-elevated)', border: '2px solid rgba(139, 115, 85, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--vivid-surface-shadow)' }}>
          <span style={{ color: 'var(--vivid-text-dim)', opacity: 0.5, fontFamily: 'var(--vivid-font-display)', fontSize: 22, fontWeight: 700 }}>...</span>
        </div>
        <span style={{ fontFamily: 'var(--vivid-font-display)', color: 'var(--vivid-text-dim)', fontSize: 15, fontWeight: 600 }}>The stage is set...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
      {/* GM sender header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(212, 150, 10, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Crown size={14} weight="Bold" color="#D4960A" />
        </div>
        <span style={{
          fontFamily: 'var(--vivid-font-display)', fontSize: 12, fontWeight: 700,
          color: '#D4960A', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          Game Master
        </span>
      </div>
      {/* GM welcome messages */}
      {WELCOME_MESSAGES.map((msg, i) => (
        <GmBubble key={i} text={msg} delay={i * 0.12} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StageChat({ engine, playerColorMap, onTapAvatar }: StageChatProps) {
  const playerId = useGameStore(s => s.playerId);
  const roster = useGameStore(s => s.roster);
  const entries = useTimeline();
  const chatLog = useGameStore(s => s.chatLog);
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const channels = useGameStore(s => s.channels);
  const mainChannelHints = channels?.['MAIN']?.hints;

  const onlineRosterPlayers = useMemo(() => {
    if (!onlinePlayers || onlinePlayers.length === 0) return [];
    return onlinePlayers
      .filter(id => id !== GAME_MASTER_ID && roster[id])
      .map(id => roster[id]);
  }, [onlinePlayers, roster]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);

  /* -- Scroll management ------------------------------------------- */

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distanceFromBottom > SCROLL_THRESHOLD);
  }, []);

  useEffect(() => {
    if (!userScrolledUp && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, optimisticMessages, userScrolledUp]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUserScrolledUp(false);
  }, []);

  /* -- Optimistic messages ----------------------------------------- */

  const handleOptimisticSend = useCallback((content: string) => {
    if (!playerId) return;
    const optimisticMsg: ChatMessage = {
      id: `opt-${Date.now()}`,
      senderId: playerId,
      timestamp: Date.now(),
      content,
      channelId: 'MAIN',
      channel: 'MAIN',
    };
    setOptimisticMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => {
      setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
    }, 5000);
  }, [playerId]);

  const pendingOptimistic = optimisticMessages.filter(opt =>
    !chatLog.some(m =>
      m.senderId === opt.senderId &&
      m.content === opt.content &&
      Math.abs(m.timestamp - opt.timestamp) < 2000
    )
  );

  /* -- Message grouping -------------------------------------------- */

  const TIME_GAP_MS = 5 * 60 * 1000; // 5 min gap triggers a time separator

  const shouldShowSender = (index: number): boolean => {
    const entry = entries[index];
    if (entry.kind !== 'chat') return true;
    if (index === 0) return true;
    const prev = entries[index - 1];
    if (prev.kind !== 'chat') return true;
    if (prev.data.senderId !== entry.data.senderId) return true;
    if (entry.data.timestamp - prev.data.timestamp > 120000) return true;
    return false;
  };

  const shouldShowTimeSeparator = (index: number): boolean => {
    const entry = entries[index];
    if (entry.kind !== 'chat') return false;
    if (index === 0) return true; // Always show time for first message
    const prev = entries[index - 1];
    if (prev.kind !== 'chat') return true;
    return entry.data.timestamp - prev.data.timestamp > TIME_GAP_MS;
  };

  /* -- Reply handling ---------------------------------------------- */

  const handleTapReply = useCallback((message: ChatMessage) => {
    setReplyTarget(message);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Day progress bar — persistent */}
      <div style={{
        flexShrink: 0,
        borderBottom: '1px solid rgba(139, 115, 85, 0.06)',
        background: 'var(--vivid-bg-surface)',
      }}>
        <CompactProgressBar variant="slim" />
      </div>

      {/* Online presence strip */}
      {onlineRosterPlayers.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderBottom: '1px solid rgba(139, 115, 85, 0.06)',
            background: 'var(--vivid-bg-surface)',
            flexShrink: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
          }}
          className="vivid-hide-scrollbar"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              flexShrink: 0,
              marginRight: 2,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#4ade80',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                fontFamily: 'var(--vivid-font-display)',
                color: 'var(--vivid-text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {onlineRosterPlayers.length} online
            </span>
          </div>
          {onlineRosterPlayers.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...VIVID_SPRING.bouncy, delay: 0.04 * i }}
              onClick={() => onTapAvatar?.(p.id)}
              style={{ cursor: onTapAvatar ? 'pointer' : undefined, flexShrink: 0, position: 'relative' }}
            >
              <PersonaAvatar
                avatarUrl={p.avatarUrl}
                personaName={p.personaName}
                size={48}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#4ade80',
                  border: '2px solid var(--vivid-bg-surface)',
                }}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Scrollable timeline area */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 16,
            paddingBottom: 16,
            scrollBehavior: 'smooth',
          }}
        >
          {/* Empty state — welcome overview on Day 0, placeholder otherwise */}
          {entries.length === 0 && pendingOptimistic.length === 0 && (
            <PregameEmptyState />
          )}

          {/* Timeline entries */}
          {entries.map((entry, i) => {
            const isGrouped = entry.kind === 'chat' && !shouldShowSender(i);
            const marginTop = i === 0 ? 0 : isGrouped ? 2 : 10;
            const showTimeSep = entry.kind === 'chat' && shouldShowTimeSeparator(i);

            switch (entry.kind) {
              case 'chat':
                return (
                  <div key={entry.key} style={{ marginTop }}>
                    {showTimeSep && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '8px 0 12px',
                        }}
                      >
                        <div style={{ flex: 1, height: 1, background: 'rgba(139, 115, 85, 0.1)' }} />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            fontFamily: 'var(--vivid-font-display)',
                            color: 'var(--vivid-text-dim)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            flexShrink: 0,
                          }}
                        >
                          {formatTimeSeparator(entry.data.timestamp)}
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'rgba(139, 115, 85, 0.1)' }} />
                      </div>
                    )}
                    <MessageCard
                      message={entry.data}
                      isMe={entry.data.senderId === playerId}
                      sender={roster[entry.data.senderId]}
                      showSender={shouldShowSender(i)}
                      showTimestamp={false}
                      playerColor={playerColorMap[entry.data.senderId] || '#9B8E7E'}
                      onTapAvatar={onTapAvatar}
                      onTapReply={handleTapReply}
                    />
                  </div>
                );

              case 'system':
                return (
                  <div key={entry.key} style={{
                    textAlign: 'center',
                    padding: '8px 16px',
                    marginTop,
                  }}>
                    <span style={{
                      fontSize: 11,
                      fontFamily: 'var(--vivid-font-mono)',
                      color: 'rgba(255,255,255,0.35)',
                      letterSpacing: '0.03em',
                    }}>
                      {entry.data.text}
                    </span>
                  </div>
                );

              default:
                return null;
            }
          })}

          {/* Pending optimistic messages */}
          {pendingOptimistic.map(msg => (
            <div key={msg.id} style={{ marginTop: 2 }}>
              <MessageCard
                message={msg}
                isMe={true}
                sender={playerId ? roster[playerId] : undefined}
                showSender={false}
                isOptimistic
                playerColor={playerColorMap[msg.senderId] || '#9B8E7E'}
              />
            </div>
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Jump to latest pill */}
        <AnimatePresence>
          {userScrolledUp && (
            <motion.button
              onClick={scrollToBottom}
              style={{
                position: 'absolute',
                bottom: 12,
                left: '50%',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 9999,
                background: '#FFFFFF',
                border: '1px solid rgba(139, 115, 85, 0.12)',
                color: 'var(--vivid-coral)',
                fontSize: 12,
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 3px 12px rgba(139, 115, 85, 0.12)',
                zIndex: 10,
              }}
              initial={{ opacity: 0, y: 8, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 8, x: '-50%' }}
              transition={VIVID_SPRING.snappy}
              whileTap={VIVID_TAP.button}
            >
              <AltArrowDown size={12} weight="Bold" />
              Jump to latest
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Chat input pinned at bottom */}
      <ChatInput
        engine={engine}
        context="main"
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
        capabilities={['CHAT', 'REACTIONS']}
        hints={mainChannelHints}
      />
    </div>
  );
}
