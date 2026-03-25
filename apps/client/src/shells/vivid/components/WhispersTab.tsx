import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { Crown, AddCircle, CheckCircle, CloseCircle } from '@solar-icons/react';
import { useGameStore, selectRequireDmInvite, selectDmSlots } from '../../../store/useGameStore';
import { ChannelTypes, GAME_MASTER_ID, Events } from '@pecking-order/shared-types';
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
  onSelectDm: (playerId: string, channelId?: string) => void;
  onSelectGroup: (channelId: string) => void;
  onNew: () => void;
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
  onNew,
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
        channelId={activeChannelId ?? undefined}
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
      engine={engine}
      playerColorMap={playerColorMap}
      onSelectDm={onSelectDm}
      onSelectGroup={onSelectGroup}
      onNew={onNew}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  ConversationList                                                    */
/* ------------------------------------------------------------------ */

interface ConversationListProps {
  engine: any;
  playerColorMap: Record<string, string>;
  onSelectDm: (playerId: string, channelId?: string) => void;
  onSelectGroup: (channelId: string) => void;
  onNew: () => void;
}

function ConversationList({
  engine,
  playerColorMap,
  onSelectDm,
  onSelectGroup,
  onNew,
}: ConversationListProps) {
  const playerId = useGameStore(s => s.playerId);
  const roster = useGameStore(s => s.roster);
  const chatLog = useGameStore(s => s.chatLog);
  const channels = useGameStore(s => s.channels);
  const requireDmInvite = useGameStore(selectRequireDmInvite);
  const dmSlots = useGameStore(useShallow(selectDmSlots));

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
      .filter(ch =>
        ch.type === ChannelTypes.GROUP_DM &&
        (ch.memberIds.includes(playerId) || (ch.pendingMemberIds || []).includes(playerId))
      )
      .map(ch => {
        const messages = chatLog
          .filter((m: ChatMessage) => m.channelId === ch.id)
          .sort((a, b) => a.timestamp - b.timestamp);
        const allIds = [...ch.memberIds, ...(ch.pendingMemberIds || [])];
        const memberNames = allIds
          .filter(id => id !== playerId)
          .map(id => roster[id]?.personaName || 'Unknown');
        const otherMemberIds = allIds.filter(id => id !== playerId);
        const lastMsg = messages[messages.length - 1];
        const isPending = (ch.pendingMemberIds || []).includes(playerId);
        return {
          channelId: ch.id,
          memberNames,
          otherMemberIds,
          lastMsg,
          lastTimestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : ch.createdAt,
          isPending,
        };
      })
      .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [channels, chatLog, playerId, roster]);

  /* -- 1:1 DM threads ------------------------------------------------ */

  const dmThreads = useMemo(() => {
    if (!playerId) return [];
    return Object.values(channels)
      .filter(ch =>
        ch.type === ChannelTypes.DM &&
        !ch.memberIds.includes(GAME_MASTER_ID) &&
        (ch.memberIds.includes(playerId) || (ch.pendingMemberIds || []).includes(playerId))
      )
      .map(ch => {
        const allIds = [...ch.memberIds, ...(ch.pendingMemberIds || [])];
        const otherPlayerId = allIds.find(id => id !== playerId && id !== GAME_MASTER_ID);
        const messages = chatLog
          .filter((m: ChatMessage) => m.channelId === ch.id)
          .sort((a, b) => a.timestamp - b.timestamp);
        const lastMsg = messages[messages.length - 1];
        const isPending = (ch.pendingMemberIds || []).includes(playerId);
        return {
          channelId: ch.id,
          playerId: otherPlayerId,
          lastMessage: lastMsg,
          lastTimestamp: lastMsg?.timestamp ?? ch.createdAt,
          isPending,
        };
      })
      .filter(t => t.playerId)
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
          borderBottom: '2px solid rgba(139, 115, 85, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontWeight: 800,
              fontSize: 22,
              color: 'var(--vivid-text)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Whispers
          </span>
          {requireDmInvite && (
            <span
              style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--vivid-text-dim)',
                background: 'var(--vivid-bg-elevated)',
                padding: '2px 10px',
                borderRadius: 12,
              }}
            >
              {dmSlots.total - dmSlots.used}/{dmSlots.total}
            </span>
          )}
        </div>

        <motion.button
          onClick={onNew}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 14px',
            borderRadius: 9999,
            background: '#3BA99C',
            border: 'none',
            color: '#FFFFFF',
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(59, 169, 156, 0.2)',
          }}
          whileTap={VIVID_TAP.fab}
          transition={VIVID_SPRING.bouncy}
        >
          <AddCircle size={14} weight="Bold" />
          New
        </motion.button>
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
            borderColor="#D4960A"
            onClick={() => onSelectDm(GAME_MASTER_ID)}
            index={staggerIndex++}
            avatar={
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(212, 150, 10, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Crown size={20} weight="BoldDuotone" style={{ color: '#D4960A' }} />
              </div>
            }
            name="Game Master"
            nameColor="#D4960A"
            lastMessage={gmDm.lastMessage.content}
            timestamp={gmDm.lastTimestamp}
          />
        )}

        {/* Group threads */}
        {groupThreads.map(thread => {
          const idx = staggerIndex++;
          const borderColor = thread.isPending ? '#3BA99C' : '#8B6CC1';
          const nameColor = thread.isPending ? '#3BA99C' : '#8B6CC1';
          return (
            <ConversationItem
              key={thread.channelId}
              borderColor={borderColor}
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
              nameColor={nameColor}
              lastMessage={thread.isPending ? 'Wants to whisper...' : thread.lastMsg?.content}
              timestamp={thread.isPending ? undefined : thread.lastTimestamp}
              onAccept={thread.isPending ? () => {
                engine.socket.send(JSON.stringify({
                  type: Events.Social.ACCEPT_DM,
                  channelId: thread.channelId,
                }));
              } : undefined}
              onDecline={thread.isPending ? () => {
                engine.socket.send(JSON.stringify({
                  type: Events.Social.DECLINE_DM,
                  channelId: thread.channelId,
                }));
              } : undefined}
            />
          );
        })}

        {/* 1:1 DM threads */}
        {dmThreads.map(thread => {
          if (!thread.playerId) return null;
          const player = roster[thread.playerId];
          const color = thread.isPending ? '#3BA99C' : (playerColorMap[thread.playerId] || '#9B8E7E');
          const idx = staggerIndex++;
          return (
            <ConversationItem
              key={thread.channelId}
              borderColor={thread.isPending ? 'rgba(59, 169, 156, 0.6)' : color}
              onClick={() => onSelectDm(thread.playerId!, thread.channelId)}
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
              lastMessage={thread.isPending ? 'Wants to whisper...' : thread.lastMessage?.content}
              timestamp={thread.isPending ? undefined : thread.lastTimestamp}
              onAccept={thread.isPending ? () => {
                engine.socket.send(JSON.stringify({
                  type: Events.Social.ACCEPT_DM,
                  channelId: thread.channelId,
                }));
              } : undefined}
              onDecline={thread.isPending ? () => {
                engine.socket.send(JSON.stringify({
                  type: Events.Social.DECLINE_DM,
                  channelId: thread.channelId,
                }));
              } : undefined}
            />
          );
        })}

        {/* Empty state — conversation starters from player bios */}
        {isEmpty && (() => {
          const starters = Object.entries(roster)
            .filter(([id, p]) =>
              id !== playerId &&
              id !== GAME_MASTER_ID &&
              p.status === 'ALIVE' &&
              p.qaAnswers &&
              p.qaAnswers.length > 0
            )
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

          return (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '24px 16px',
              gap: 16,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontFamily: 'var(--vivid-font-display)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#D4A853',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 4,
                }}>
                  Get to know your rivals
                </div>
                <div style={{
                  fontFamily: 'var(--vivid-font-body)',
                  fontSize: 12,
                  color: 'rgba(250, 243, 232, 0.4)',
                }}>
                  Tap to start a conversation
                </div>
              </div>

              {starters.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  fontFamily: 'var(--vivid-font-display)',
                  fontSize: 14,
                  fontStyle: 'italic',
                  color: 'var(--vivid-text-dim)',
                  paddingTop: 24,
                }}>
                  No whispers yet...
                </div>
              )}

              {starters.map(([id, player], i) => {
                const qa = player.qaAnswers![Math.floor(Math.random() * player.qaAnswers!.length)];
                const color = playerColorMap[id] || '#3BA99C';
                return (
                  <motion.button
                    key={id}
                    onClick={() => onSelectDm(id)}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, ...VIVID_SPRING.gentle }}
                    whileTap={VIVID_TAP.button}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: 14,
                      background: 'rgba(44, 0, 62, 0.4)',
                      backdropFilter: 'blur(8px)',
                      border: `1px solid ${color}20`,
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ flexShrink: 0, paddingTop: 2 }}>
                      <PersonaAvatar
                        avatarUrl={player.avatarUrl}
                        personaName={player.personaName}
                        size={36}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'var(--vivid-font-display)',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#FAF3E8',
                        marginBottom: 4,
                      }}>
                        {player.personaName}
                      </div>
                      {qa.narratorIntro && (
                        <div style={{
                          fontFamily: 'var(--vivid-font-body)',
                          fontSize: 11,
                          fontStyle: 'italic',
                          color: 'rgba(250, 243, 232, 0.4)',
                          lineHeight: 1.4,
                          marginBottom: 4,
                        }}>
                          {qa.narratorIntro}
                        </div>
                      )}
                      <div style={{
                        fontFamily: 'var(--vivid-font-body)',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#D4A853',
                        lineHeight: 1.4,
                      }}>
                        &ldquo;{qa.answer}&rdquo;
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          );
        })()}
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
  onAccept?: () => void;
  onDecline?: () => void;
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
  onAccept,
  onDecline,
}: ConversationItemProps) {
  const isPending = !!(onAccept && onDecline);

  if (isPending) {
    return (
      <motion.div
        style={{
          margin: '4px 8px',
          width: 'calc(100% - 16px)',
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(59, 169, 156, 0.08), rgba(59, 169, 156, 0.03))',
          border: '2px solid rgba(59, 169, 156, 0.35)',
          boxShadow: '0 2px 12px rgba(59, 169, 156, 0.12)',
          overflow: 'hidden',
        }}
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: index * 0.03, ...VIVID_SPRING.gentle }}
      >
        {/* Top row: avatar + name + message */}
        <div
          onClick={onClick}
          style={{
            padding: '14px 16px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
          }}
        >
          <div style={{ flexShrink: 0 }}>{avatar}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                fontSize: 14,
                color: '#2D8F84',
              }}
            >
              {name}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(59, 169, 156, 0.7)',
                fontFamily: 'var(--vivid-font-body)',
                fontStyle: 'italic',
                marginTop: 2,
              }}
            >
              {lastMessage}
            </div>
          </div>
        </div>

        {/* Action row: decline / accept */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '0 16px 14px',
          }}
        >
          <motion.button
            onClick={(e) => { e.stopPropagation(); onDecline!(); }}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              background: '#FFFFFF',
              border: '1.5px solid rgba(139, 115, 85, 0.12)',
              fontFamily: 'var(--vivid-font-display)',
              fontWeight: 700,
              fontSize: 13,
              color: '#B0736A',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
            whileTap={VIVID_TAP.button}
            transition={VIVID_SPRING.bouncy}
          >
            <CloseCircle size={16} weight="Bold" />
            Decline
          </motion.button>
          <motion.button
            onClick={(e) => { e.stopPropagation(); onAccept!(); }}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              background: '#3BA99C',
              border: 'none',
              fontFamily: 'var(--vivid-font-display)',
              fontWeight: 700,
              fontSize: 13,
              color: '#FFFFFF',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(59, 169, 156, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
            whileTap={VIVID_TAP.button}
            transition={VIVID_SPRING.bouncy}
          >
            <CheckCircle size={16} weight="Bold" />
            Accept
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      style={{
        padding: '12px 16px',
        margin: '2px 8px',
        width: 'calc(100% - 16px)',
        background: '#FFFFFF',
        border: '1px solid rgba(139, 115, 85, 0.06)',
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: 'var(--vivid-surface-shadow)',
      }}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, ...VIVID_SPRING.gentle }}
      whileTap={VIVID_TAP.card}
    >
      {avatar}
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
      {timestamp && (
        <span
          style={{
            flexShrink: 0,
            fontFamily: 'var(--vivid-font-mono)',
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
