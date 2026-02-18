import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from 'vaul';
import { useGameStore } from '../../../store/useGameStore';
import { PERK_COSTS, PlayerStatuses } from '@pecking-order/shared-types';
import { Eye, UserPlus, FileText, Coins, X, Check, Sparkles } from 'lucide-react';

interface PerkFABProps {
  engine: {
    sendPerk: (perkType: string, targetId?: string) => void;
  };
}

const PERK_INFO = [
  { type: 'SPY_DMS' as const, label: 'Spy DMs', desc: 'See last 3 DMs of a player', icon: Eye },
  { type: 'EXTRA_DM_PARTNER' as const, label: 'Extra Partner', desc: '+1 DM partner for today', icon: UserPlus },
  { type: 'EXTRA_DM_CHARS' as const, label: 'Extra Chars', desc: '+300 DM characters for today', icon: FileText },
] as const;

export function PerkFAB({ engine }: PerkFABProps) {
  const [open, setOpen] = useState(false);
  const [pickingTarget, setPickingTarget] = useState<string | null>(null);
  const playerId = useGameStore(s => s.playerId);
  const roster = useGameStore(s => s.roster);
  const lastPerkResult = useGameStore(s => s.lastPerkResult);
  const clearPerkResult = useGameStore(s => s.clearPerkResult);

  const mySilver = playerId ? (roster[playerId]?.silver ?? 0) : 0;
  const alivePlayers = Object.values(roster).filter(
    (p: any) => p.id !== playerId && p.status === PlayerStatuses.ALIVE
  );

  const handlePerk = (perkType: string) => {
    if (perkType === 'SPY_DMS') {
      setPickingTarget(perkType);
    } else {
      engine.sendPerk(perkType);
      setOpen(false);
    }
  };

  const handleTargetPick = (targetId: string) => {
    engine.sendPerk('SPY_DMS', targetId);
    setPickingTarget(null);
    setOpen(false);
  };

  return (
    <>
      {/* FAB Button */}
      <motion.button
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-skin-gold/90 text-skin-inverted flex items-center justify-center shadow-lg z-30"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
      >
        <Sparkles size={22} />
      </motion.button>

      {/* Perk Drawer */}
      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-skin-fill border-t border-white/[0.06]">
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="px-5 pb-2">
              <h3 className="text-sm font-bold text-skin-gold uppercase tracking-wider font-display">Perks</h3>
            </div>

            {/* Perk result toast */}
            <AnimatePresence>
              {lastPerkResult?.type === 'PERK.RESULT' && lastPerkResult.result?.perkType === 'SPY_DMS' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mx-5 mb-3 bg-skin-gold/10 border border-skin-gold/20 rounded-xl p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-skin-gold uppercase">DM Intel</span>
                    <button onClick={clearPerkResult} className="text-skin-dim"><X size={14} /></button>
                  </div>
                  {lastPerkResult.result.messages?.length === 0 ? (
                    <p className="text-sm text-skin-dim italic">No DMs found for this player.</p>
                  ) : (
                    <ul className="space-y-2">
                      {lastPerkResult.result.messages?.map((m: any, i: number) => (
                        <li key={i} className="text-sm bg-glass rounded-lg p-2 border border-white/[0.06]">
                          <span className="text-skin-gold font-mono text-xs">{roster[m.from]?.personaName || m.from}</span>
                          <span className="text-skin-dim mx-1">&rarr;</span>
                          <span className="text-skin-pink font-mono text-xs">{roster[m.to]?.personaName || m.to}</span>
                          <p className="mt-1 text-skin-base">{m.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}

              {lastPerkResult?.type === 'PERK.RESULT' && lastPerkResult.result?.perkType !== 'SPY_DMS' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mx-5 mb-3 bg-skin-green/10 border border-skin-green/20 rounded-xl px-4 py-2 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2 text-sm text-skin-green"><Check size={14} /> Perk activated!</span>
                  <button onClick={clearPerkResult} className="text-skin-dim"><X size={14} /></button>
                </motion.div>
              )}

              {lastPerkResult?.type === 'PERK.REJECTED' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mx-5 mb-3 bg-skin-danger/10 border border-skin-danger/20 rounded-xl px-4 py-2 flex items-center justify-between"
                >
                  <span className="text-sm text-skin-danger">Rejected: {lastPerkResult.reason}</span>
                  <button onClick={clearPerkResult} className="text-skin-dim"><X size={14} /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Target picker */}
            {pickingTarget && (
              <div className="px-5 pb-4 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-skin-gold uppercase">Pick a target</h4>
                  <button onClick={() => setPickingTarget(null)} className="text-skin-dim"><X size={16} /></button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {alivePlayers.map((p: any) => (
                    <motion.button
                      key={p.id}
                      onClick={() => handleTargetPick(p.id)}
                      className="px-4 py-2 rounded-xl bg-glass border border-white/[0.06] hover:border-skin-gold/40 text-sm font-bold transition-colors"
                      whileTap={{ scale: 0.95 }}
                    >
                      {p.personaName}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Perk buttons */}
            {!pickingTarget && (
              <div className="px-5 pb-6 space-y-2">
                {PERK_INFO.map(perk => {
                  const cost = PERK_COSTS[perk.type];
                  const canAfford = mySilver >= cost;
                  return (
                    <motion.button
                      key={perk.type}
                      onClick={() => handlePerk(perk.type)}
                      disabled={!canAfford}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all
                        ${canAfford
                          ? 'bg-glass border-white/[0.06] text-skin-base'
                          : 'bg-glass/30 border-white/[0.03] text-skin-dim/40 cursor-not-allowed'
                        }`}
                      whileTap={canAfford ? { scale: 0.97 } : undefined}
                    >
                      <perk.icon size={18} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-sm">{perk.label}</span>
                        <p className="text-xs text-skin-dim">{perk.desc}</p>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-sm text-skin-gold font-bold shrink-0">
                        <Coins size={12} className="text-skin-dim" />
                        {cost}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
