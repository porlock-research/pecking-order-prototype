import React from 'react';
import type { TickerMessage } from '@pecking-order/shared-types';

const CATEGORY_COLORS: Record<string, string> = {
  ELIMINATION: 'text-skin-danger',
  VOTE: 'text-skin-gold',
  GAME: 'text-skin-green',
  SOCIAL: 'text-skin-pink',
  SYSTEM: 'text-skin-dim/60',
};

export const TimelineSystemEvent: React.FC<{ message: TickerMessage }> = ({ message }) => {
  const color = CATEGORY_COLORS[message.category] || 'text-skin-dim/60';

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 select-none">
      <div className="flex-1 h-px bg-white/[0.06]" />
      <span className={`text-[10px] font-mono uppercase tracking-wider whitespace-nowrap ${color}`}>
        {message.text}
      </span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
};
