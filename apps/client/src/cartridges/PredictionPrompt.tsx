import React, { useState } from 'react';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { Crosshair } from 'lucide-react';

interface PredictionCartridge {
  promptType: 'PREDICTION';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  responses: Record<string, string>;
  results: {
    mostPicked: { playerId: string; count: number } | null;
    consensusVoters: string[];
    silverRewards: Record<string, number>;
  } | null;
}

interface PredictionPromptProps {
  cartridge: PredictionCartridge;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function PredictionPrompt({ cartridge, playerId, roster, engine }: PredictionPromptProps) {
  const { promptText, phase, eligibleVoters, responses, results } = cartridge;
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const hasResponded = playerId in responses;
  const respondedCount = Object.keys(responses).length;
  const totalEligible = eligibleVoters.length;

  const name = (id: string) => roster[id]?.personaName || id;

  const handleSubmit = (targetId: string) => {
    if (hasResponded || phase !== 'ACTIVE') return;
    setSelectedTarget(targetId);
    engine.sendActivityAction('ACTIVITY.PROMPT.SUBMIT', { targetId });
  };

  const targets = eligibleVoters.filter(id => id !== playerId);

  return (
    <div className="mx-4 my-2 rounded-xl bg-glass border border-white/[0.06] overflow-hidden slide-up-in shadow-card">
      {/* Header */}
      <div className="px-4 py-3 bg-skin-pink/5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-2.5 py-0.5 text-skin-pink uppercase tracking-widest">
            Prediction
          </span>
          <span className="text-xs font-mono text-skin-dim">
            {respondedCount}/{totalEligible} responded
          </span>
        </div>
        {hasResponded && (
          <span className="text-[10px] font-mono text-skin-green uppercase tracking-wider">Submitted</span>
        )}
      </div>

      {/* Active Phase */}
      {phase === 'ACTIVE' && (
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-skin-pink/10 border border-skin-pink/20 flex items-center justify-center shrink-0">
              <Crosshair size={14} className="text-skin-pink" />
            </div>
            <p className="text-sm font-bold text-skin-base leading-relaxed pt-1">
              {promptText}
            </p>
          </div>

          {!hasResponded ? (
            <div className="grid grid-cols-1 gap-2">
              {targets.map(targetId => {
                const player = roster[targetId];
                if (!player) return null;
                const isSelected = selectedTarget === targetId;
                return (
                  <button
                    key={targetId}
                    onClick={() => handleSubmit(targetId)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all text-sm
                      ${isSelected
                        ? 'bg-skin-pink/20 border-skin-pink/50 text-skin-pink'
                        : 'bg-white/[0.03] border-white/[0.06] text-skin-base hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.98]'
                      }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-skin-panel flex items-center justify-center text-xs font-bold font-mono text-skin-gold avatar-ring">
                      {player.personaName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span className="font-medium">{player.personaName}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-skin-dim">
                You predicted <span className="font-bold text-skin-pink">{name(responses[playerId])}</span>
              </p>
              <p className="text-xs text-skin-dim mt-1 font-mono">Waiting for others...</p>
            </div>
          )}
        </div>
      )}

      {/* Results Phase */}
      {phase === 'RESULTS' && results && (
        <div className="p-4 space-y-4 animate-fade-in">
          <p className="text-center text-sm font-bold text-skin-pink uppercase tracking-wider font-display">
            Predictions
          </p>

          {results.mostPicked && (
            <div className="text-center py-3 rounded-lg bg-skin-pink/5 border border-skin-pink/10">
              <p className="text-xs text-skin-dim uppercase tracking-wider mb-1">Most Predicted</p>
              <p className="text-lg font-bold text-skin-pink">
                {name(results.mostPicked.playerId)}
              </p>
              <p className="text-xs text-skin-dim">
                {results.mostPicked.count} {results.mostPicked.count === 1 ? 'prediction' : 'predictions'}
              </p>
            </div>
          )}

          {results.consensusVoters.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-skin-dim uppercase tracking-wider font-mono">Consensus Bonus (+10 silver)</p>
              <div className="flex flex-wrap gap-1.5">
                {results.consensusVoters.map(id => (
                  <span key={id} className={`px-2.5 py-1 rounded-lg text-xs font-mono border ${id === playerId ? 'bg-skin-pink/10 border-skin-pink/30 text-skin-pink' : 'bg-white/[0.02] border-white/[0.04] text-skin-dim'}`}>
                    {name(id)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {results.silverRewards[playerId] != null && (
            <div className="text-center py-2">
              <p className="text-xs font-mono text-skin-dim uppercase tracking-widest mb-1">You Earned</p>
              <p className="text-2xl font-bold font-mono text-skin-gold text-glow">
                +{results.silverRewards[playerId]} silver
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
