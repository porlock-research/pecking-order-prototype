import React, { useState } from 'react';

interface SplitInputProps {
  onSubmit: (decision: Record<string, any>) => void;
  opponentName: string;
  potAmount: number;
}

export default function SplitInput({ onSubmit, opponentName, potAmount }: SplitInputProps) {
  const [confirmed, setConfirmed] = useState(false);

  const handleChoice = (action: 'SPLIT' | 'STEAL') => {
    if (confirmed) return;
    setConfirmed(true);
    onSubmit({ action });
  };

  return (
    <div className="space-y-4">
      <div className="text-center p-3 rounded-lg bg-skin-gold/5 border border-skin-gold/20">
        <p className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Pot at Stake</p>
        <p className="text-2xl font-bold font-mono text-skin-gold">{potAmount} silver</p>
        <p className="text-[10px] font-mono text-skin-dim/60">vs {opponentName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleChoice('SPLIT')}
          disabled={confirmed}
          className="p-4 rounded-lg border-2 border-skin-green/30 bg-skin-green/5 hover:bg-skin-green/10 hover:border-skin-green/50 transition-all text-center space-y-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
        >
          <div className="text-2xl">&#x1F91D;</div>
          <div className="text-sm font-bold text-skin-green uppercase tracking-wider">Split</div>
          <div className="text-[10px] text-skin-dim/60">Share the pot</div>
        </button>

        <button
          onClick={() => handleChoice('STEAL')}
          disabled={confirmed}
          className="p-4 rounded-lg border-2 border-red-500/30 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/50 transition-all text-center space-y-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]"
        >
          <div className="text-2xl">&#x1F48E;</div>
          <div className="text-sm font-bold text-red-400 uppercase tracking-wider">Steal</div>
          <div className="text-[10px] text-skin-dim/60">Take it all</div>
        </button>
      </div>
    </div>
  );
}
