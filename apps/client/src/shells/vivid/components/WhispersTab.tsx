import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crown, AddCircle } from '@solar-icons/react';
import { useGameStore } from '../../../store/useGameStore';
import { ChannelTypes, GAME_MASTER_ID } from '@pecking-order/shared-types';
import type { ChatMessage } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { DMChat } from './DMChat';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WhispersTabProps {
  engine: any;
  playerColorMap: Record<string, string>;
  activeDmPlayerId?: string | null;
  activeChannelId?: string | null;
  onSelectDm: (playerId: string) => void;
  onSelectGroup: (channelId: string) => void;
  onNewDm: () => void;
  onNewGroup: () => void;
  onBack: () => void;
  onTapAvatar?: (playerId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function WhispersTab({
  engine,
  playerColorMap,
  activeDmPlayerId,
  activeChannelId,
  onSelectDm,
  onSelectGroup,
  onNewDm,
  onNewGroup,
  onBack,
  onTapAvatar,
}: WhispersTabProps) {
  /* ---- If a conversation is selected, render DMChat --------------- */
  if (activeDmPlayerId) {
    return (
      <DMChat
        key={activeDmPlayerId}
        mode="1on1"
        targetPlayerId={activeDmPlayerId}
        engine={engine}
        onBack={onBack}
        onOpenSpotlight={onTapAvatar}
        playerColorMap={playerColorMap}
        onTapAvatar={onTapAvatar}
      />
    );
  }

  if (activeChannelId) {
    return (
      <DMChat
        key={activeChannelId}
        mode="group"
        channelId={activeChannelId}
        engine={engine}
        onBack={onBack}
        onOpenSpotlight={onTapAvatar}
        playerColorMap={playerColorMap}
        onTapAvatar={onTapAvatar}
      />
    );
  }

  /* ---- Otherwise render the conversation list --------------------- */
  return (
    <ConversationList
      playerColorMap={playerColorMap}
      onSelectDm={onSelectDm}
      onSelectGroup={onSelectGroup}
      onNewDm={onNewDm}
      onNewGroup={onNewGroup}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  ConversationList                                                    */
/* ------------------------------------------------------------------ */

interface ConversationListProps {
  playerColorMap: Record<string, string>;
  onSelectDm: (playerId: string) => void;
  onSelectGroup: (channelId: string) => void;
  onNewDm: () => void;
  onNewGroup: () => void;
}

function ConversationList({
  playerColorMap,
  onSelectDm,
  onSelectGroup,
  onNewDm,
  onNewGroup,
}: ConversationListProps) {
  const { playerId, roster } = useGameStore();
  const chatLog = useGameStore(s => s.chatLog);
  const channels = useGameStore(s => s.channels);

  /* -- Game Master DM ------------------------------------------------ */

  const gmDm = useMemo(() => {
    if (!playerId) return null;
    const gmChannel = Object.values(channels).find(
      ch => ch.type === ChannelTypes.DM && ch.memberIds.includes(GAME_MASTER_ID),
    );
    if (!gmChannel) return null;
    const msgs = chatLog
      .filter((m: ChatMessage) => m.channelId === gmChannel.id)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (msgs.length === 0) return null;
    const lastMsg = msgs[msgs.length - 1];
    return { lastMessage: lastMsg, lastTimestamp: lastMsg.timestamp };
  }, [channels, chatLog, playerId]);

  /* -- Group DM threads ---------------------------------------------- */

  const groupThreads = useMemo(() => {
    if (!playerId) return [];
    return Object.values(channels)
      .filter(ch => ch.type === ChannelTypes.GROUP_DM && ch.memberIds.includes(playerId))
      .map(ch => {
        const messages = chatLog
          .filter((m: ChatMessage) => m.channelId === ch.id)
          .sort((a, b) => a.timestamp - b.timestamp);
        const memberNames = ch.memberIds
          .filter(id => id !== playerId)
          .map(id => roster[id]?.personaName || 'Unknown');
        const otherMemberIds = ch.memberIds.filter(id => id !== playerId);
        const lastMsg = messages[messages.length - 1];
        return {
          channelId: ch.id,
          memberNames,
          otherMemberIds,
          lastMsg,
          lastTimestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : ch.createdAt,
        };
      })
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [channels, chatLog, playerId, roster]);

  /* -- 1:1 DM threads ------------------------------------------------ */

  const dmThreads = useMemo(() => {
    if (!playerId) return [];
    return Object.values(channels)
      .filter(ch => ch.type === ChannelTypes.DM && ch.memberIds.includes(playerId))
      .map(ch => {
        const otherPlayerId = ch.memberIds.find(id => id !== playerId && id !== GAME_MASTER_ID);
        const messages = chatLog
          .filter((m: ChatMessage) => m.channelId === ch.id)
          .sort((a, b) => a.timestamp - b.timestamp);
        const lastMsg = messages[messages.length - 1];
        return {
          playerId: otherPlayerId,
          lastMessage: lastMsg,
          lastTimestamp: lastMsg?.timestamp ?? ch.createdAt,
        };
      })
      .filter(t => t.playerId && t.lastMessage)
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [channels, chatLog, playerId]);

  /* -- Stagger index counter ----------------------------------------- */

  let staggerIndex = 0;

  const isEmpty = !gmDm && groupThreads.length === 0 && dmThreads.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--vivid-bg-surface)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 800,
            fontSize: 20,
            color: 'var(--vivid-text)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Whispers
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.button
            onClick={onNewDm}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 14px',
              borderRadius: 9999,
              background: 'var(--vivid-teal)',
              border: 'none',
              color: '#FFFFFF',
              fontFamily: 'var(--vivid-font-display)',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            whileTap={VIVID_TAP.fab}
            transition={VIVID_SPRING.bouncy}
          >
            <AddCircle size={14} weight="Bold" />
            DM
          </motion.button>
          <motion.button
            onClick={onNewGroup}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 14px',
              borderRadius: 9999,
              background: 'var(--vivid-lavender)',
              border: 'none',
              color: '#FFFFFF',
              fontFamily: 'var(--vivid-font-display)',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            whileTap={VIVID_TAP.fab}
            transition={VIVID_SPRING.bouncy}
          >
            <AddCircle size={14} weight="Bold" />
            Group
          </motion.button>
        </div>
      </div>

      {/* Conversation list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Game Master DM — pinned at top */}
        {gmDm && (
          <ConversationItem
            key="gm"
            borderColor="var(--vivid-gold)"
            onClick={() => onSelectDm(GAME_MASTER_ID)}
            index={staggerIndex++}
            avatar={
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(255, 217, 61, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Crown size={20} weight="BoldDuotone" style={{ color: 'var(--vivid-gold)' }} />
              </div>
            }
            name="Game Master"
            nameColor="var(--vivid-gold)"
            lastMessage={gmDm.lastMessage.content}
            timestamp={gmDm.lastTimestamp}
          />
        )}

        {/* Group threads */}
        {groupThreads.map(thread => {
          const idx = staggerIndex++;
          return (
            <ConversationItem
              key={thread.channelId}
              borderColor="var(--vivid-lavender)"
              onClick={() => onSelectGroup(thread.channelId)}
              index={idx}
              avatar={
                <div style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                  {thread.otherMemberIds.slice(0, 3).map((id, i) => {
                    const p = roster[id];
                    return (
                      <div
                        key={id}
                        style={{
                          position: 'absolute',
                          top: i * 3,
                          left: i * 10,
                          zIndex: 3 - i,
                        }}
                      >
                        <PersonaAvatar
                          avatarUrl={p?.avatarUrl}
                          personaName={p?.personaName}
                          size={26}
                        />
                      </div>
                    );
                  })}
                </div>
              }
              name={thread.memberNames.join(', ')}
              nameColor="var(--vivid-lavender)"
              lastMessage={thread.lastMsg?.content}
              timestamp={thread.lastTimestamp}
            />
          );
        })}

        {/* 1:1 DM threads */}
        {dmThreads.map(thread => {
          if (!thread.playerId || !thread.lastMessage) return null;
          const player = roster[thread.playerId];
          const color = playerColorMap[thread.playerId] || '#8B8DB3';
          const idx = staggerIndex++;
          return (
            <ConversationItem
              key={thread.playerId}
              borderColor={color}
              onClick={() => onSelectDm(thread.playerId!)}
              index={idx}
              avatar={
                <PersonaAvatar
                  avatarUrl={player?.avatarUrl}
                  personaName={player?.personaName}
                  size={40}
                />
              }
              name={player?.personaName ?? 'Unknown'}
              nameColor={color}
              lastMessage={thread.lastMessage.content}
              timestamp={thread.lastTimestamp}
            />
          );
        })}

        {/* Empty state */}
        {isEmpty && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 12,
              padding: 32,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 16,
                color: 'var(--vivid-text-dim)',
                fontStyle: 'italic',
              }}
            >
              No whispers yet...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ConversationItem (inline sub-component)                            */
/* ------------------------------------------------------------------ */

interface ConversationItemProps {
  borderColor: string;
  onClick: () => void;
  index: number;
  avatar: React.ReactNode;
  name: string;
  nameColor: string;
  lastMessage?: string;
  timestamp?: number;
}

function ConversationItem({
  borderColor,
  onClick,
  index,
  avatar,
  name,
  nameColor,
  lastMessage,
  timestamp,
}: ConversationItemProps) {
  return (
    <motion.button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '12px 16px',
        background: 'transparent',
        border: 'none',
        borderLeft: `3px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
      }}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, ...VIVID_SPRING.gentle }}
      whileTap={VIVID_TAP.card}
    >
      {/* Avatar */}
      {avatar}

      {/* Name + last message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 700,
            fontSize: 14,
            color: nameColor,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        {lastMessage && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--vivid-text-dim)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: 2,
              lineHeight: 1.3,
            }}
          >
            {lastMessage}
          </div>
        )}
      </div>

      {/* Timestamp */}
      {timestamp && (
        <span
          style={{
            flexShrink: 0,
            fontFamily: 'monospace',
            fontSize: 11,
            color: 'var(--vivid-text-dim)',
          }}
        >
          {relativeTime(timestamp)}
        </span>
      )}
    </motion.button>
  );
}
