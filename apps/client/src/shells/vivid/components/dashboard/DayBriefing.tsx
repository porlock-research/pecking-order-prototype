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
  const aliveCount = Object.values(roster).filter((p: any) => p.status === 'ALIVE').length;
  const currentDay = manifest.days?.[dayIndex - 1];
  const voteType = currentDay?.voteType;
  const voteName = voteType ? VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO]?.name : null;

  const parts: string[] = [];
  parts.push(`Day ${dayIndex}${totalDays > 0 ? ` of ${totalDays}` : ''}.`);
  parts.push(`${aliveCount} player${aliveCount !== 1 ? 's' : ''} remain.`);
  if (voteName) parts.push(`Today: ${voteName}.`);

  return (
    <motion.div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(155,142,126,0.1)',
      }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
    >
      <p
        style={{
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 15,
          lineHeight: 1.5,
          color: 'var(--vivid-text)',
          margin: 0,
        }}
      >
        {parts.join(' ')}
      </p>
    </motion.div>
  );
}
