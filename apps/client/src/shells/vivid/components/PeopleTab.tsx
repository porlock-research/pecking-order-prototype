import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { Crown, AddCircle, CheckCircle, CloseCircle } from '@solar-icons/react';
import { useGameStore, selectRequireDmInvite, selectDmSlots } from '../../../store/useGameStore';
import { ChannelTypes, GAME_MASTER_ID, Events, PlayerStatuses } from '@pecking-order/shared-types';
import type { ChatMessage } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { DMChat } from './DMChat';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PeopleTabProps {
  engine: any;
  playerColorMap: Record<string, string>;
  activeDmPlayerId?: string | null;
  activeChannelId?: string | null;
  onSelectPlayer: (playerId: string, channelId?: string) => void;
  onSelectGroup: (channelId: string) => void;
  onBack: () => void;
  onTapAvatar?: (playerId: string) => void;
  onViewProfile: (playerId: string) => void;
  onNewGroup: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const RANK_BADGE_STYLES: Record<number, { bg: string; color: string }> = {
  1: { bg: 'rgba(212, 150, 10, 0.15)', color: '#D4960A' },
  2: { bg: 'rgba(155, 142, 126, 0.12)', color: '#9B8E7E' },
  3: { bg: 'rgba(196, 113, 59, 0.12)', color: '#C4713B' },
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

/* ------------------------------------------------------------------ */
/*  PeopleTab                                                          */
/* ------------------------------------------------------------------ */

export function PeopleTab({
  engine,
  playerColorMap,
  activeDmPlayerId,
  activeChannelId,
  onSelectPlayer,
  onSelectGroup,
  onBack,
  onTapAvatar,
  onViewProfile,
  onNewGroup,
}: PeopleTabProps) {
  /* ---- If a DM is selected, render DMChat ------------------------- */
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

  /* ---- Otherwise render the leaderboard --------------------------- */
  return (
    <PeopleList
      engine={engine}
      playerColorMap={playerColorMap}
      onSelectPlayer={onSelectPlayer}
      onSelectGroup={onSelectGroup}
      onViewProfile={onViewProfile}
      onNewGroup={onNewGroup}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  PeopleList                                                         */
/* ------------------------------------------------------------------ */

interface PeopleListProps {
  engine: any;
  playerColorMap: Record<string, string>;
  onSelectPlayer: (playerId: string, channelId?: string) => void;
  onSelectGroup: (channelId: string) => void;
  onViewProfile: (playerId: string) => void;
  onNewGroup: () => void;
}

function PeopleList({
  engine,
  playerColorMap,
  onSelectPlayer,
  onSelectGroup,
  onViewProfile,
  onNewGroup,
}: PeopleListProps) {
  const { playerId, roster } = useGameStore();
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const chatLog = useGameStore(s => s.chatLog);
  const channels = useGameStore(s => s.channels);
  const requireDmInvite = useGameStore(selectRequireDmInvite);
  const dmSlots = useGameStore(useShallow(selectDmSlots));

  const onlineSet = useMemo(() => new Set(onlinePlayers), [onlinePlayers]);

  /* -- Ranked players ----------------------------------------------- */

  const { rankedAlive, eliminated } = useMemo(() => {
    const all = Object.values(roster).filter(p => p.id !== GAME_MASTER_ID);
    const alive = all
      .filter(p => p.status === PlayerStatuses.ALIVE)
      .sort((a, b) => (b.silver ?? 0) - (a.silver ?? 0));
    const elim = all
      .filter(p => p.status === PlayerStatuses.ELIMINATED)
      .sort((a, b) => (b.silver ?? 0) - (a.silver ?? 0));
    return { rankedAlive: alive, eliminated: elim };
  }, [roster]);

  /* -- Pending invites (DM channels where current user is pending) -- */

  const pendingInvites = useMemo(() => {
    if (!playerId) return {} as Record<string, { channelId: string; lastMessage?: ChatMessage }>;
    const invites: Record<string, { channelId: string; lastMessage?: ChatMessage }> = {};
    Object.values(channels).forEach(ch => {
      if (ch.type === ChannelTypes.DM && (ch.pendingMemberIds || []).includes(playerId)) {
        const allIds = [...ch.memberIds, ...(ch.pendingMemberIds || [])];
        const otherPlayerId = allIds.find(id => id !== playerId && id !== GAME_MASTER_ID);
        if (otherPlayerId) {
          const msgs = chatLog
            .filter((m: ChatMessage) => m.channelId === ch.id)
            .sort((a, b) => a.timestamp - b.timestamp);
          invites[otherPlayerId] = { channelId: ch.id, lastMessage: msgs[msgs.length - 1] };
        }
      }
    });
    return invites;
  }, [channels, chatLog, playerId]);

  /* -- Existing DM channels (for showing "last message" context) ---- */

  const existingDms = useMemo(() => {
    if (!playerId) return {} as Record<string, { channelId: string; lastMessage?: ChatMessage }>;
    const dms: Record<string, { channelId: string; lastMessage?: ChatMessage }> = {};
    Object.values(channels).forEach(ch => {
      if (
        ch.type === ChannelTypes.DM &&
        !ch.memberIds.includes(GAME_MASTER_ID) &&
        ch.memberIds.includes(playerId) &&
        !(ch.pendingMemberIds || []).includes(playerId)
      ) {
        const otherPlayerId = ch.memberIds.find(id => id !== playerId && id !== GAME_MASTER_ID);
        if (otherPlayerId) {
          const msgs = chatLog
            .filter((m: ChatMessage) => m.channelId === ch.id)
            .sort((a, b) => a.timestamp - b.timestamp);
          dms[otherPlayerId] = { channelId: ch.id, lastMessage: msgs[msgs.length - 1] };
        }
      }
    });
    return dms;
  }, [channels, chatLog, playerId]);

  /* -- Game Master DM ----------------------------------------------- */

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

  /* -- Group DM threads --------------------------------------------- */

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

  /* -- Render ------------------------------------------------------- */

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
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
            People
          </span>
          <span
            style={{
              fontSize: 13,
              color: 'var(--vivid-text-dim)',
              fontFamily: 'var(--vivid-font-body)',
              fontWeight: 500,
            }}
          >
            {rankedAlive.length} alive
          </span>
        </div>
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
            {dmSlots.total - dmSlots.used}/{dmSlots.total} slots
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Game Master DM (pinned) */}
        {gmDm && (
          <motion.button
            onClick={() => onSelectPlayer(GAME_MASTER_ID)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              background: 'rgba(212, 150, 10, 0.04)',
              border: '1px solid rgba(212, 150, 10, 0.12)',
              borderRadius: 16,
              cursor: 'pointer',
              textAlign: 'left',
              marginBottom: 4,
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={VIVID_SPRING.gentle}
            whileTap={VIVID_TAP.card}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(212, 150, 10, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Crown size={18} weight="BoldDuotone" style={{ color: '#D4960A' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--vivid-font-display)',
                  fontWeight: 700,
                  fontSize: 14,
                  color: '#D4960A',
                }}
              >
                Game Master
              </div>
              {gmDm.lastMessage && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--vivid-text-dim)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: 1,
                  }}
                >
                  {gmDm.lastMessage.content}
                </div>
              )}
            </div>
            <span
              style={{
                flexShrink: 0,
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 11,
                color: 'var(--vivid-text-dim)',
              }}
            >
              {relativeTime(gmDm.lastTimestamp)}
            </span>
          </motion.button>
        )}

        {/* Leaderboard — alive players ranked by silver */}
        {rankedAlive.map((p, i) => {
          const rank = i + 1;
          const isMe = p.id === playerId;
          const color = playerColorMap[p.id] || 'var(--vivid-phase-accent)';
          const badgeStyle = RANK_BADGE_STYLES[rank] || { bg: 'rgba(155, 142, 126, 0.08)', color: 'var(--vivid-text-dim)' };
          const pending = pendingInvites[p.id];
          const existing = existingDms[p.id];
          const isOnline = onlineSet.has(p.id);

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...VIVID_SPRING.gentle, delay: 0.03 * i }}
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                border: pending
                  ? '2px solid rgba(59, 169, 156, 0.35)'
                  : isMe
                    ? `2px solid ${color}`
                    : '1px solid rgba(139, 115, 85, 0.06)',
                background: pending
                  ? 'linear-gradient(135deg, rgba(59, 169, 156, 0.06), rgba(59, 169, 156, 0.02))'
                  : '#FFFFFF',
                boxShadow: pending
                  ? '0 2px 12px rgba(59, 169, 156, 0.1)'
                  : rank <= 3
                    ? '0 2px 10px rgba(139, 115, 85, 0.08)'
                    : 'var(--vivid-surface-shadow)',
              }}
            >
              {/* Player row */}
              <motion.button
                onClick={() => onSelectPlayer(p.id, pending?.channelId ?? existing?.channelId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: rank <= 3 ? '12px 14px' : '10px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  width: '100%',
                }}
                whileTap={VIVID_TAP.card}
              >
                {/* Rank badge */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    minWidth: 28,
                    borderRadius: 9,
                    background: badgeStyle.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--vivid-font-mono)',
                      fontSize: 13,
                      fontWeight: 800,
                      color: badgeStyle.color,
                    }}
                  >
                    #{rank}
                  </span>
                </div>

                {/* Avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {rank <= 3 ? (
                    <div
                      style={{
                        borderRadius: '50%',
                        padding: 2,
                        border: `2px solid ${color}`,
                        display: 'flex',
                      }}
                    >
                      <PersonaAvatar
                        avatarUrl={p.avatarUrl}
                        personaName={p.personaName}
                        size={rank === 1 ? 48 : 42}
                      />
                    </div>
                  ) : (
                    <PersonaAvatar
                      avatarUrl={p.avatarUrl}
                      personaName={p.personaName}
                      size={38}
                    />
                  )}
                  {isOnline && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: rank <= 3 ? 2 : 0,
                        right: rank <= 3 ? 2 : 0,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#4ade80',
                        border: '2px solid #FFFFFF',
                      }}
                    />
                  )}
                </div>

                {/* Name + last message */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: rank <= 3 ? 15 : 14,
                        fontWeight: 700,
                        color: pending ? '#2D8F84' : color,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--vivid-font-display)',
                      }}
                    >
                      {p.personaName}
                    </span>
                    {isMe && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: '#D4960A',
                          background: 'rgba(212, 150, 10, 0.12)',
                          padding: '1px 5px',
                          borderRadius: 4,
                        }}
                      >
                        YOU
                      </span>
                    )}
                  </div>
                  {/* Last message preview or pending message */}
                  {pending?.lastMessage ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'rgba(59, 169, 156, 0.7)',
                        fontFamily: 'var(--vivid-font-body)',
                        fontStyle: 'italic',
                        marginTop: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {pending.lastMessage.content}
                    </div>
                  ) : existing?.lastMessage ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--vivid-text-dim)',
                        fontFamily: 'var(--vivid-font-body)',
                        marginTop: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {existing.lastMessage.content}
                    </div>
                  ) : null}
                </div>

                {/* Silver amount */}
                <span
                  style={{
                    fontFamily: 'var(--vivid-font-mono)',
                    fontSize: 12,
                    color: '#D4960A',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {p.silver ?? 0}
                </span>
              </motion.button>

              {/* Pending invite embellishment — inline accept/decline */}
              {pending && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    padding: '0 14px 12px',
                  }}
                >
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      engine.socket.send(JSON.stringify({
                        type: Events.Social.DECLINE_DM,
                        channelId: pending.channelId,
                      }));
                    }}
                    style={{
                      flex: 1,
                      padding: '9px 0',
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
                    <CloseCircle size={15} weight="Bold" />
                    Decline
                  </motion.button>
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      engine.socket.send(JSON.stringify({
                        type: Events.Social.ACCEPT_DM,
                        channelId: pending.channelId,
                      }));
                    }}
                    style={{
                      flex: 1,
                      padding: '9px 0',
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
                    <CheckCircle size={15} weight="Bold" />
                    Accept
                  </motion.button>
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Groups section */}
        {(groupThreads.length > 0 || true) && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--vivid-font-display)',
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--vivid-text-dim)',
                }}
              >
                Groups
              </span>
              <motion.button
                onClick={onNewGroup}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 12px',
                  borderRadius: 9999,
                  background: 'rgba(139, 108, 193, 0.1)',
                  border: 'none',
                  color: '#8B6CC1',
                  fontFamily: 'var(--vivid-font-display)',
                  fontWeight: 700,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
                whileTap={VIVID_TAP.button}
                transition={VIVID_SPRING.bouncy}
              >
                <AddCircle size={12} weight="Bold" />
                New
              </motion.button>
            </div>

            {groupThreads.length === 0 ? (
              <div
                style={{
                  padding: '16px 0',
                  textAlign: 'center',
                  fontFamily: 'var(--vivid-font-body)',
                  fontSize: 13,
                  color: 'var(--vivid-text-dim)',
                  fontStyle: 'italic',
                }}
              >
                No group chats yet
              </div>
            ) : (
              groupThreads.map(thread => (
                <motion.button
                  key={thread.channelId}
                  onClick={() => onSelectGroup(thread.channelId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    background: thread.isPending
                      ? 'linear-gradient(135deg, rgba(59, 169, 156, 0.06), rgba(59, 169, 156, 0.02))'
                      : 'var(--vivid-bg-elevated)',
                    border: thread.isPending
                      ? '2px solid rgba(59, 169, 156, 0.3)'
                      : '1px solid rgba(139, 115, 85, 0.06)',
                    borderRadius: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                  whileTap={VIVID_TAP.card}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={VIVID_SPRING.gentle}
                >
                  {/* Stacked avatars */}
                  <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
                    {thread.otherMemberIds.slice(0, 3).map((id, j) => {
                      const member = roster[id];
                      return (
                        <div
                          key={id}
                          style={{
                            position: 'absolute',
                            top: j * 3,
                            left: j * 8,
                            zIndex: 3 - j,
                          }}
                        >
                          <PersonaAvatar
                            avatarUrl={member?.avatarUrl}
                            personaName={member?.personaName}
                            size={24}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--vivid-font-display)',
                        fontWeight: 700,
                        fontSize: 13,
                        color: thread.isPending ? '#2D8F84' : '#8B6CC1',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {thread.memberNames.join(', ')}
                    </div>
                    {thread.lastMsg && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--vivid-text-dim)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: 1,
                        }}
                      >
                        {thread.isPending ? 'Group invite...' : thread.lastMsg.content}
                      </div>
                    )}
                  </div>

                  {thread.lastTimestamp && (
                    <span
                      style={{
                        flexShrink: 0,
                        fontFamily: 'var(--vivid-font-mono)',
                        fontSize: 11,
                        color: 'var(--vivid-text-dim)',
                      }}
                    >
                      {relativeTime(thread.lastTimestamp)}
                    </span>
                  )}
                </motion.button>
              ))
            )}
          </>
        )}

        {/* Eliminated section */}
        {eliminated.length > 0 && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--vivid-font-display)',
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--vivid-text-dim)',
                }}
              >
                Eliminated
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--vivid-text-dim)',
                  fontFamily: 'var(--vivid-font-body)',
                }}
              >
                {eliminated.length}
              </span>
            </div>

            {eliminated.map((p, i) => {
              const isMe = p.id === playerId;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ ...VIVID_SPRING.gentle, delay: 0.03 * i }}
                  onClick={() => onViewProfile(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 14px',
                    background: isMe ? 'rgba(217, 64, 115, 0.04)' : 'var(--vivid-bg-elevated)',
                    borderRadius: 14,
                    border: '1px solid rgba(139, 115, 85, 0.06)',
                    cursor: 'pointer',
                  }}
                >
                  <PersonaAvatar
                    avatarUrl={p.avatarUrl}
                    personaName={p.personaName}
                    size={34}
                    eliminated
                  />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 13,
                        color: 'var(--vivid-text-dim)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--vivid-font-display)',
                      }}
                    >
                      {p.personaName}
                    </span>
                    {isMe && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: '#D4960A',
                          background: 'rgba(212, 150, 10, 0.12)',
                          padding: '1px 5px',
                          borderRadius: 4,
                        }}
                      >
                        YOU
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#D94073',
                        background: 'rgba(217, 64, 115, 0.08)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontFamily: 'var(--vivid-font-display)',
                      }}
                    >
                      ELIMINATED
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--vivid-font-mono)',
                      fontSize: 12,
                      color: 'var(--vivid-text-dim)',
                    }}
                  >
                    {p.silver ?? 0}
                  </span>
                </motion.div>
              );
            })}
          </>
        )}

        {/* Bottom spacer */}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}
