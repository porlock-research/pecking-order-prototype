import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { DayPhases, buildPhaseInfo } from '@pecking-order/shared-types';
import type { DayPhase } from '@pecking-order/shared-types';
import { Sun2, ChatRound, Gamepad, MagicStick3, Flag, Moon, CupStar } from '@solar-icons/react';
import { VIVID_SPRING } from '../springs';

/* ------------------------------------------------------------------ */
/*  Phase config                                                       */
/* ------------------------------------------------------------------ */

interface PhaseConfig {
  title: string;
  icon: React.ComponentType<any>;
  accent: string;
  bg: string;
  subtitle: string;
  body?: string;
  detail?: string;
  detailLabel?: string;
}

/** Visual config per phase — accent, bg, icon. Text comes from buildPhaseInfo(). */
const PHASE_VISUALS: Record<string, { icon: React.ComponentType<any>; accent: string; bg: string }> = {
  [DayPhases.MORNING]:     { icon: Sun2,        accent: '#D4960A', bg: 'rgba(253, 246, 238, 0.97)' },
  [DayPhases.SOCIAL]:      { icon: ChatRound,   accent: '#4A9B6E', bg: 'rgba(245, 250, 242, 0.97)' },
  [DayPhases.GAME]:        { icon: Gamepad,      accent: '#3B82C4', bg: 'rgba(240, 247, 250, 0.97)' },
  [DayPhases.ACTIVITY]:    { icon: MagicStick3,  accent: '#8B5CF6', bg: 'rgba(245, 242, 255, 0.97)' },
  [DayPhases.VOTING]:      { icon: Flag,         accent: '#D94073', bg: 'rgba(255, 243, 240, 0.97)' },
  [DayPhases.ELIMINATION]: { icon: Moon,         accent: '#B03A3A', bg: 'rgba(253, 240, 240, 0.97)' },
  [DayPhases.FINALE]:      { icon: CupStar,      accent: '#D4960A', bg: 'rgba(255, 248, 225, 0.97)' },
  [DayPhases.GAME_OVER]:   { icon: CupStar,      accent: '#D4960A', bg: 'rgba(255, 248, 225, 0.97)' },
};

function buildPhaseConfig(
  phase: DayPhase,
  manifest: any,
  dayIndex: number,
  roster: Record<string, any>,
  dmsOpen?: boolean,
): PhaseConfig | null {
  const currentDay = manifest?.days?.[dayIndex - 1];
  // Static manifests: days pre-populated. Dynamic FIXED: use fixedCount/value.
  // Dynamic ACTIVE_PLAYERS_MINUS_ONE: total changes each day, don't show.
  const dc = manifest?.ruleset?.dayCount;
  const totalDays = dc
    ? (dc.mode === 'FIXED' ? (dc.fixedCount ?? dc.value) : undefined)
    : (manifest?.days?.length || undefined);
  const aliveCount = Object.values(roster).filter((p: any) => p.isAlive).length;

  const info = buildPhaseInfo(phase, {
    dayIndex,
    aliveCount,
    totalDays,
    voteType: currentDay?.voteType,
    gameType: currentDay?.gameType,
    activityType: currentDay?.activityType,
    dmsOpen,
  });

  if (!info) return null;

  const visuals = PHASE_VISUALS[phase] ?? PHASE_VISUALS[DayPhases.MORNING];

  return {
    ...info,
    icon: visuals.icon,
    accent: visuals.accent,
    bg: visuals.bg,
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PhaseTransitionSplash() {
  const phase = useGameStore(s => s.phase);
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);
  const roster = useGameStore(s => s.roster);
  const dmsOpen = useGameStore(s => s.dmsOpen);
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<PhaseConfig | null>(null);
  const prevPhaseRef = useRef<DayPhase>(phase);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      prevPhaseRef.current = phase;
      return;
    }

    if (phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase;
      const c = buildPhaseConfig(phase, manifest, dayIndex, roster, dmsOpen);
      if (c) {
        setConfig(c);
        setVisible(true);
      }
    }
  }, [phase, manifest, dayIndex, roster]);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const handleExitComplete = () => {
    // Schedule now lives in its own tab — no need to auto-open
    // the notifications panel after dismissing the splash.
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
            style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={VIVID_SPRING.dramatic}
          >
            <config.icon size={48} weight="Bold" color={config.accent} />
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
