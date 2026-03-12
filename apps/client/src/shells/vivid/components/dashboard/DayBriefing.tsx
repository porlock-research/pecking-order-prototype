import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../../springs';

export function DayBriefing() {
  const dayIndex = useGameStore(s => s.dayIndex);
  const manifest = useGameStore(s => s.manifest);
  const roster = useGameStore(s => s.roster);

  if (!manifest || dayIndex === 0) return null;

  const totalDays = manifest.days?.length ?? 0;
  const aliveCount = Object.values(roster).filter((p: any) => p.isAlive || p.status === 'ALIVE').length;
  const currentDay = manifest.days?.[dayIndex - 1];
  const voteType = currentDay?.voteType;
  const voteName = voteType ? VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO]?.name : null;

  return (
    <motion.div
      style={{
        marginTop: 16,
        padding: '16px 18px',
        borderRadius: 16,
        background: '#F5EDE0',
        border: '1px solid rgba(139, 115, 85, 0.08)',
      }}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
    >
      {/* Day counter */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 10,
      }}>
        <span style={{
          fontFamily: 'var(--vivid-font-display)',
          fontSize: 28,
          fontWeight: 800,
          color: '#3D2E1F',
          lineHeight: 1,
        }}>
          {dayIndex}
        </span>
        <span style={{
          fontFamily: 'var(--vivid-font-display)',
          fontSize: 12,
          fontWeight: 700,
          color: '#9B8E7E',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {totalDays > 0 ? `of ${totalDays} days` : 'day'}
        </span>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        {/* Players alive */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#6B9E6E',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--vivid-font-body)',
            fontSize: 13,
            color: '#5A4A3A',
            fontWeight: 500,
          }}>
            {aliveCount} player{aliveCount !== 1 ? 's' : ''} remain
          </span>
        </div>

        {/* Vote type */}
        {voteName && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#E89B3A',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'var(--vivid-font-body)',
              fontSize: 13,
              color: '#5A4A3A',
              fontWeight: 500,
            }}>
              {voteName}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
