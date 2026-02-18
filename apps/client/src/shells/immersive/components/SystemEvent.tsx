import React from 'react';
import { motion } from 'framer-motion';
import type { TickerMessage } from '@pecking-order/shared-types';

function getCategoryColor(category: string): string {
  if (category === 'ELIMINATION') return 'text-skin-danger';
  if (category === 'VOTE') return 'text-skin-gold';
  if (category === 'GAME' || category === 'GAME.REWARD') return 'text-skin-green';
  if (category === 'ACTIVITY') return 'text-skin-pink';
  const prefix = category.split('.')[0];
  if (prefix === 'PHASE') return 'text-skin-dim/80';
  if (prefix === 'SOCIAL') return 'text-skin-pink';
  return 'text-skin-dim/60';
}

function getDividerColor(category: string): string {
  if (category === 'ELIMINATION') return 'bg-skin-danger/10';
  if (category === 'VOTE') return 'bg-skin-gold/10';
  if (category === 'GAME' || category === 'GAME.REWARD') return 'bg-skin-green/10';
  if (category === 'ACTIVITY') return 'bg-skin-pink/10';
  const prefix = category.split('.')[0];
  if (prefix === 'SOCIAL') return 'bg-skin-pink/10';
  return 'bg-white/[0.06]';
}

export function SystemEvent({ message }: { message: TickerMessage }) {
  const color = getCategoryColor(message.category);
  const dividerColor = getDividerColor(message.category);

  return (
    <motion.div
      className="flex items-center gap-3 py-1.5 px-2 select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className={`flex-1 h-px ${dividerColor}`} />
      <span className={`text-[10px] font-mono uppercase tracking-wider whitespace-nowrap ${color}`}>
        {message.text}
      </span>
      <div className={`flex-1 h-px ${dividerColor}`} />
    </motion.div>
  );
}
