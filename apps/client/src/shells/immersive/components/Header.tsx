import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { PushPrompt } from '../../../components/PushPrompt';
import { formatPhase } from '../../../utils/formatState';
import { Coins, Trophy, ChevronDown, Settings } from 'lucide-react';
import { PlayerStatuses } from '@pecking-order/shared-types';
import { SPRING, TAP } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface HeaderProps {
  token: string | null;
}

export function Header({ token }: HeaderProps) {
  const { roster, goldPool, playerId, dayIndex, serverState, gameId } = useGameStore();
  const onlineCount = useGameStore(s => s.onlinePlayers.length);
  const me = playerId ? roster[playerId] : null;
  const [expanded, setExpanded] = useState(false);

  const aliveCount = Object.values(roster).filter(p => p.status === PlayerStatuses.ALIVE).length;
  const totalCount = Object.values(roster).length;
  const phase = formatPhase(serverState);

  // Auto-collapse after 4s
  useEffect(() => {
    if (!expanded) return;
    const timer = setTimeout(() => setExpanded(false), 4000);
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
        <div className="flex items-center gap-2.5">
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
        <div className="flex items-center gap-2.5">
          <PushPrompt token={token} />
          <div className="flex items-center gap-1 px-2.5 py-1 min-h-[32px] rounded-pill bg-skin-green/10 border border-skin-green/20">
            <span className="w-2 h-2 rounded-full bg-skin-green animate-pulse-live" />
            <span className="text-[11px] font-mono text-skin-green font-bold">{onlineCount}</span>
          </div>
          {me && (
            <PersonaAvatar avatarUrl={me.avatarUrl} personaName={me.personaName} size={36} isOnline={true} />
          )}
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
            <div className="px-4 pb-3 pt-2 border-t border-white/[0.04]">
              {/* Status row: Day · Phase · Alive */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-skin-gold">DAY {dayIndex} <span className="text-skin-pink font-display uppercase tracking-wider">{phase}</span></span>
                <span className="text-[11px] font-mono text-skin-dim">
                  {aliveCount}/{totalCount} alive
                </span>
              </div>
              {/* Currency grid */}
              {me && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                    <Coins size={13} className="text-skin-gold shrink-0" />
                    <span className="font-mono font-bold text-skin-gold text-sm">{me.silver}</span>
                    <span className="text-[9px] font-mono text-skin-dim">silver</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                    <Trophy size={13} className="text-amber-400 shrink-0" />
                    <span className="font-mono font-bold text-amber-400 text-sm">{goldPool}</span>
                    <span className="text-[9px] font-mono text-skin-dim">pool</span>
                  </div>
                  {(me.gold ?? 0) > 0 && (
                    <div className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-2.5 py-1.5">
                      <Trophy size={13} className="text-amber-400 shrink-0" />
                      <span className="font-mono font-bold text-amber-400 text-sm">{me.gold}</span>
                      <span className="text-[9px] font-mono text-skin-dim">gold</span>
                    </div>
                  )}
                </div>
              )}
              {/* Admin link — dev only */}
              {import.meta.env.DEV && gameId && (
                <a
                  href={`${import.meta.env.VITE_LOBBY_HOST || 'http://localhost:3000'}/admin/game/${gameId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-skin-dim hover:text-skin-base transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <Settings size={12} />
                  <span>Admin Panel</span>
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
