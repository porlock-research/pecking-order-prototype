import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { PushPrompt } from '../../../components/PushPrompt';
import { formatPhase } from '../../../utils/formatState';
import { Coins, Trophy, ChevronDown } from 'lucide-react';
import { PlayerStatuses } from '@pecking-order/shared-types';
import { SPRING, TAP } from '../springs';

interface HeaderProps {
  token: string | null;
}

export function Header({ token }: HeaderProps) {
  const { roster, goldPool, playerId, dayIndex, serverState } = useGameStore();
  const onlineCount = useGameStore(s => s.onlinePlayers.length);
  const me = playerId ? roster[playerId] : null;
  const [expanded, setExpanded] = useState(false);

  const aliveCount = Object.values(roster).filter(p => p.status === PlayerStatuses.ALIVE).length;
  const totalCount = Object.values(roster).length;
  const phase = formatPhase(serverState);

  // Auto-collapse after 3s
  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => setExpanded(false), 3000);
    return () => clearTimeout(timer);
  }, [expanded]);

  const toggleExpand = useCallback(() => setExpanded(e => !e), []);

  return (
    <header className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-b border-white/[0.06] shadow-card z-50">
      <motion.button
        className="w-full px-4 py-2 flex items-center justify-between"
        onClick={toggleExpand}
        whileTap={TAP.card}
      >
        <div className="flex items-center gap-2">
          <h1 className="text-base font-black font-display tracking-tighter text-skin-gold italic text-glow leading-none">
            PO
          </h1>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={SPRING.snappy}
          >
            <ChevronDown size={14} className="text-skin-dim" />
          </motion.div>
        </div>
        <div className="flex items-center gap-2">
          <PushPrompt token={token} />
          <div className="flex items-center gap-1 px-2.5 py-1 min-h-[32px] rounded-pill bg-skin-green/10 border border-skin-green/20">
            <span className="w-2 h-2 rounded-full bg-skin-green animate-pulse-live" />
            <span className="text-[11px] font-mono text-skin-green font-bold">{onlineCount}</span>
          </div>
          {me && (
            <div className="flex items-center gap-1 px-2.5 py-1 min-h-[32px] rounded-pill bg-skin-gold/10 border border-skin-gold/20">
              <Coins size={12} className="text-skin-dim" />
              <span className="font-mono font-bold text-skin-gold text-sm">{me.silver}</span>
            </div>
          )}
          <div className="flex items-center gap-1 px-2.5 py-1 min-h-[32px] rounded-pill bg-amber-500/10 border border-amber-500/20">
            <Trophy size={12} className="text-amber-400" />
            <span className="font-mono font-bold text-amber-400 text-sm">{goldPool}</span>
          </div>
        </div>
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING.snappy}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-white/[0.04]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-skin-gold">DAY {dayIndex + 1}</span>
                <span className="text-xs font-display font-bold text-skin-pink uppercase tracking-wider">{phase}</span>
              </div>
              <span className="text-xs font-mono text-skin-dim">
                {aliveCount} of {totalCount} alive
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
