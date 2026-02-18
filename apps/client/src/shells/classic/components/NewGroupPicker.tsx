import React, { useState } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { PlayerStatuses } from '@pecking-order/shared-types';

interface NewGroupPickerProps {
  roster: Record<string, any>;
  playerId: string;
  onBack: () => void;
  engine: { createGroupDm: (memberIds: string[]) => void };
}

export function NewGroupPicker({ roster, playerId, onBack, engine }: NewGroupPickerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const dmRejection = useGameStore(s => s.dmRejection);

  const available = Object.values(roster).filter(
    (p: any) => p.id !== playerId && p.status === PlayerStatuses.ALIVE
  );

  const handleCreate = () => {
    if (selected.length < 2) return;
    engine.createGroupDm(selected);
    onBack();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40 flex items-center gap-3">
        <button onClick={onBack} className="text-skin-dim hover:text-skin-base font-mono text-lg transition-colors">{'<-'}</button>
        <span className="text-sm font-bold text-skin-pink uppercase tracking-wider font-display">New Group</span>
        <span className="text-[10px] font-mono text-skin-dim ml-auto">{selected.length} selected</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {available.map((p: any) => {
          const isSelected = selected.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => setSelected(prev => isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
              className={`w-full flex items-center gap-3 p-3 rounded-xl bg-glass border transition-all ${
                isSelected ? 'border-skin-pink/50 bg-skin-pink/10' : 'border-white/[0.06] hover:border-skin-pink/30'
              }`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs shrink-0 ${
                isSelected ? 'border-skin-pink bg-skin-pink text-skin-base' : 'border-white/20'
              }`}>
                {isSelected && '\u2713'}
              </div>
              <div className="w-9 h-9 rounded-full bg-skin-panel flex items-center justify-center text-sm font-bold font-mono text-skin-pink avatar-ring">
                {p.personaName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <span className="font-bold text-sm text-skin-base">{p.personaName}</span>
            </button>
          );
        })}
      </div>
      <div className="shrink-0 p-4 border-t border-white/[0.06] bg-skin-panel/40">
        {dmRejection && (
          <div className="mb-2 px-3 py-1.5 rounded-lg bg-skin-danger/10 border border-skin-danger/20 text-skin-danger text-xs font-mono animate-fade-in">
            {dmRejection.reason}
          </div>
        )}
        <button
          onClick={handleCreate}
          disabled={selected.length < 2}
          className="w-full bg-skin-pink text-skin-base rounded-full py-3 font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-btn"
        >
          Create Group ({selected.length} members)
        </button>
      </div>
    </div>
  );
}
