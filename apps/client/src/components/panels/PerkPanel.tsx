import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { PERK_COSTS, type PerkType, PlayerStatuses } from '@pecking-order/shared-types';
import { Eye, UserPlus, MessageSquarePlus, X, Coins, Check } from 'lucide-react';

interface PerkPanelProps {
  engine: {
    sendPerk: (perkType: string, targetId?: string) => void;
  };
}

const PERK_INFO: { type: PerkType; label: string; desc: string; icon: typeof Eye; needsTarget: boolean }[] = [
  { type: 'SPY_DMS', label: 'Spy DMs', desc: 'See last 3 DMs a player sent', icon: Eye, needsTarget: true },
  { type: 'EXTRA_DM_PARTNER', label: '+1 DM Partner', desc: 'DM one more person today', icon: UserPlus, needsTarget: false },
  { type: 'EXTRA_DM_CHARS', label: '+600 DM Chars', desc: 'Extend your DM character limit', icon: MessageSquarePlus, needsTarget: false },
];

const PERK_SUCCESS_LABELS: Record<string, string> = {
  EXTRA_DM_PARTNER: '+1 DM partner unlocked for today!',
  EXTRA_DM_CHARS: '+600 DM characters unlocked for today!',
};

export default function PerkPanel({ engine }: PerkPanelProps) {
  const roster = useGameStore(s => s.roster);
  const playerId = useGameStore(s => s.playerId);
  const lastPerkResult = useGameStore(s => s.lastPerkResult);
  const clearPerkResult = useGameStore(s => s.clearPerkResult);
  const dmStats = useGameStore(s => s.dmStats);

  const [pickingTarget, setPickingTarget] = useState<PerkType | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Auto-clear non-SPY_DMS success results after 3 seconds
  useEffect(() => {
    if (lastPerkResult?.type === 'PERK.RESULT' && lastPerkResult.result?.perkType !== 'SPY_DMS') {
      const timer = setTimeout(clearPerkResult, 3000);
      return () => clearTimeout(timer);
    }
    if (lastPerkResult?.type === 'PERK.REJECTED') {
      const timer = setTimeout(clearPerkResult, 4000);
      return () => clearTimeout(timer);
    }
  }, [lastPerkResult, clearPerkResult]);

  const me = playerId ? roster[playerId] : null;
  const mySilver = me?.silver ?? 0;

  const handlePerk = (perkType: PerkType) => {
    const info = PERK_INFO.find(p => p.type === perkType);
    if (!info) return;
    if (info.needsTarget) {
      setPickingTarget(perkType);
    } else {
      engine.sendPerk(perkType);
    }
  };

  const handleTargetPick = (targetId: string) => {
    if (pickingTarget) {
      engine.sendPerk(pickingTarget, targetId);
      setPickingTarget(null);
    }
  };

  const alivePlayers = Object.values(roster).filter(
    (p: any) => p.status === PlayerStatuses.ALIVE && p.id !== playerId
  );

  // SPY_DMS result overlay
  if (lastPerkResult?.type === 'PERK.RESULT' && lastPerkResult.result?.perkType === 'SPY_DMS') {
    const messages = lastPerkResult.result.data?.messages || [];
    return (
      <div className="bg-skin-panel/95 border-b border-white/[0.06] p-4 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-skin-gold uppercase tracking-wider">Spy DMs Result</h3>
          <button onClick={clearPerkResult} className="text-skin-dim hover:text-skin-base">
            <X size={16} />
          </button>
        </div>
        {messages.length === 0 ? (
          <p className="text-sm text-skin-dim italic">No DMs found for this player.</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m: any, i: number) => (
              <li key={i} className="text-sm bg-glass rounded-lg p-2 border border-white/[0.06]">
                <span className="text-skin-gold font-mono text-xs">{roster[m.from]?.personaName || m.from}</span>
                <span className="text-skin-dim mx-1">&rarr;</span>
                <span className="text-skin-pink font-mono text-xs">{roster[m.to]?.personaName || m.to}</span>
                <p className="mt-1 text-skin-base">{m.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Non-SPY_DMS success toast
  if (lastPerkResult?.type === 'PERK.RESULT' && lastPerkResult.result?.perkType !== 'SPY_DMS') {
    const label = PERK_SUCCESS_LABELS[lastPerkResult.result?.perkType] || 'Perk activated!';
    return (
      <div className="bg-skin-green/10 border-b border-skin-green/20 px-4 py-2 flex items-center justify-between animate-fade-in">
        <span className="flex items-center gap-2 text-sm text-skin-green">
          <Check size={14} />
          {label}
        </span>
        <button onClick={clearPerkResult} className="text-skin-dim hover:text-skin-base">
          <X size={14} />
        </button>
      </div>
    );
  }

  // Perk rejection toast
  if (lastPerkResult?.type === 'PERK.REJECTED') {
    return (
      <div className="bg-skin-danger/20 border-b border-skin-danger/30 px-4 py-2 flex items-center justify-between animate-fade-in">
        <span className="text-sm text-skin-danger">Perk rejected: {lastPerkResult.reason}</span>
        <button onClick={clearPerkResult} className="text-skin-dim hover:text-skin-base">
          <X size={14} />
        </button>
      </div>
    );
  }

  // Target picker overlay
  if (pickingTarget) {
    return (
      <div className="bg-skin-panel/95 border-b border-white/[0.06] p-4 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-skin-gold uppercase tracking-wider">Pick a target</h3>
          <button onClick={() => setPickingTarget(null)} className="text-skin-dim hover:text-skin-base">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {alivePlayers.map((p: any) => (
            <button
              key={p.id}
              onClick={() => handleTargetPick(p.id)}
              className="px-3 py-1.5 rounded-lg bg-glass border border-white/[0.06] hover:border-skin-gold/40 text-sm font-bold transition-colors"
            >
              {p.personaName}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full bg-skin-panel/50 border-b border-white/[0.06] px-4 py-2 flex items-center gap-2 text-xs font-bold text-skin-dim uppercase tracking-wider hover:text-skin-gold transition-colors"
      >
        <Eye size={14} />
        Perks
      </button>
    );
  }

  return (
    <div className="bg-skin-panel/80 border-b border-white/[0.06] p-3 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-skin-gold uppercase tracking-wider">Perks</h3>
        <div className="flex items-center gap-3">
          {dmStats && (
            <span className="text-[10px] font-mono text-skin-dim">
              {dmStats.partnersUsed}/{dmStats.partnersLimit} partners · {Math.max(0, dmStats.charsLimit - dmStats.charsUsed)}/{dmStats.charsLimit} chars
            </span>
          )}
          <button onClick={() => setExpanded(false)} className="text-skin-dim hover:text-skin-base">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {PERK_INFO.map(perk => {
          const cost = PERK_COSTS[perk.type];
          const canAfford = mySilver >= cost;
          return (
            <button
              key={perk.type}
              onClick={() => handlePerk(perk.type)}
              disabled={!canAfford}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold transition-all
                ${canAfford
                  ? 'bg-glass border-white/[0.06] hover:border-skin-gold/40 text-skin-base'
                  : 'bg-glass/30 border-white/[0.03] text-skin-dim/40 cursor-not-allowed'
                }`}
              title={perk.desc}
            >
              <perk.icon size={14} />
              <span>{perk.label}</span>
              <span className="flex items-center gap-0.5 font-mono text-xs text-skin-gold">
                <Coins size={10} className="text-gray-400" />
                {cost}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
