import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectShouldAutoOpenDashboard } from '../../../store/useGameStore';
import { VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../springs';

function getPhaseDisplayName(serverState: unknown): string | null {
  if (!serverState || typeof serverState !== 'string') return null;
  const s = serverState.toLowerCase();
  if (s.includes('morningbriefing')) return 'MORNING BRIEFING';
  if (s.includes('socialperiod') || s.includes('dmperiod')) return 'SOCIAL HOUR';
  if (s.includes('game')) return 'GAME TIME';
  if (s.includes('prompt') || s.includes('activity')) return 'ACTIVITY';
  if (s.includes('voting')) return 'VOTING';
  if (s.includes('nightsummary')) return 'ELIMINATION';
  if (s.includes('gamesummary') || s.includes('gameover')) return 'FINALE';
  return null;
}

function getPhaseSubtitle(serverState: unknown, manifest: any, dayIndex: number): string | null {
  if (!serverState || typeof serverState !== 'string') return null;
  const s = serverState.toLowerCase();
  const currentDay = manifest?.days?.[dayIndex - 1];
  const voteType = currentDay?.voteType;

  if (s.includes('morningbriefing') || s.includes('socialperiod')) {
    if (voteType) {
      const info = VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO];
      if (info) return `Today's vote: ${info.name}`;
    }
    return 'A new day begins';
  }
  if (s.includes('voting')) {
    if (voteType) {
      const info = VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO];
      if (info) return info.description;
    }
    return 'Choose wisely';
  }
  if (s.includes('game')) return 'Time to earn some silver';
  if (s.includes('prompt') || s.includes('activity')) return 'Show them who you are';
  if (s.includes('nightsummary')) return 'The votes have been counted';
  if (s.includes('gamesummary') || s.includes('gameover')) return 'The game is over';
  return null;
}

function getPhaseBackgroundColor(serverState: unknown): string {
  if (!serverState || typeof serverState !== 'string') return 'rgba(253, 248, 240, 0.95)';
  const s = serverState.toLowerCase();
  if (s.includes('morningbriefing')) return 'rgba(253, 246, 238, 0.95)';
  if (s.includes('socialperiod') || s.includes('dmperiod')) return 'rgba(245, 250, 242, 0.95)';
  if (s.includes('game')) return 'rgba(240, 247, 250, 0.95)';
  if (s.includes('voting')) return 'rgba(255, 248, 237, 0.95)';
  if (s.includes('nightsummary')) return 'rgba(253, 242, 240, 0.95)';
  if (s.includes('gamesummary') || s.includes('gameover')) return 'rgba(255, 248, 225, 0.95)';
  return 'rgba(253, 248, 240, 0.95)';
}

export function PhaseTransitionSplash() {
  const serverState = useGameStore(s => s.serverState);
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);
  const shouldAutoOpen = useGameStore(selectShouldAutoOpenDashboard);
  const openDashboard = useGameStore(s => s.openDashboard);
  const markDashboardSeen = useGameStore(s => s.markDashboardSeen);

  const [visible, setVisible] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const prevStateRef = useRef<unknown>(serverState);
  const hasInitialized = useRef(false);
  const shouldOpenDashboardRef = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      prevStateRef.current = serverState;
      return;
    }

    if (serverState !== prevStateRef.current) {
      prevStateRef.current = serverState;
      const name = getPhaseDisplayName(serverState);
      if (name) {
        setDisplayName(name);
        setSubtitle(getPhaseSubtitle(serverState, manifest, dayIndex));
        shouldOpenDashboardRef.current = shouldAutoOpen;
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [serverState, manifest, dayIndex, shouldAutoOpen]);

  const handleExitComplete = () => {
    if (shouldOpenDashboardRef.current) {
      shouldOpenDashboardRef.current = false;
      openDashboard();
      markDashboardSeen(dayIndex);
    }
  };

  const bgColor = getPhaseBackgroundColor(serverState);

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {visible && displayName && (
        <motion.div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: bgColor,
            pointerEvents: 'none',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Decorative bar */}
          <motion.div
            style={{
              width: 60,
              height: 4,
              borderRadius: 2,
              background: 'var(--vivid-phase-accent)',
              marginBottom: 16,
              opacity: 0.5,
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ ...VIVID_SPRING.bouncy, delay: 0.1 }}
          />

          <motion.span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 36,
              fontWeight: 800,
              color: 'var(--vivid-phase-accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textAlign: 'center',
            }}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={VIVID_SPRING.dramatic}
          >
            {displayName}
          </motion.span>

          {/* Contextual subtitle */}
          {subtitle && (
            <motion.span
              style={{
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 16,
                fontWeight: 500,
                color: 'var(--vivid-text-dim)',
                textAlign: 'center',
                marginTop: 8,
                maxWidth: '80%',
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              {subtitle}
            </motion.span>
          )}

          {/* Decorative bar below */}
          <motion.div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: 'var(--vivid-phase-accent)',
              marginTop: 16,
              opacity: 0.3,
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ ...VIVID_SPRING.bouncy, delay: 0.2 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
