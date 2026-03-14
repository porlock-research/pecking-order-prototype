import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectShouldAutoOpenDashboard } from '../../../store/useGameStore';
import { VOTE_TYPE_INFO, DayPhases } from '@pecking-order/shared-types';
import type { DayPhase } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../springs';

/* ------------------------------------------------------------------ */
/*  Phase config                                                       */
/* ------------------------------------------------------------------ */

interface PhaseConfig {
  title: string;
  icon: string;
  accent: string;
  bg: string;
  subtitle: string;
  body?: string;
  detail?: string;
  detailLabel?: string;
}

function buildPhaseConfig(
  phase: DayPhase,
  manifest: any,
  dayIndex: number,
  roster: Record<string, any>,
): PhaseConfig | null {
  const currentDay = manifest?.days?.[dayIndex - 1];
  const voteType = currentDay?.voteType as string | undefined;
  const voteInfo = voteType ? VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO] : null;
  const totalDays = manifest?.days?.length ?? '?';
  const aliveCount = Object.values(roster).filter((p: any) => p.isAlive).length;

  switch (phase) {
    case DayPhases.MORNING: {
      const parts: string[] = [];
      if (voteInfo) parts.push(`Vote: ${voteInfo.name}`);
      if (currentDay?.gameType && currentDay.gameType !== 'NONE') parts.push('Mini-game today');
      if (currentDay?.activityType && currentDay.activityType !== 'NONE') parts.push('Activity today');
      return {
        title: `Day ${dayIndex}`,
        icon: '\u2600\uFE0F',
        accent: '#D4960A',
        bg: 'rgba(253, 246, 238, 0.97)',
        subtitle: `${aliveCount} players remaining \u00B7 Day ${dayIndex} of ${totalDays}`,
        body: parts.length > 0
          ? parts.join(' \u00B7 ')
          : 'Chat, strategize, and prepare for tonight\u2019s vote.',
        detail: voteInfo?.howItWorks,
        detailLabel: voteInfo ? `Tonight: ${voteInfo.name}` : undefined,
      };
    }

    case DayPhases.SOCIAL:
      return {
        title: 'Social Hour',
        icon: '\uD83D\uDCAC',
        accent: '#4A9B6E',
        bg: 'rgba(245, 250, 242, 0.97)',
        subtitle: 'DMs are now open',
        body: 'Send private messages, form alliances, and gather information. Your DM slots are limited \u2014 choose wisely.',
      };

    case DayPhases.GAME:
      return {
        title: 'Game Time',
        icon: '\uD83C\uDFAE',
        accent: '#3B82C4',
        bg: 'rgba(240, 247, 250, 0.97)',
        subtitle: 'Earn silver to stay in the game',
        body: 'Play the mini-game to earn silver. Silver breaks vote ties and unlocks perks \u2014 every coin matters.',
      };

    case DayPhases.ACTIVITY:
      return {
        title: 'Activity',
        icon: '\u2728',
        accent: '#8B5CF6',
        bg: 'rgba(245, 242, 255, 0.97)',
        subtitle: 'Express yourself',
        body: 'Answer the prompt to reveal your personality and earn silver. Other players will see your response.',
      };

    case DayPhases.VOTING:
      return {
        title: 'Voting',
        icon: '\uD83D\uDDF3\uFE0F',
        accent: '#D94073',
        bg: 'rgba(255, 243, 240, 0.97)',
        subtitle: voteInfo ? voteInfo.name : 'Cast your vote',
        body: voteInfo?.description ?? 'Choose carefully \u2014 someone will be eliminated.',
        detail: voteInfo?.howItWorks,
        detailLabel: 'How it works',
      };

    case DayPhases.ELIMINATION:
      return {
        title: 'Elimination',
        icon: '\uD83C\uDF19',
        accent: '#B03A3A',
        bg: 'rgba(253, 240, 240, 0.97)',
        subtitle: 'The votes have been counted',
        body: 'See who was eliminated and check the vote breakdown in your dashboard.',
      };

    case DayPhases.FINALE:
    case DayPhases.GAME_OVER:
      return {
        title: 'Finale',
        icon: '\uD83C\uDFC6',
        accent: '#D4960A',
        bg: 'rgba(255, 248, 225, 0.97)',
        subtitle: 'The game is over',
        body: 'The winner has been decided. Check the dashboard for the full results.',
      };

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PhaseTransitionSplash() {
  const phase = useGameStore(s => s.phase);
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);
  const roster = useGameStore(s => s.roster);
  const shouldAutoOpen = useGameStore(selectShouldAutoOpenDashboard);
  const openDashboard = useGameStore(s => s.openDashboard);
  const markDashboardSeen = useGameStore(s => s.markDashboardSeen);

  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<PhaseConfig | null>(null);
  const prevPhaseRef = useRef<DayPhase>(phase);
  const hasInitialized = useRef(false);
  const shouldOpenDashboardRef = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      prevPhaseRef.current = phase;
      return;
    }

    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      const c = buildPhaseConfig(phase, manifest, dayIndex, roster);
      if (c) {
        setConfig(c);
        shouldOpenDashboardRef.current = shouldAutoOpen;
        setVisible(true);
      }
    }
  }, [phase, manifest, dayIndex, roster, shouldAutoOpen]);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const handleExitComplete = () => {
    if (shouldOpenDashboardRef.current) {
      shouldOpenDashboardRef.current = false;
      openDashboard();
      markDashboardSeen(dayIndex);
    }
  };

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {visible && config && (
        <motion.div
          onClick={dismiss}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: config.bg,
            pointerEvents: 'auto',
            cursor: 'pointer',
            padding: '24px 28px',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Icon */}
          <motion.div
            style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={VIVID_SPRING.dramatic}
          >
            {config.icon}
          </motion.div>

          {/* Title */}
          <motion.span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 34,
              fontWeight: 800,
              color: config.accent,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              textAlign: 'center',
              lineHeight: 1.1,
            }}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={VIVID_SPRING.dramatic}
          >
            {config.title}
          </motion.span>

          {/* Subtitle */}
          <motion.span
            style={{
              fontFamily: 'var(--vivid-font-body)',
              fontSize: 15,
              fontWeight: 600,
              color: config.accent,
              textAlign: 'center',
              marginTop: 6,
              opacity: 0.75,
              letterSpacing: '0.02em',
            }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 0.75, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            {config.subtitle}
          </motion.span>

          {/* Divider */}
          <motion.div
            style={{
              width: 48,
              height: 3,
              borderRadius: 2,
              background: config.accent,
              marginTop: 18,
              marginBottom: 18,
              opacity: 0.3,
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ ...VIVID_SPRING.bouncy, delay: 0.1 }}
          />

          {/* Body */}
          {config.body && (
            <motion.p
              style={{
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 16,
                fontWeight: 400,
                color: '#3D2E1F',
                textAlign: 'center',
                lineHeight: 1.5,
                maxWidth: 320,
                margin: 0,
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              {config.body}
            </motion.p>
          )}

          {/* Detail block (e.g. howItWorks for voting) */}
          {config.detail && (
            <motion.div
              style={{
                marginTop: 20,
                padding: '14px 18px',
                borderRadius: 12,
                background: `${config.accent}10`,
                border: `1px solid ${config.accent}20`,
                maxWidth: 320,
                width: '100%',
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.3 }}
            >
              {config.detailLabel && (
                <span
                  style={{
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: config.accent,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  {config.detailLabel}
                </span>
              )}
              <span
                style={{
                  fontFamily: 'var(--vivid-font-body)',
                  fontSize: 14,
                  fontWeight: 400,
                  color: '#3D2E1F',
                  lineHeight: 1.5,
                }}
              >
                {config.detail}
              </span>
            </motion.div>
          )}

          {/* Tap hint */}
          <motion.span
            style={{
              fontFamily: 'var(--vivid-font-body)',
              fontSize: 12,
              fontWeight: 500,
              color: '#9A8A7A',
              marginTop: 28,
              letterSpacing: '0.04em',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            Tap anywhere to continue
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
