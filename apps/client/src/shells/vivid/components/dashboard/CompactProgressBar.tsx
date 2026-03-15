import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { DayPhases } from '@pecking-order/shared-types';

const PHASE_LABELS = ['Morning', 'Social', 'Game', 'Activity', 'Voting', 'Night'] as const;

const PHASE_TO_INDEX: Record<string, number> = {
  [DayPhases.MORNING]: 0,
  [DayPhases.SOCIAL]: 1,
  [DayPhases.GAME]: 2,
  [DayPhases.ACTIVITY]: 3,
  [DayPhases.VOTING]: 4,
  [DayPhases.ELIMINATION]: 5,
};

export function CompactProgressBar({ variant = 'full' }: { variant?: 'full' | 'slim' }) {
  const phase = useGameStore(s => s.phase);
  const dayIndex = useGameStore(s => s.dayIndex);
  const manifest = useGameStore(s => s.manifest);

  const totalDays = manifest?.days?.length ?? 0;
  const activeIdx = PHASE_TO_INDEX[phase] ?? -1;

  return (
    <div style={{ padding: variant === 'slim' ? '8px 16px' : '0 20px 12px' }}>
      {/* Day indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        marginBottom: variant === 'slim' ? 6 : 10,
      }}>
        <span style={{
          fontFamily: 'var(--vivid-font-display)',
          fontSize: variant === 'slim' ? 15 : 22,
          fontWeight: 800,
          color: '#3D2E1F',
          lineHeight: 1,
        }}>
          Day {dayIndex}
        </span>
        {totalDays > 0 && (
          <span style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: variant === 'slim' ? 10 : 12,
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
        height: variant === 'slim' ? 4 : 6,
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
