import React from 'react';
import { PlayerStatuses } from '@pecking-order/shared-types';

interface NewDmPickerProps {
  roster: Record<string, any>;
  playerId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
}

export function NewDmPicker({ roster, playerId, onSelect, onBack }: NewDmPickerProps) {
  const available = Object.values(roster).filter(
    (p: any) => p.id !== playerId && p.status === PlayerStatuses.ALIVE
  );
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] bg-skin-panel/40 flex items-center gap-3">
        <button onClick={onBack} className="text-skin-dim hover:text-skin-base font-mono text-lg transition-colors">{'<-'}</button>
        <span className="text-sm font-bold text-skin-pink uppercase tracking-wider font-display">New Message</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {available.map((p: any) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-glass border border-white/[0.06] hover:border-skin-pink/30 transition-all"
          >
            <div className="w-9 h-9 rounded-full bg-skin-panel flex items-center justify-center text-sm font-bold font-mono text-skin-pink avatar-ring">
              {p.personaName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <span className="font-bold text-sm text-skin-base">{p.personaName}</span>
          </button>
        ))}
        {available.length === 0 && (
          <div className="text-center text-skin-dim text-sm py-8">No players available</div>
        )}
      </div>
    </div>
  );
}
