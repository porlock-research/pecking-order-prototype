import React, { useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, type PanInfo } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { DayBriefing } from './DayBriefing';
import { DayTimeline } from './DayTimeline';
import { VIVID_SPRING } from '../../springs';
import { ClockCircle, Letter } from '@solar-icons/react';

const DISMISS_THRESHOLD = -80; // px upward drag to dismiss

export function DashboardOverlay() {
  const dashboardOpen = useGameStore(s => s.dashboardOpen);
  const closeDashboard = useGameStore(s => s.closeDashboard);
  const welcomeSeen = useGameStore(s => s.welcomeSeen);
  const markWelcomeSeen = useGameStore(s => s.markWelcomeSeen);
  const dayIndex = useGameStore(s => s.dayIndex);
  // Derive count directly — avoids new array reference on every render
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
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeDashboard}
          />

          {/* Overlay panel */}
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
              background: 'var(--vivid-bg-base)',
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
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
            {/* Drag handle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '12px 0 4px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(155,142,126,0.3)',
                }}
              />
            </div>

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 20px 12px',
                borderBottom: '1px solid rgba(155,142,126,0.1)',
                flexShrink: 0,
              }}
            >
              <ClockCircle size={18} weight="Bold" color="var(--vivid-phase-accent)" />
              <span
                style={{
                  fontFamily: 'var(--vivid-font-display)',
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--vivid-text)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  flex: 1,
                }}
              >
                Today
              </span>
            </div>

            {/* Scrollable content */}
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {/* Welcome card (first launch) */}
              {showWelcome && (
                <motion.div
                  style={{
                    margin: '16px 16px 0',
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(139,108,193,0.08)',
                    border: '1px solid rgba(139,108,193,0.15)',
                  }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={VIVID_SPRING.gentle}
                >
                  <h3 style={{
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#8B6CC1',
                    margin: '0 0 8px',
                  }}>
                    Welcome to Pecking Order
                  </h3>
                  <p style={{
                    fontFamily: 'var(--vivid-font-body)',
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: 'var(--vivid-text)',
                    margin: 0,
                  }}>
                    Survive elimination votes. Earn silver through games and activities.
                    Use DMs to form alliances — but every message costs silver.
                    The last player standing wins.
                  </p>
                  <button
                    onClick={() => markWelcomeSeen()}
                    style={{
                      marginTop: 12,
                      padding: '6px 14px',
                      borderRadius: 9999,
                      background: 'rgba(139,108,193,0.15)',
                      border: '1px solid rgba(139,108,193,0.2)',
                      color: '#8B6CC1',
                      fontFamily: 'var(--vivid-font-display)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Got it
                  </button>
                </motion.div>
              )}

              {/* Pending invites badge */}
              {pendingCount > 0 && (
                <motion.div
                  style={{
                    margin: '12px 16px 0',
                    padding: '10px 16px',
                    borderRadius: 12,
                    background: 'rgba(59,169,156,0.08)',
                    border: '1px solid rgba(59,169,156,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                  }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={VIVID_SPRING.gentle}
                  onClick={() => {
                    closeDashboard();
                  }}
                >
                  <Letter size={18} weight="Bold" color="#3BA99C" />
                  <span style={{
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#3BA99C',
                  }}>
                    {pendingCount} pending invite{pendingCount !== 1 ? 's' : ''}
                  </span>
                </motion.div>
              )}

              {/* Day briefing */}
              <DayBriefing />

              {/* Day timeline */}
              <DayTimeline />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
