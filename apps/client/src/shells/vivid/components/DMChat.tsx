import { useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { AltArrowLeft, Crown } from '@solar-icons/react';
import { PlayerStatuses, GAME_MASTER_ID, Events, ChannelTypes } from '@pecking-order/shared-types';
import type { ChatMessage } from '@pecking-order/shared-types';
import { useGameStore, selectDmSlots } from '../../../store/useGameStore';
import { InviteOverlay } from './InviteOverlay';
import { usePlayerTimeline } from '../../../hooks/usePlayerTimeline';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { MessageCard } from './MessageCard';
import { BroadcastAlert } from './BroadcastAlert';
import { ChatInput } from './ChatInput';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface DMChatProps {
  mode: '1on1' | 'group';
  targetPlayerId?: string;
  channelId?: string;
  engine: any;
  onBack: () => void;
  onOpenSpotlight?: (playerId: string) => void;
  playerColorMap: Record<string, string>;
  onTapAvatar?: (playerId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Rejection labels                                                   */
/* ------------------------------------------------------------------ */

const REJECTION_LABELS: Record<string, string> = {
  DMS_CLOSED: 'DMs are currently closed',
  PARTNER_LIMIT: "You've reached your daily conversation limit",
  CHAR_LIMIT: 'Daily character limit reached',
  INSUFFICIENT_SILVER: 'Not enough silver',
  TARGET_ELIMINATED: 'This player has been eliminated',
  SELF_DM: 'Cannot message yourself',
  GROUP_CHAT_CLOSED: 'Group chat is currently closed',
  GROUP_LIMIT: "You've reached your daily group DM limit",
  INVALID_MEMBERS: 'Invalid group members',
};

/* ------------------------------------------------------------------ */
/*  DMChat                                                             */
/* ------------------------------------------------------------------ */

export function DMChat({
  mode,
  targetPlayerId,
  channelId,
  engine,
  onBack,
  onOpenSpotlight,
  playerColorMap,
  onTapAvatar,
}: DMChatProps) {
  const { playerId, roster } = useGameStore();
  const chatLog = useGameStore((s) => s.chatLog);
  const channels = useGameStore((s) => s.channels);
  const onlinePlayers = useGameStore((s) => s.onlinePlayers);
  const dmStats = useGameStore((s) => s.dmStats);
  const dmRejection = useGameStore((s) => s.dmRejection);
  const clearDmRejection = useGameStore((s) => s.clearDmRejection);
  const typingPlayers = useGameStore((s) => s.typingPlayers);
  const dmSlots = useGameStore(useShallow(selectDmSlots));

  const scrollRef = useRef<HTMLDivElement>(null);

  /* ---- Derived: 1:1 mode ----------------------------------------- */
  const target = targetPlayerId ? roster[targetPlayerId] : null;
  const isOnline = targetPlayerId ? onlinePlayers.includes(targetPlayerId) : false;
  const isEliminated = target?.status === PlayerStatuses.ELIMINATED;
  const isGameMaster = targetPlayerId === GAME_MASTER_ID;
  const isMe = targetPlayerId === playerId;

  /* ---- Derived: group mode --------------------------------------- */
  const channel = channelId ? channels[channelId] : null;

  const otherMemberIds = useMemo(() => {
    if (!channel || !playerId) return [];
    return channel.memberIds.filter((id) => id !== playerId);
  }, [channel, playerId]);

  const memberNames = useMemo(
    () => otherMemberIds.map((id) => roster[id]?.personaName || 'Unknown').join(', '),
    [otherMemberIds, roster],
  );

  /* ---- Derived: DM channel lookup (1:1 mode) ----------------------- */
  const dmChannel = useMemo(() => {
    if (mode !== '1on1') return null;
    if (channelId) return channels[channelId] ?? null;
    if (!playerId || !targetPlayerId) return null;
    return Object.values(channels).find(ch =>
      ch.type === ChannelTypes.DM &&
      (ch.memberIds.includes(playerId) || (ch.pendingMemberIds || []).includes(playerId)) &&
      (ch.memberIds.includes(targetPlayerId) || (ch.pendingMemberIds || []).includes(targetPlayerId))
    ) ?? null;
  }, [channels, channelId, playerId, targetPlayerId, mode]);

  const dmChannelId = dmChannel?.id ?? channelId ?? null;

  /* ---- Derived: pending invite (locked conversation) --------------- */
  const isPendingDm = !!(playerId && dmChannel && (dmChannel.pendingMemberIds || []).includes(playerId));
  const isPendingGroup = !!(playerId && channel && (channel.pendingMemberIds || []).includes(playerId));
  const isLockedInvite = isPendingDm || isPendingGroup;
  const pendingChannel = isPendingDm ? dmChannel : isPendingGroup ? channel : null;

  /* ---- Derived: DM stats ----------------------------------------- */
  const charsRemaining = dmStats ? Math.max(0, dmStats.charsLimit - dmStats.charsUsed) : 0;
  const charsLimit = dmStats?.charsLimit ?? 1200;

  /* ---- Entries ---------------------------------------------------- */
  const playerTimelineEntries = usePlayerTimeline(targetPlayerId ?? '');

  const groupMessages = useMemo(() => {
    if (mode !== 'group' || !channelId) return [];
    return chatLog
      .filter((m: ChatMessage) => m.channelId === channelId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [chatLog, channelId, mode]);

  /* ---- Typing (group mode) --------------------------------------- */
  const groupTypingNames = useMemo(() => {
    if (mode !== 'group' || !channel || !playerId) return [];
    return channel.memberIds
      .filter((id) => id !== playerId && typingPlayers[id] === channelId)
      .map((id) => roster[id]?.personaName || 'Someone');
  }, [mode, channel, playerId, typingPlayers, roster, channelId]);

  const groupFirstTyper = useMemo(() => {
    if (mode !== 'group' || !channel || !playerId) return null;
    const id = channel.memberIds.find(
      (id) => id !== playerId && typingPlayers[id] === channelId,
    );
    return id ? roster[id] : null;
  }, [mode, channel, playerId, typingPlayers, roster, channelId]);

  /* ---- 1:1 typing ------------------------------------------------ */
  const dmTyperName = useMemo(() => {
    if (mode !== '1on1' || !targetPlayerId) return null;
    if (typingPlayers[targetPlayerId] && targetPlayerId !== playerId) {
      return target?.personaName || 'Someone';
    }
    return null;
  }, [mode, targetPlayerId, typingPlayers, playerId, target]);

  /* ---- Auto-scroll ----------------------------------------------- */
  const entryCount =
    mode === '1on1' ? playerTimelineEntries.length : groupMessages.length;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entryCount]);

  /* ---- DM rejection toast ---------------------------------------- */
  useEffect(() => {
    if (!dmRejection) return;
    toast.error(REJECTION_LABELS[dmRejection.reason] || dmRejection.reason);
    clearDmRejection();
  }, [dmRejection, clearDmRejection]);

  /* ---- shouldShowSender helpers ---------------------------------- */
  const shouldShowSender1on1 = (index: number): boolean => {
    const entry = playerTimelineEntries[index];
    if (entry.kind !== 'chat') return true;
    if (index === 0) return true;
    const prev = playerTimelineEntries[index - 1];
    if (prev.kind !== 'chat') return true;
    return prev.data.senderId !== entry.data.senderId;
  };

  const shouldShowSenderGroup = (index: number): boolean => {
    if (index === 0) return true;
    return groupMessages[index - 1].senderId !== groupMessages[index].senderId;
  };

  const shouldShowTimestamp1on1 = (index: number): boolean => {
    const entry = playerTimelineEntries[index];
    if (entry.kind !== 'chat') return true;
    const next = playerTimelineEntries[index + 1];
    if (!next || next.kind !== 'chat') return true;
    return next.data.senderId !== entry.data.senderId;
  };

  const shouldShowTimestampGroup = (index: number): boolean => {
    const next = groupMessages[index + 1];
    if (!next) return true;
    return next.senderId !== groupMessages[index].senderId;
  };

  /* ---- Input visibility ------------------------------------------ */
  const hideInput = isMe || isGameMaster || isLockedInvite;

  /* ---- Header tap ------------------------------------------------ */
  const handleHeaderTap = () => {
    if (mode === '1on1' && targetPlayerId && onOpenSpotlight) {
      onOpenSpotlight(targetPlayerId);
    }
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--vivid-bg-deep)',
      }}
      initial={{ opacity: 0, x: '30%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '30%' }}
      transition={VIVID_SPRING.page}
    >
      {/* ---- Header ------------------------------------------------ */}
      <header
        style={{
          flexShrink: 0,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          background: 'var(--vivid-bg-surface)',
          borderBottom: '2px solid rgba(139, 115, 85, 0.06)',
        }}
      >
        {/* Back button */}
        <motion.button
          onClick={onBack}
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: 12,
            background: '#FFFFFF',
            border: '1px solid rgba(139, 115, 85, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--vivid-text)',
            cursor: 'pointer',
            boxShadow: 'var(--vivid-surface-shadow)',
          }}
          whileTap={VIVID_TAP.button}
          transition={VIVID_SPRING.bouncy}
        >
          <AltArrowLeft size={22} weight="Bold" />
        </motion.button>

        {/* Avatar + info — tappable for 1:1 */}
        <div
          onClick={handleHeaderTap}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 0,
            cursor: mode === '1on1' && onOpenSpotlight ? 'pointer' : 'default',
          }}
        >
          {/* Avatar section */}
          {mode === '1on1' ? (
            /* 1:1 avatar */
            isGameMaster ? (
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(212, 150, 10, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Crown size={22} weight="BoldDuotone" style={{ color: '#D4960A' }} />
              </div>
            ) : (
              <PersonaAvatar
                avatarUrl={target?.avatarUrl}
                personaName={target?.personaName}
                size={44}
                eliminated={isEliminated}
                isOnline={isOnline}
              />
            )
          ) : (
            /* Group avatar cluster */
            <div style={{ position: 'relative', width: 52, height: 44, flexShrink: 0 }}>
              {otherMemberIds.slice(0, 3).map((id, idx) => {
                const p = roster[id];
                return (
                  <div
                    key={id}
                    style={{
                      position: 'absolute',
                      top: idx * 4,
                      left: idx * 14,
                      zIndex: 3 - idx,
                    }}
                  >
                    <PersonaAvatar
                      avatarUrl={p?.avatarUrl}
                      personaName={p?.personaName}
                      size={36}
                      className="ring-2 ring-[var(--vivid-bg-surface)]"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Name + status */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                fontSize: 16,
                color: isGameMaster ? '#D4960A' : 'var(--vivid-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {mode === '1on1'
                ? isGameMaster
                  ? 'Game Master'
                  : target?.personaName ?? 'Unknown'
                : memberNames || 'Group'}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 2,
              }}
            >
              {mode === '1on1' ? (
                isGameMaster ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--vivid-font-body)',
                      color: 'var(--vivid-text-dim)',
                    }}
                  >
                    System
                  </span>
                ) : (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontFamily: 'var(--vivid-font-body)',
                      color: isOnline ? '#3BA99C' : 'var(--vivid-text-dim)',
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: isOnline ? '#3BA99C' : 'var(--vivid-text-dim)',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    {isOnline ? 'online' : 'offline'}
                  </span>
                )
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--vivid-font-body)',
                    color: 'var(--vivid-text-dim)',
                  }}
                >
                  {channel?.memberIds.length ?? 0} members
                </span>
              )}
            </div>
          </div>
        </div>

        {/* DM stats */}
        {!isMe && !isGameMaster && (
          <span
            style={{
              flexShrink: 0,
              fontSize: 11,
              fontFamily: 'var(--vivid-font-mono)',
              color: 'var(--vivid-text-dim)',
              background: 'var(--vivid-bg-elevated)',
              padding: '2px 8px',
              borderRadius: 8,
            }}
          >
            {charsRemaining}/{charsLimit}
          </span>
        )}
      </header>

      {/* ---- Messages area + invite overlay container --------------- */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div
          ref={scrollRef}
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            ...(isLockedInvite ? { filter: 'blur(6px)', pointerEvents: 'none' as const } : {}),
          }}
        >
          {mode === '1on1' ? (
            /* ---- 1:1 messages ---- */
            playerTimelineEntries.length === 0 ? (
              <EmptyState
                text={
                  isMe
                    ? 'Your profile'
                    : isGameMaster
                      ? 'No messages from the Game Master yet.'
                      : 'No whispers exchanged yet. Start scheming?'
                }
              />
            ) : (
              playerTimelineEntries.map((entry, i) => {
                switch (entry.kind) {
                  case 'chat':
                    return (
                      <MessageCard
                        key={entry.key}
                        message={entry.data}
                        isMe={entry.data.senderId === playerId}
                        sender={roster[entry.data.senderId]}
                        showSender={shouldShowSender1on1(i)}
                        showTimestamp={shouldShowTimestamp1on1(i)}
                        playerColor={playerColorMap[entry.data.senderId] || '#9B8E7E'}
                        onTapAvatar={onTapAvatar}
                      />
                    );
                  case 'system':
                    return <BroadcastAlert key={entry.key} message={entry.data} />;
                  default:
                    return null;
                }
              })
            )
          ) : (
            /* ---- Group messages ---- */
            groupMessages.length === 0 ? (
              <EmptyState text="No messages yet. Start scheming?" />
            ) : (
              groupMessages.map((msg, i) => (
                <MessageCard
                  key={msg.id}
                  message={msg}
                  isMe={msg.senderId === playerId}
                  sender={roster[msg.senderId]}
                  showSender={shouldShowSenderGroup(i)}
                  showTimestamp={shouldShowTimestampGroup(i)}
                  playerColor={playerColorMap[msg.senderId] || '#9B8E7E'}
                  onTapAvatar={onTapAvatar}
                />
              ))
            )
          )}
        </div>

        {/* Invite overlay — positioned over messages */}
        <AnimatePresence>
          {isLockedInvite && pendingChannel && (
            <InviteOverlay
              channel={pendingChannel}
              firstMessage={chatLog.find(m => m.channelId === pendingChannel.id)?.content}
              roster={roster}
              slotsRemaining={dmSlots.total - dmSlots.used}
              slotsTotal={dmSlots.total}
              onAccept={() => {
                const chId = pendingChannel.id;
                engine.socket.send(JSON.stringify({
                  type: Events.Social.ACCEPT_DM,
                  channelId: chId,
                }));
              }}
              onDecline={() => {
                const chId = pendingChannel.id;
                engine.socket.send(JSON.stringify({
                  type: Events.Social.DECLINE_DM,
                  channelId: chId,
                }));
                onBack();
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ---- Typing indicator (above input) ----------------------- */}
      <AnimatePresence>
        {mode === '1on1' && dmTyperName && (
          <TypingBar name={dmTyperName} avatar={target} />
        )}
        {mode === 'group' && groupTypingNames.length > 0 && (
          <TypingBar
            name={
              groupTypingNames.length === 1
                ? groupTypingNames[0]
                : `${groupTypingNames.join(', ')}`
            }
            avatar={groupFirstTyper}
          />
        )}
      </AnimatePresence>

      {/* ---- Input ------------------------------------------------- */}
      {!hideInput && (
        <ChatInput
          engine={engine}
          context={mode === '1on1' ? 'dm' : 'group'}
          targetId={mode === '1on1' ? targetPlayerId : channelId}
          targetName={
            mode === '1on1'
              ? target?.personaName ?? 'them'
              : 'the group'
          }
          channelId={mode === '1on1' ? (dmChannelId ?? undefined) : channelId}
        />
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        paddingBottom: 80,
        gap: 12,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'var(--vivid-bg-elevated)',
          border: '2px solid rgba(139, 115, 85, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'var(--vivid-surface-shadow)',
        }}
      >
        <span
          style={{
            color: 'var(--vivid-text-dim)',
            opacity: 0.4,
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          ...
        </span>
      </div>
      <span
        style={{
          fontSize: 16,
          fontFamily: 'var(--vivid-font-display)',
          color: 'var(--vivid-text-dim)',
          fontStyle: 'italic',
          fontWeight: 600,
          textAlign: 'center',
          maxWidth: 260,
        }}
      >
        {text}
      </span>
    </div>
  );
}

function TypingBar({
  name,
  avatar,
}: {
  name: string;
  avatar: { avatarUrl?: string; personaName?: string } | null | undefined;
}) {
  return (
    <motion.div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 16px 6px',
      }}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <PersonaAvatar
        avatarUrl={avatar?.avatarUrl}
        personaName={avatar?.personaName}
        size={24}
        isOnline
      />
      <span
        style={{
          fontSize: 11,
          fontFamily: 'var(--vivid-font-body)',
          color: 'var(--vivid-text-dim)',
        }}
      >
        {name} is scheming...
      </span>
      <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <TypingDot delay={0} />
        <TypingDot delay={0.15} />
        <TypingDot delay={0.3} />
      </span>
    </motion.div>
  );
}

function TypingDot({ delay }: { delay: number }) {
  return (
    <motion.span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'var(--vivid-text-dim)',
        display: 'inline-block',
      }}
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 0.6, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}
