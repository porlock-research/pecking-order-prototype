import React, { useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, type PanInfo } from 'framer-motion';
import { useGameStore, selectUnreadFeedCount } from '../../../../store/useGameStore';
import { DayTimeline } from './DayTimeline';
import { VIVID_SPRING } from '../../springs';
import { Letter } from '@solar-icons/react';

const DISMISS_THRESHOLD = -80;

/* ------------------------------------------------------------------ */
/*  Compact Progress Bar                                               */
/* ------------------------------------------------------------------ */

const PHASE_LABELS = ['Morning', 'Social', 'Game', 'Activity', 'Voting', 'Night'] as const;

function getActivePhaseIndex(serverState: unknown): number {
  if (!serverState || typeof serverState !== 'string') return -1;
  const s = serverState.toLowerCase();
  if (s.includes('morningbriefing')) return 0;
  if (s.includes('socialperiod') || s.includes('dmperiod')) return 1;
  if (s.includes('game')) return 2;
  if (s.includes('prompt') || s.includes('activity')) return 3;
  if (s.includes('voting')) return 4;
  if (s.includes('nightsummary')) return 5;
  return -1;
}

function CompactProgressBar() {
  const serverState = useGameStore(s => s.serverState);
  const dayIndex = useGameStore(s => s.dayIndex);
  const manifest = useGameStore(s => s.manifest);

  const totalDays = manifest?.days?.length ?? 0;
  const activeIdx = getActivePhaseIndex(serverState);

  return (
    <div style={{ padding: '0 20px 12px' }}>
      {/* Day indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        marginBottom: 10,
      }}>
        <span style={{
          fontFamily: 'var(--vivid-font-display)',
          fontSize: 22,
          fontWeight: 800,
          color: '#3D2E1F',
          lineHeight: 1,
        }}>
          Day {dayIndex}
        </span>
        {totalDays > 0 && (
          <span style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 12,
            fontWeight: 700,
            color: '#9B8E7E',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            of {totalDays}
          </span>
        )}
      </div>

      {/* Phase segments */}
      <div style={{
        display: 'flex',
        gap: 3,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        {PHASE_LABELS.map((label, i) => {
          const isActive = i === activeIdx;
          const isCompleted = activeIdx > i;
          return (
            <div
              key={label}
              style={{
                flex: 1,
                borderRadius: 3,
                background: isActive
                  ? 'var(--vivid-phase-accent)'
                  : isCompleted
                    ? 'rgba(107, 158, 110, 0.5)'
                    : 'rgba(139, 115, 85, 0.1)',
                transition: 'background 0.3s ease',
                position: 'relative',
              }}
            >
              {isActive && (
                <motion.div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 3,
                    background: 'var(--vivid-phase-accent)',
                  }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Phase labels */}
      <div style={{
        display: 'flex',
        gap: 3,
        marginTop: 4,
      }}>
        {PHASE_LABELS.map((label, i) => {
          const isActive = i === activeIdx;
          return (
            <span
              key={label}
              style={{
                flex: 1,
                textAlign: 'center',
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 9,
                fontWeight: isActive ? 800 : 600,
                color: isActive ? 'var(--vivid-phase-accent)' : 'rgba(139, 115, 85, 0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feed Item                                                          */
/* ------------------------------------------------------------------ */

function FeedItem({
  text,
  timestamp,
  isUnread,
  category,
}: {
  text: string;
  timestamp: number;
  isUnread: boolean;
  category: string;
}) {
  const relTime = useMemo(() => {
    const diff = Date.now() - timestamp;
    if (diff < 60_000) return 'now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
    return `${Math.floor(diff / 86400_000)}d`;
  }, [timestamp]);

  const dotColor = useMemo(() => {
    const c = category.toUpperCase();
    if (c.includes('VOTE') || c.includes('ELIMINATION')) return '#D94073';
    if (c.includes('TRANSFER') || c.includes('GOLD')) return '#D4960A';
    if (c.includes('GAME') || c.includes('ACTIVITY')) return '#8B6CC1';
    if (c.includes('SOCIAL') || c.includes('PERK')) return '#3BA99C';
    return 'var(--vivid-phase-accent)';
  }, [category]);

  return (
    <motion.div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 0',
        borderBottom: '1px solid rgba(139, 115, 85, 0.06)',
        position: 'relative',
      }}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={VIVID_SPRING.gentle}
    >
      {/* Unread indicator + category dot */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: isUnread ? dotColor : 'rgba(139, 115, 85, 0.15)',
        marginTop: 5,
        flexShrink: 0,
        transition: 'background 0.3s ease',
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 14,
          lineHeight: 1.45,
          color: isUnread ? '#3D2E1F' : '#5A4A3A',
          fontWeight: isUnread ? 600 : 400,
        }}>
          {text}
        </p>
      </div>

      {/* Relative time */}
      <span style={{
        flexShrink: 0,
        fontFamily: 'var(--vivid-font-mono)',
        fontSize: 11,
        color: 'var(--vivid-text-dim)',
        marginTop: 2,
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

  // Show newest first, limit to 50
  const feedItems = useMemo(
    () => [...tickerMessages].reverse().slice(0, 50),
    [tickerMessages],
  );

  if (feedItems.length === 0) {
    return (
      <div style={{
        padding: '24px 0',
        textAlign: 'center',
      }}>
        <p style={{
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 14,
          color: '#9B8E7E',
          margin: 0,
          fontStyle: 'italic',
        }}>
          No events yet — check back soon
        </p>
      </div>
    );
  }

  return (
    <div>
      {feedItems.map((msg) => (
        <FeedItem
          key={msg.id}
          text={msg.text}
          timestamp={msg.timestamp}
          isUnread={msg.timestamp > lastSeenFeedTimestamp}
          category={msg.category}
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

  // Mark feed as seen when opening
  const handleOpen = useCallback(() => {
    markFeedSeen();
  }, [markFeedSeen]);

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
                padding: '0 16px 24px',
              }}
            >
              {/* Compact Progress Bar */}
              <div style={{ marginTop: 14 }}>
                <CompactProgressBar />
              </div>

              {/* Welcome card */}
              {showWelcome && (
                <motion.div
                  style={{
                    marginTop: 4,
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
                    marginTop: 4,
                    marginBottom: 8,
                    padding: '12px 16px',
                    borderRadius: 14,
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
                  onClick={() => closeDashboard()}
                  whileTap={{ scale: 0.97 }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'rgba(59, 169, 156, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Letter size={16} weight="Bold" color="#3BA99C" />
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

              {/* Feed section */}
              <div style={{ marginTop: 8 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
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

              {/* Schedule section */}
              <DayTimeline />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
