import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus } from '@phosphor-icons/react';
import { useGameStore } from '../../../store/useGameStore';
import { ChannelTypes, GAME_MASTER_ID } from '@pecking-order/shared-types';
import type { ChatMessage } from '@pecking-order/shared-types';
import { ConversationCard } from './ConversationCard';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

interface BackstageProps {
  onSelectDm: (playerId: string) => void;
  onSelectGroup: (channelId: string) => void;
  onNewDm: () => void;
  onNewGroup: () => void;
  onBack: () => void;
}

export function Backstage({
  onSelectDm,
  onSelectGroup,
  onNewDm,
  onNewGroup,
  onBack,
}: BackstageProps) {
  const { playerId, roster } = useGameStore();
  const chatLog = useGameStore(s => s.chatLog);
  const channels = useGameStore(s => s.channels);
  const onlinePlayers = useGameStore(s => s.onlinePlayers);

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
    return { lastMessage: lastMsg };
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
        const isFromMe = lastMsg?.senderId === playerId;
        const lastSenderName = lastMsg
          ? isFromMe
            ? 'You'
            : roster[lastMsg.senderId]?.personaName || 'Unknown'
          : undefined;
        return {
          channelId: ch.id,
          memberNames,
          otherMemberIds,
          messages,
          lastMsg,
          lastSenderName,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--vivid-text)',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 0,
            }}
            whileTap={VIVID_TAP.button}
            transition={VIVID_SPRING.bouncy}
          >
            <ArrowLeft size={22} weight="bold" />
          </motion.button>
          <span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontWeight: 800,
              fontSize: 20,
              color: 'var(--vivid-text)',
            }}
          >
            Backstage
          </span>
        </div>

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
            <Plus size={14} weight="bold" />
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
            <Plus size={14} weight="bold" />
            Group
          </motion.button>
        </div>
      </div>

      {/* Conversation list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Game Master DM — pinned at top */}
        {gmDm && (
          <ConversationCard
            type="gm"
            lastMessage={gmDm.lastMessage.content}
            timestamp={gmDm.lastMessage.timestamp}
            onClick={() => onSelectDm(GAME_MASTER_ID)}
            index={staggerIndex++}
          />
        )}

        {/* Groups section */}
        {groupThreads.length > 0 && (
          <>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                color: 'var(--vivid-text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '8px 2px 4px',
              }}
            >
              Groups
            </span>
            {groupThreads.map(thread => {
              const memberAvatars = thread.otherMemberIds.map(id => ({
                avatarUrl: roster[id]?.avatarUrl,
                personaName: roster[id]?.personaName,
              }));
              const cardIndex = staggerIndex++;
              return (
                <ConversationCard
                  key={thread.channelId}
                  type="group"
                  personaName={thread.memberNames.join(', ')}
                  memberAvatars={memberAvatars}
                  lastMessage={thread.lastMsg?.content}
                  lastSenderName={thread.lastSenderName}
                  timestamp={thread.lastTimestamp}
                  onClick={() => onSelectGroup(thread.channelId)}
                  index={cardIndex}
                />
              );
            })}
          </>
        )}

        {/* Direct Messages section */}
        {dmThreads.length > 0 && (
          <>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 10,
                color: 'var(--vivid-text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                padding: '8px 2px 4px',
              }}
            >
              Direct Messages
            </span>
            {dmThreads.map(thread => {
              if (!thread.playerId || !thread.lastMessage) return null;
              const player = roster[thread.playerId];
              const isFromMe = thread.lastMessage.senderId === playerId;
              const cardIndex = staggerIndex++;
              return (
                <ConversationCard
                  key={thread.playerId}
                  type="1on1"
                  avatarUrl={player?.avatarUrl}
                  personaName={player?.personaName ?? 'Unknown'}
                  lastMessage={thread.lastMessage.content}
                  lastSenderName={isFromMe ? 'You' : undefined}
                  timestamp={thread.lastTimestamp}
                  isOnline={onlinePlayers.includes(thread.playerId)}
                  onClick={() => onSelectDm(thread.playerId!)}
                  index={cardIndex}
                />
              );
            })}
          </>
        )}

        {/* Empty state */}
        {!gmDm && groupThreads.length === 0 && dmThreads.length === 0 && (
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
              }}
            >
              No conversations yet
            </span>
            <span
              style={{
                fontSize: 13,
                color: 'var(--vivid-text-dim)',
                opacity: 0.6,
                textAlign: 'center',
              }}
            >
              Start a DM or create a group to get scheming
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
