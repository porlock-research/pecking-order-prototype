import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { useTimeline } from '../../../hooks/useTimeline';
import { MessageCard } from './MessageCard';
import { BroadcastAlert } from './BroadcastAlert';
import { ChatInput } from './ChatInput';
import VotingPanel from '../../../components/panels/VotingPanel';
import GamePanel from '../../../components/panels/GamePanel';
import PromptPanel from '../../../components/panels/PromptPanel';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import type { ChatMessage } from '@pecking-order/shared-types';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';
import { AltArrowDown, Scale, Gamepad, ChatDots } from '@solar-icons/react';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function StageChat({ engine, playerColorMap, onTapAvatar }: StageChatProps) {
  const { playerId, roster } = useGameStore();
  const activeVotingCartridge = useGameStore(s => s.activeVotingCartridge);
  const activeGameCartridge = useGameStore(s => s.activeGameCartridge);
  const activePromptCartridge = useGameStore(s => s.activePromptCartridge);
  const entries = useTimeline();
  const chatLog = useGameStore(s => s.chatLog);
  const onlinePlayers = useGameStore(s => s.onlinePlayers);

  const onlineRosterPlayers = useMemo(() => {
    if (!onlinePlayers || onlinePlayers.length === 0) return [];
    return onlinePlayers
      .filter(id => id !== GAME_MASTER_ID && roster[id])
      .map(id => roster[id]);
  }, [onlinePlayers, roster]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cartridgeRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);

  /* -- Active cartridge state -------------------------------------- */

  const hasActiveCartridge = !!(activeVotingCartridge || activeGameCartridge || activePromptCartridge);

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

  const scrollToCartridge = useCallback(() => {
    cartridgeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const shouldShowTimestamp = (index: number): boolean => {
    const entry = entries[index];
    if (entry.kind !== 'chat') return true;
    if (index === entries.length - 1) return true;
    const next = entries[index + 1];
    if (next.kind !== 'chat') return true;
    if (next.data.senderId !== entry.data.senderId) return true;
    if (next.data.timestamp - entry.data.timestamp > 120000) return true;
    return false;
  };

  /* -- Reply handling ---------------------------------------------- */

  const handleTapReply = useCallback((message: ChatMessage) => {
    setReplyTarget(message);
  }, []);

  /* -- Return-to-action pill --------------------------------------- */

  const returnPillLabel = activeVotingCartridge
    ? 'Return to Vote'
    : activeGameCartridge
      ? 'Return to Game'
      : activePromptCartridge
        ? 'Return to Activity'
        : null;

  const ReturnPillIcon = activeVotingCartridge
    ? Scale
    : activeGameCartridge
      ? Gamepad
      : ChatDots;

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                size={34}
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
          {/* Empty state */}
          {entries.length === 0 && pendingOptimistic.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  background: 'var(--vivid-bg-elevated)',
                  border: '2px solid rgba(139, 115, 85, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--vivid-surface-shadow)',
                }}
              >
                <span
                  style={{
                    color: 'var(--vivid-text-dim)',
                    opacity: 0.5,
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  ...
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--vivid-font-display)',
                  color: 'var(--vivid-text-dim)',
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                The stage is set...
              </span>
            </div>
          )}

          {/* Timeline entries */}
          {entries.map((entry, i) => {
            const isGrouped = entry.kind === 'chat' && !shouldShowSender(i);
            const marginTop = i === 0 ? 0 : isGrouped ? 2 : 10;

            switch (entry.kind) {
              case 'chat':
                return (
                  <div key={entry.key} style={{ marginTop }}>
                    <MessageCard
                      message={entry.data}
                      isMe={entry.data.senderId === playerId}
                      sender={roster[entry.data.senderId]}
                      showSender={shouldShowSender(i)}
                      showTimestamp={shouldShowTimestamp(i)}
                      playerColor={playerColorMap[entry.data.senderId] || '#9B8E7E'}
                      onTapAvatar={onTapAvatar}
                      onTapReply={handleTapReply}
                    />
                  </div>
                );

              case 'system':
                return (
                  <div key={entry.key} style={{ marginTop }}>
                    <BroadcastAlert message={entry.data} />
                  </div>
                );

              case 'voting':
                return (
                  <div key={entry.key} ref={cartridgeRef} style={{ marginTop }}>
                    <VotingPanel engine={engine} />
                  </div>
                );

              case 'game':
                return (
                  <div key={entry.key} ref={cartridgeRef} style={{ marginTop }}>
                    <GamePanel engine={engine} />
                  </div>
                );

              case 'prompt':
                return (
                  <div key={entry.key} ref={cartridgeRef} style={{ marginTop }}>
                    <PromptPanel engine={engine} />
                  </div>
                );

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

        {/* Return-to-action pill */}
        <AnimatePresence>
          {hasActiveCartridge && userScrolledUp && returnPillLabel && (
            <motion.div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                padding: '12px 16px',
                background: 'rgba(253, 248, 240, 0.9)',
                borderTop: '1px solid rgba(139, 115, 85, 0.08)',
                zIndex: 10,
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={VIVID_SPRING.snappy}
            >
              <motion.button
                onClick={scrollToCartridge}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  borderRadius: 9999,
                  background: activeVotingCartridge
                    ? '#E89B3A'
                    : activeGameCartridge
                      ? '#3BA99C'
                      : '#8B6CC1',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: 13,
                  fontFamily: 'var(--vivid-font-display)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                  boxShadow: '0 3px 12px rgba(139, 115, 85, 0.2)',
                }}
                whileTap={VIVID_TAP.button}
                transition={VIVID_SPRING.bouncy}
              >
                <ReturnPillIcon size={16} weight="Bold" />
                {returnPillLabel}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Jump to latest pill (when no active cartridge pill) */}
        <AnimatePresence>
          {userScrolledUp && !hasActiveCartridge && (
            <motion.button
              onClick={scrollToBottom}
              style={{
                position: 'absolute',
                bottom: 12,
                left: '50%',
                transform: 'translateX(-50%)',
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
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
      />
    </div>
  );
}
