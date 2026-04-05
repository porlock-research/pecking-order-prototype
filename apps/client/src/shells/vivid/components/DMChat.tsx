import { useRef, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';
import { AltArrowLeft, Crown } from '@solar-icons/react';
import { PlayerStatuses, GAME_MASTER_ID, Events, ChannelTypes } from '@pecking-order/shared-types';
import type { ChatMessage, SocialPlayer } from '@pecking-order/shared-types';
import { useGameStore, selectDmSlots } from '../../../store/useGameStore';
import { usePlayerTimeline } from '../../../hooks/usePlayerTimeline';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { resolveAvatarUrl, resolvePersonaVariant } from '../../../utils/personaImage';
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
  const playerId = useGameStore(s => s.playerId);
  const roster = useGameStore(s => s.roster);
  const chatLog = useGameStore((s) => s.chatLog);
  const channels = useGameStore((s) => s.channels);
  const onlinePlayers = useGameStore((s) => s.onlinePlayers);
  const dmStats = useGameStore((s) => s.dmStats);
  const dmRejection = useGameStore((s) => s.dmRejection);
  const clearDmRejection = useGameStore((s) => s.clearDmRejection);
  const typingPlayers = useGameStore((s) => s.typingPlayers);
  const dmSlots = useGameStore(useShallow(selectDmSlots));

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'auto' });
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
  const hideInput = isMe || isGameMaster;

  /* ---- Channel capabilities for ChatInput ------------------------- */
  const resolvedChannelId = mode === '1on1' ? (dmChannelId ?? channelId) : channelId;
  const resolvedChannel = resolvedChannelId ? channels[resolvedChannelId] : undefined;
  const channelCapabilities = resolvedChannel?.capabilities;
  const channelMemberIds = useMemo(() => [
    ...(resolvedChannel?.memberIds ?? []),
    ...(resolvedChannel?.pendingMemberIds ?? []),
  ], [resolvedChannel?.memberIds, resolvedChannel?.pendingMemberIds]);

  /* ---- Background: all member images ------------------------------ */
  const allMemberIds = useMemo(() => {
    if (mode === '1on1') {
      return [playerId, targetPlayerId].filter(Boolean) as string[];
    }
    // Include both accepted and pending members for backdrop
    return [...(channel?.memberIds ?? []), ...(channel?.pendingMemberIds ?? [])];
  }, [mode, playerId, targetPlayerId, channel?.memberIds, channel?.pendingMemberIds]);

  const primaryAccentColor = useMemo(() => {
    if (mode === '1on1' && targetPlayerId) {
      return playerColorMap[targetPlayerId] ?? '#8B7355';
    }
    const firstOther = otherMemberIds[0];
    return firstOther ? playerColorMap[firstOther] ?? '#8B7355' : '#8B7355';
  }, [mode, targetPlayerId, otherMemberIds, playerColorMap]);

  const showPersonaBackdrop = !isGameMaster && !isMe;

  /* ---- Header tap ------------------------------------------------ */
  const handleHeaderTap = () => {
    if (mode === '1on1' && targetPlayerId && onOpenSpotlight) {
      onOpenSpotlight(targetPlayerId);
    }
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  /* Dark theme CSS var overrides — scoped to messages area only (not ChatInput) */
  const darkMessageVars = {
    '--vivid-bg-surface': 'rgba(26, 20, 16, 0.7)',
    '--vivid-bg-elevated': 'rgba(40, 30, 22, 0.7)',
    '--vivid-bubble-self': 'rgba(107, 158, 110, 0.22)',
    '--vivid-bubble-other': 'rgba(255, 255, 255, 0.1)',
    '--vivid-bubble-gm': 'rgba(212, 150, 10, 0.15)',
    '--vivid-text': '#FAF3E8',
    '--vivid-text-dim': 'rgba(250, 243, 232, 0.5)',
    '--vivid-surface-shadow': '0 2px 8px rgba(0,0,0,0.3)',
  } as React.CSSProperties;

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        background: '#1A1410',
        overflow: 'hidden',
        height: '100dvh',
      }}
      initial={{ opacity: 0, x: '30%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '30%' }}
      transition={VIVID_SPRING.page}
    >
      {/* ---- Full-body persona background (PlayerDetail style) ---- */}
      {showPersonaBackdrop && (
        <PersonaBackdrop
          memberIds={allMemberIds}
          roster={roster}
          accentColor={primaryAccentColor}
        />
      )}

      {/* ---- Compact glass header -------------------------------- */}
      <header
        style={{
          flexShrink: 0,
          position: 'relative',
          zIndex: 10,
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: 'rgba(26, 20, 16, 0.5)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        {/* Back button */}
        <motion.button
          onClick={onBack}
          style={{
            flexShrink: 0,
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FAF3E8',
            cursor: 'pointer',
          }}
          whileTap={VIVID_TAP.button}
          transition={VIVID_SPRING.bouncy}
        >
          <AltArrowLeft size={20} weight="Bold" />
        </motion.button>

        {/* Avatar(s) + info */}
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
          {mode === '1on1' && isGameMaster ? (
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(212, 150, 10, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Crown size={22} weight="BoldDuotone" style={{ color: '#D4960A' }} />
            </div>
          ) : mode === '1on1' && target ? (
            <PersonaAvatar
              avatarUrl={target.avatarUrl}
              personaName={target.personaName}
              size={48}
              eliminated={isEliminated}
              isOnline={isOnline}
            />
          ) : (
            /* Group: stacked avatars */
            <div style={{ position: 'relative', width: 56, height: 44, flexShrink: 0 }}>
              {otherMemberIds.slice(0, 3).map((id, idx) => {
                const p = roster[id];
                return (
                  <div
                    key={id}
                    style={{
                      position: 'absolute',
                      top: idx * 3,
                      left: idx * 16,
                      zIndex: 3 - idx,
                    }}
                  >
                    <PersonaAvatar
                      avatarUrl={p?.avatarUrl}
                      personaName={p?.personaName}
                      size={38}
                      className="ring-2 ring-black/20"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Name + subtitle */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--vivid-font-display)',
              fontWeight: 700,
              fontSize: 17,
              color: isGameMaster ? '#D4960A' : '#FAF3E8',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {mode === '1on1'
                ? (isGameMaster ? 'Game Master' : target?.personaName ?? 'Unknown')
                : (memberNames || 'Group')}
            </div>
            <div style={{
              fontSize: 11,
              fontFamily: 'var(--vivid-font-body)',
              color: 'rgba(250, 243, 232, 0.5)',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {mode === '1on1'
                ? (isGameMaster ? 'System' : target?.bio ?? '')
                : `${channel?.memberIds.length ?? 0} members`}
            </div>
          </div>
        </div>

        {/* Online badge (1-on-1 only, non-GM) */}
        {mode === '1on1' && !isGameMaster && isOnline && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: 9999,
            background: 'rgba(74, 222, 128, 0.1)',
            border: '1px solid rgba(74, 222, 128, 0.2)',
          }}>
            <motion.div
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
            <span style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 10,
              fontWeight: 700,
              color: '#4ade80',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>Online</span>
          </div>
        )}
      </header>

      {/* ---- Messages area (dark-themed via CSS var overrides) ------- */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 5, overflow: 'hidden', ...darkMessageVars }}>
        <div
          ref={scrollRef}
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {mode === '1on1' ? (
            /* ---- 1:1 messages ---- */
            playerTimelineEntries.length === 0 ? (
              <EmptyState
                text={
                  isMe ? 'Your profile'
                    : isGameMaster ? 'No messages from the Game Master yet.'
                    : 'Start scheming...'
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
                        showTimestamp={false}
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
                  showTimestamp={false}
                  playerColor={playerColorMap[msg.senderId] || '#9B8E7E'}
                  onTapAvatar={onTapAvatar}
                />
              ))
            )
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ---- Typing indicator + Input (above backdrop) ------------- */}
      <div style={{ position: 'relative', zIndex: 5, flexShrink: 0 }}>
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

      {/* ---- Input / Invite bar ------------------------------------- */}
      {!hideInput && (
        isLockedInvite && pendingChannel ? (
          <InviteInputBar
            channel={pendingChannel}
            slotsRemaining={dmSlots.total - dmSlots.used}
            slotsTotal={dmSlots.total}
            onAccept={() => {
              engine.socket.send(JSON.stringify({
                type: Events.Social.ACCEPT_DM,
                channelId: pendingChannel.id,
              }));
            }}
            onDecline={() => {
              engine.socket.send(JSON.stringify({
                type: Events.Social.DECLINE_DM,
                channelId: pendingChannel.id,
              }));
              onBack();
            }}
          />
        ) : (
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
            capabilities={channelCapabilities}
            channelMemberIds={channelMemberIds}
            hints={resolvedChannel?.hints}
          />
        )
      )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Invite input bar (replaces chat input for pending invites)         */
/* ------------------------------------------------------------------ */

function InviteInputBar({
  channel,
  slotsRemaining,
  slotsTotal,
  onAccept,
  onDecline,
}: {
  channel: { id: string; createdBy?: string };
  slotsRemaining: number;
  slotsTotal: number;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        background: 'var(--vivid-bg-surface)',
        borderTop: '1px solid rgba(139, 115, 85, 0.08)',
        padding: '12px 16px 16px',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontFamily: 'var(--vivid-font-body)',
          color: 'var(--vivid-text-dim)',
          textAlign: 'center',
          marginBottom: 10,
        }}
      >
        You can start {slotsRemaining} more {slotsRemaining === 1 ? 'conversation' : 'conversations'} today
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <motion.button
          onClick={onDecline}
          style={{
            flex: 1,
            padding: '14px 0',
            borderRadius: 14,
            background: 'var(--vivid-bg-elevated)',
            border: '1.5px solid rgba(139, 115, 85, 0.12)',
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 700,
            fontSize: 15,
            color: '#B0736A',
            cursor: 'pointer',
          }}
          whileTap={VIVID_TAP.button}
          transition={VIVID_SPRING.bouncy}
        >
          Decline
        </motion.button>
        <motion.button
          onClick={onAccept}
          style={{
            flex: 1,
            padding: '14px 0',
            borderRadius: 14,
            background: '#3BA99C',
            border: 'none',
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 700,
            fontSize: 15,
            color: '#FFFFFF',
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(59, 169, 156, 0.25)',
          }}
          whileTap={VIVID_TAP.button}
          transition={VIVID_SPRING.bouncy}
        >
          Accept
        </motion.button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PersonaBackdrop({
  memberIds,
  roster,
  accentColor,
}: {
  memberIds: string[];
  roster: Record<string, SocialPlayer>;
  accentColor: string;
}) {
  const images = useMemo(() => {
    return memberIds
      .filter(id => id !== GAME_MASTER_ID)
      .map(id => {
        const p = roster[id];
        if (!p) return null;
        const url = resolvePersonaVariant(p.avatarUrl, 'full');
        return url ? { id, url } : null;
      })
      .filter(Boolean) as { id: string; url: string }[];
  }, [memberIds, roster]);

  if (images.length === 0) return null;

  // Each image gets an equal horizontal slice, with overlap for blending
  const overlap = 10; // percent of viewport to overlap for feathering
  const sliceHeight = 100 / images.length;

  return (
    <>
      {/* Persona images — horizontal slices with gradient-feathered edges */}
      {images.map((img, i) => {
        const isFirst = i === 0;
        const isLast = i === images.length - 1;
        // Extend each slice by the overlap amount for smooth blending
        const top = Math.max(0, i * sliceHeight - (isFirst ? 0 : overlap / 2));
        const bottom = Math.min(100, (i + 1) * sliceHeight + (isLast ? 0 : overlap / 2));
        const height = bottom - top;
        // Gradient mask: fade in at top edge, fade out at bottom edge
        const maskTop = isFirst ? 0 : Math.round((overlap / 2 / height) * 100);
        const maskBottom = isLast ? 100 : 100 - Math.round((overlap / 2 / height) * 100);
        const mask = `linear-gradient(to bottom, transparent 0%, black ${maskTop}%, black ${maskBottom}%, transparent 100%)`;

        return (
          <motion.img
            key={img.id}
            src={img.url}
            alt=""
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ duration: 1.2, delay: i * 0.2 }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${top}%`,
              height: `${height}%`,
              width: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
              filter: 'blur(2px)',
              transform: 'scale(1.02)',
              pointerEvents: 'none',
              zIndex: 1,
              maskImage: images.length > 1 ? mask : undefined,
              WebkitMaskImage: images.length > 1 ? mask : undefined,
            }}
          />
        );
      })}

      {/* Dark scrim */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(26, 20, 16, 0.45)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      {/* Color glow */}
      <div style={{
        position: 'absolute',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '140%',
        aspectRatio: '1',
        background: `radial-gradient(circle, ${accentColor}18 0%, transparent 55%)`,
        pointerEvents: 'none',
        zIndex: 2,
      }} />
    </>
  );
}

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
