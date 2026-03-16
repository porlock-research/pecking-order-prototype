import React, { useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, type PanInfo } from 'framer-motion';
import type { TickerMessage, SocialPlayer } from '@pecking-order/shared-types';
import { useGameStore, selectUnreadFeedCount } from '../../../../store/useGameStore';
import { PersonaAvatar } from '../../../../components/PersonaAvatar';
import { VIVID_SPRING } from '../../springs';
import {
  Letter, Flag, Dollar, Gamepad, MagicStick3,
  Sun2, Moon, CupStar, ChatRound, StarShine, Crown, Danger,
} from '@solar-icons/react';

const DISMISS_THRESHOLD = -80;

/* ------------------------------------------------------------------ */
/*  Category visuals                                                    */
/* ------------------------------------------------------------------ */

interface CategoryMeta {
  icon: React.ComponentType<any>;
  color: string;
  bg: string;
}

function getCategoryMeta(category: string): CategoryMeta {
  const c = category.toUpperCase();
  if (c.includes('WINNER'))      return { icon: Crown,      color: '#D4960A', bg: 'rgba(212, 150, 10, 0.1)' };
  if (c.includes('ELIMINATION')) return { icon: Danger,      color: '#D94073', bg: 'rgba(217, 64, 115, 0.08)' };
  if (c === 'VOTE')              return { icon: Flag,        color: '#D94073', bg: 'rgba(217, 64, 115, 0.08)' };
  if (c.includes('TRANSFER'))    return { icon: Dollar,      color: '#D4960A', bg: 'rgba(212, 150, 10, 0.1)' };
  if (c.includes('GOLD'))        return { icon: Dollar,      color: '#D4960A', bg: 'rgba(212, 150, 10, 0.1)' };
  if (c === 'GAME')              return { icon: Gamepad,     color: '#8B6CC1', bg: 'rgba(139, 108, 193, 0.08)' };
  if (c.includes('REWARD'))      return { icon: Dollar,      color: '#D4960A', bg: 'rgba(212, 150, 10, 0.1)' };
  if (c.includes('ACTIVITY'))    return { icon: MagicStick3, color: '#8B6CC1', bg: 'rgba(139, 108, 193, 0.08)' };
  if (c.includes('PERK'))        return { icon: StarShine,   color: '#3BA99C', bg: 'rgba(59, 169, 156, 0.08)' };
  if (c.includes('DAY_START'))   return { icon: Sun2,        color: '#D4960A', bg: 'rgba(212, 150, 10, 0.1)' };
  if (c.includes('NIGHT'))       return { icon: Moon,        color: '#8B6CC1', bg: 'rgba(139, 108, 193, 0.08)' };
  if (c.includes('GAME_OVER'))   return { icon: CupStar,    color: '#D94073', bg: 'rgba(217, 64, 115, 0.08)' };
  if (c.includes('CHAT'))        return { icon: ChatRound,   color: '#3BA99C', bg: 'rgba(59, 169, 156, 0.08)' };
  if (c.includes('DMS'))         return { icon: Letter,      color: '#3BA99C', bg: 'rgba(59, 169, 156, 0.08)' };
  return { icon: ChatRound, color: '#9B8E7E', bg: 'rgba(155, 142, 126, 0.06)' };
}

/* ------------------------------------------------------------------ */
/*  Feed Item                                                          */
/* ------------------------------------------------------------------ */

function FeedItem({
  message,
  isUnread,
  roster,
  index,
}: {
  message: TickerMessage;
  isUnread: boolean;
  roster: Record<string, SocialPlayer>;
  index: number;
}) {
  const relTime = useMemo(() => {
    const diff = Date.now() - message.timestamp;
    if (diff < 60_000) return 'now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
    return `${Math.floor(diff / 86400_000)}d`;
  }, [message.timestamp]);

  const meta = useMemo(() => getCategoryMeta(message.category), [message.category]);

  // Resolve first involved player for avatar display
  const avatarPlayer = useMemo(() => {
    const ids = message.involvedPlayerIds;
    if (!ids || ids.length === 0) return null;
    return roster[ids[0]] || null;
  }, [message.involvedPlayerIds, roster]);

  const Icon = meta.icon;

  return (
    <motion.div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 12,
        background: isUnread ? meta.bg : 'transparent',
        borderLeft: isUnread ? `3px solid ${meta.color}` : '3px solid transparent',
        marginBottom: 2,
      }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...VIVID_SPRING.gentle, delay: Math.min(index * 0.03, 0.3) }}
    >
      {/* Icon or Avatar */}
      {avatarPlayer ? (
        <div style={{ flexShrink: 0 }}>
          <PersonaAvatar
            avatarUrl={avatarPlayer.avatarUrl}
            personaName={avatarPlayer.personaName}
            size={30}
          />
        </div>
      ) : (
        <div style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          background: isUnread ? `${meta.color}14` : 'rgba(155, 142, 126, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon
            size={16}
            weight="Bold"
            color={isUnread ? meta.color : '#9B8E7E'}
          />
        </div>
      )}

      {/* Text */}
      <p style={{
        margin: 0,
        flex: 1,
        minWidth: 0,
        fontFamily: 'var(--vivid-font-body)',
        fontSize: 13,
        lineHeight: 1.4,
        color: isUnread ? '#3D2E1F' : '#7A6B5A',
        fontWeight: isUnread ? 600 : 400,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical' as any,
      }}>
        {message.text}
      </p>

      {/* Time */}
      <span style={{
        flexShrink: 0,
        fontFamily: 'var(--vivid-font-mono)',
        fontSize: 10,
        color: isUnread ? meta.color : '#B5A898',
        fontWeight: isUnread ? 600 : 400,
        letterSpacing: '0.02em',
      }}>
        {relTime}
      </span>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feed Section                                                       */
/* ------------------------------------------------------------------ */

function FeedSection() {
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const lastSeenFeedTimestamp = useGameStore(s => s.lastSeenFeedTimestamp);
  const roster = useGameStore(s => s.roster);

  const feedItems = useMemo(
    () => [...tickerMessages].reverse().slice(0, 50),
    [tickerMessages],
  );

  if (feedItems.length === 0) {
    return (
      <div style={{
        padding: '28px 0',
        textAlign: 'center',
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          background: 'rgba(155, 142, 126, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 10px',
        }}>
          <ChatRound size={20} weight="Bold" color="#B5A898" />
        </div>
        <p style={{
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 13,
          color: '#B5A898',
          margin: 0,
        }}>
          No events yet
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {feedItems.map((msg, i) => (
        <FeedItem
          key={msg.id}
          message={msg}
          isUnread={msg.timestamp > lastSeenFeedTimestamp}
          roster={roster}
          index={i}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DashboardOverlay (Notifications Panel)                             */
/* ------------------------------------------------------------------ */

export function DashboardOverlay() {
  const dashboardOpen = useGameStore(s => s.dashboardOpen);
  const closeDashboard = useGameStore(s => s.closeDashboard);
  const markFeedSeen = useGameStore(s => s.markFeedSeen);
  const welcomeSeen = useGameStore(s => s.welcomeSeen);
  const markWelcomeSeen = useGameStore(s => s.markWelcomeSeen);
  const dayIndex = useGameStore(s => s.dayIndex);
  const unreadCount = useGameStore(selectUnreadFeedCount);
  const requestNavigation = useGameStore(s => s.requestNavigation);
  const pendingCount = useGameStore(s => {
    const pid = s.playerId;
    if (!pid) return 0;
    return Object.values(s.channels).filter(
      ch => (ch.pendingMemberIds || []).includes(pid)
    ).length;
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragY = useMotionValue(0);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (info.offset.y < DISMISS_THRESHOLD) {
      closeDashboard();
    }
  }, [closeDashboard]);

  const handleOpen = useCallback(() => {
    markFeedSeen();
  }, [markFeedSeen]);

  const handleViewInvites = useCallback(() => {
    closeDashboard();
    requestNavigation('people');
  }, [closeDashboard, requestNavigation]);

  const showWelcome = dayIndex <= 1 && !welcomeSeen;

  return (
    <AnimatePresence>
      {dashboardOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="dashboard-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 45,
              background: 'rgba(61, 46, 31, 0.55)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={closeDashboard}
          />

          {/* Panel */}
          <motion.div
            key="dashboard-panel"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              maxHeight: '85vh',
              zIndex: 46,
              display: 'flex',
              flexDirection: 'column',
              background: '#FAF3E8',
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              boxShadow: '0 12px 48px rgba(61, 46, 31, 0.2), 0 2px 8px rgba(61, 46, 31, 0.08)',
              overflow: 'hidden',
              y: dragY,
            }}
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={VIVID_SPRING.page}
            drag="y"
            dragConstraints={{ top: -200, bottom: 0 }}
            dragElastic={0.3}
            onDragEnd={handleDragEnd}
            onAnimationComplete={() => {
              if (dashboardOpen) handleOpen();
            }}
          >
            {/* Safe area + drag handle */}
            <div
              style={{
                paddingTop: 'env(safe-area-inset-top, 12px)',
                display: 'flex',
                justifyContent: 'center',
                paddingBottom: 4,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 5,
                  borderRadius: 3,
                  background: 'rgba(139, 115, 85, 0.25)',
                  marginTop: 10,
                }}
              />
            </div>

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 20px 10px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'var(--vivid-phase-glow)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--vivid-phase-accent)',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 17,
                    fontWeight: 800,
                    color: '#3D2E1F',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    background: 'var(--vivid-coral)',
                    color: '#FFFFFF',
                    fontFamily: 'var(--vivid-font-mono)',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 6px',
                  }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={closeDashboard}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  border: 'none',
                  background: 'rgba(139, 115, 85, 0.08)',
                  color: '#9B8E7E',
                  fontSize: 18,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* Divider */}
            <div
              style={{
                height: 1,
                margin: '0 20px',
                background: 'linear-gradient(90deg, transparent, rgba(139, 115, 85, 0.12), transparent)',
                flexShrink: 0,
              }}
            />

            {/* Scrollable content */}
            <div
              ref={scrollRef}
              className="vivid-hide-scrollbar"
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
                padding: '8px 12px 24px',
              }}
            >
              {/* Welcome card */}
              {showWelcome && (
                <motion.div
                  style={{
                    marginBottom: 8,
                    padding: '16px 18px 14px',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, rgba(139, 108, 193, 0.06) 0%, rgba(139, 108, 193, 0.12) 100%)',
                    border: '1px solid rgba(139, 108, 193, 0.14)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={VIVID_SPRING.gentle}
                >
                  <div style={{
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'rgba(139, 108, 193, 0.06)',
                  }} />
                  <h3 style={{
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 15,
                    fontWeight: 800,
                    color: '#7B5DAF',
                    margin: '0 0 8px',
                    letterSpacing: '0.01em',
                  }}>
                    Welcome to Pecking Order
                  </h3>
                  <p style={{
                    fontFamily: 'var(--vivid-font-body)',
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: '#5A4A3A',
                    margin: '0 0 14px',
                  }}>
                    Survive elimination votes. Earn silver through games and activities.
                    Use DMs to form alliances — but every message costs silver.
                    The last player standing wins.
                  </p>
                  <button
                    onClick={() => markWelcomeSeen()}
                    style={{
                      padding: '7px 18px',
                      borderRadius: 10,
                      background: 'rgba(139, 108, 193, 0.14)',
                      border: '1px solid rgba(139, 108, 193, 0.18)',
                      color: '#7B5DAF',
                      fontFamily: 'var(--vivid-font-display)',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Got it
                  </button>
                </motion.div>
              )}

              {/* Pending invites */}
              {pendingCount > 0 && (
                <motion.div
                  style={{
                    marginBottom: 8,
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(59, 169, 156, 0.06) 0%, rgba(59, 169, 156, 0.1) 100%)',
                    border: '1px solid rgba(59, 169, 156, 0.14)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                  }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={VIVID_SPRING.gentle}
                  onClick={handleViewInvites}
                  whileTap={{ scale: 0.97 }}
                >
                  <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    background: 'rgba(59, 169, 156, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Letter size={15} weight="Bold" color="#3BA99C" />
                  </div>
                  <span style={{
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#2D8A7F',
                    flex: 1,
                  }}>
                    {pendingCount} pending invite{pendingCount !== 1 ? 's' : ''}
                  </span>
                  <span style={{
                    fontFamily: 'var(--vivid-font-body)',
                    fontSize: 12,
                    color: '#3BA99C',
                    opacity: 0.7,
                  }}>
                    View &rsaquo;
                  </span>
                </motion.div>
              )}

              {/* Feed */}
              <div style={{ marginTop: 4 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                  paddingLeft: 4,
                }}>
                  <span style={{
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#9B8E7E',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    Feed
                  </span>
                  <div style={{
                    flex: 1,
                    height: 1,
                    background: 'rgba(155, 142, 126, 0.12)',
                  }} />
                </div>
                <FeedSection />
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
