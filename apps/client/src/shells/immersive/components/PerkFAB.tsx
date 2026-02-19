import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { useGameStore } from '../../../store/useGameStore';
import { PERK_COSTS, PlayerStatuses } from '@pecking-order/shared-types';
import { Eye, UserPlus, FileText, Coins, X, Sparkles } from 'lucide-react';
import { SPRING, TAP } from '../springs';

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

  // Show toasts for perk results instead of inline UI
  useEffect(() => {
    if (!lastPerkResult) return;

    if (lastPerkResult.type === 'PERK.RESULT' && lastPerkResult.result?.perkType === 'SPY_DMS') {
      const messages = lastPerkResult.result.messages || [];
      if (messages.length === 0) {
        toast('No DMs found for this player.', { icon: '🔍' });
      } else {
        toast.custom(() => (
          <div className="bg-skin-panel/95 backdrop-blur-xl border border-skin-gold/20 rounded-xl p-3 shadow-card max-w-sm">
            <div className="text-xs font-bold text-skin-gold uppercase mb-2">DM Intel</div>
            <ul className="space-y-1.5">
              {messages.map((m: any, i: number) => (
                <li key={i} className="text-sm bg-skin-glass-elevated rounded-lg p-2 border border-white/[0.06]">
                  <span className="text-skin-gold font-mono text-xs">{roster[m.from]?.personaName || m.from}</span>
                  <span className="text-skin-dim mx-1">&rarr;</span>
                  <span className="text-skin-pink font-mono text-xs">{roster[m.to]?.personaName || m.to}</span>
                  <p className="mt-1 text-skin-base">{m.content}</p>
                </li>
              ))}
            </ul>
          </div>
        ), { duration: 8000 });
      }
      clearPerkResult();
    } else if (lastPerkResult.type === 'PERK.RESULT') {
      toast.success('Perk activated!');
      clearPerkResult();
    } else if (lastPerkResult.type === 'PERK.REJECTED') {
      toast.error(`Rejected: ${lastPerkResult.reason}`);
      clearPerkResult();
    }
  }, [lastPerkResult, clearPerkResult, roster]);

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
        className="fixed bottom-24 right-4 w-16 h-16 rounded-full bg-skin-gold/90 text-skin-inverted flex items-center justify-center shadow-lg z-30"
        onClick={() => setOpen(true)}
        whileTap={TAP.fab}
        transition={SPRING.bouncy}
        whileHover={{ scale: 1.05 }}
      >
        <Sparkles size={24} />
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
                      className="px-4 py-2.5 rounded-xl bg-skin-glass-elevated border border-white/[0.06] hover:border-skin-gold/40 text-sm font-bold transition-colors"
                      whileTap={TAP.button}
                      transition={SPRING.button}
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
                      className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl border text-left transition-all
                        ${canAfford
                          ? 'bg-skin-glass-elevated border-white/[0.08] text-skin-base'
                          : 'bg-skin-glass/30 border-white/[0.03] text-skin-dim/40 cursor-not-allowed'
                        }`}
                      whileTap={canAfford ? TAP.card : undefined}
                      transition={SPRING.button}
                    >
                      <perk.icon size={20} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-base">{perk.label}</span>
                        <p className="text-sm text-skin-dim">{perk.desc}</p>
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
