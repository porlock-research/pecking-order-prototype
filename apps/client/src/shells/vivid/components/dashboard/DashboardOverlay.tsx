import React, { useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, type PanInfo } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { DayBriefing } from './DayBriefing';
import { DayTimeline } from './DayTimeline';
import { VIVID_SPRING } from '../../springs';
import { Letter } from '@solar-icons/react';

const DISMISS_THRESHOLD = -80;

export function DashboardOverlay() {
  const dashboardOpen = useGameStore(s => s.dashboardOpen);
  const closeDashboard = useGameStore(s => s.closeDashboard);
  const welcomeSeen = useGameStore(s => s.welcomeSeen);
  const markWelcomeSeen = useGameStore(s => s.markWelcomeSeen);
  const dayIndex = useGameStore(s => s.dayIndex);
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
              maxHeight: '82vh',
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
                padding: '4px 20px 14px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                }}
              >
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
                  Today's Briefing
                </span>
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
              {/* Welcome card */}
              {showWelcome && (
                <motion.div
                  style={{
                    marginTop: 16,
                    padding: '18px 18px 16px',
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
                  {/* Decorative corner accent */}
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
                    marginTop: 12,
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

              {/* Day briefing */}
              <DayBriefing />

              {/* Timeline */}
              <DayTimeline />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
