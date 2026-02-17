import React from 'react';
import { PromptPhases, type SocialPlayer } from '@pecking-order/shared-types';
import { Flame } from 'lucide-react';

interface HotTakeCartridge {
  promptType: 'HOT_TAKE';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  stances: Record<string, 'AGREE' | 'DISAGREE'>;
  results: {
    statement: string;
    agreeCount: number;
    disagreeCount: number;
    minorityStance: 'AGREE' | 'DISAGREE' | null;
    silverRewards: Record<string, number>;
  } | null;
}

interface HotTakePromptProps {
  cartridge: HotTakeCartridge;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function HotTakePrompt({ cartridge, playerId, roster, engine }: HotTakePromptProps) {
  const { promptText, phase, eligibleVoters, stances, results } = cartridge;
  const hasResponded = playerId in stances;
  const respondedCount = Object.keys(stances).length;
  const totalEligible = eligibleVoters.length;

  const handleStance = (stance: 'AGREE' | 'DISAGREE') => {
    if (hasResponded || phase !== PromptPhases.ACTIVE) return;
    engine.sendActivityAction('ACTIVITY.HOTTAKE.RESPOND', { stance });
  };

  return (
    <div className="mx-4 my-2 rounded-xl bg-glass border border-white/[0.06] overflow-hidden slide-up-in shadow-card">
      {/* Header */}
      <div className="px-4 py-3 bg-skin-pink/5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-2.5 py-0.5 text-skin-pink uppercase tracking-widest">
            Hot Take
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
      {phase === PromptPhases.ACTIVE && (
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-skin-pink/10 border border-skin-pink/20 flex items-center justify-center shrink-0">
              <Flame size={14} className="text-skin-pink" />
            </div>
            <p className="text-sm font-bold text-skin-base leading-relaxed pt-1 italic">
              "{promptText}"
            </p>
          </div>

          {!hasResponded ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleStance('AGREE')}
                className="px-4 py-4 rounded-lg border bg-white/[0.03] border-white/[0.06] text-skin-base hover:bg-skin-green/10 hover:border-skin-green/30 active:scale-[0.98] transition-all text-sm font-bold text-center"
              >
                Agree
              </button>
              <button
                onClick={() => handleStance('DISAGREE')}
                className="px-4 py-4 rounded-lg border bg-white/[0.03] border-white/[0.06] text-skin-base hover:bg-skin-pink/10 hover:border-skin-pink/30 active:scale-[0.98] transition-all text-sm font-bold text-center"
              >
                Disagree
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-skin-dim">
                You voted <span className="font-bold text-skin-pink">{stances[playerId]}</span>
              </p>
              <p className="text-xs text-skin-dim mt-1 font-mono">Waiting for others...</p>
            </div>
          )}
        </div>
      )}

      {/* Results Phase */}
      {phase === PromptPhases.RESULTS && results && (
        <div className="p-4 space-y-4 animate-fade-in">
          <p className="text-center text-sm font-bold text-skin-pink uppercase tracking-wider font-display">
            Results
          </p>

          <div className="space-y-2">
            {(() => {
              const total = results.agreeCount + results.disagreeCount;
              const pctAgree = total > 0 ? Math.round((results.agreeCount / total) * 100) : 50;
              const pctDisagree = 100 - pctAgree;
              const agreeIsMinority = results.minorityStance === 'AGREE';
              const disagreeIsMinority = results.minorityStance === 'DISAGREE';
              return (
                <>
                  <div className="flex justify-between text-xs font-mono text-skin-dim">
                    <span>Agree ({results.agreeCount})</span>
                    <span>Disagree ({results.disagreeCount})</span>
                  </div>
                  <div className="flex rounded-lg overflow-hidden h-8 border border-white/[0.06]">
                    <div
                      className={`flex items-center justify-center text-xs font-mono font-bold transition-all ${agreeIsMinority ? 'bg-skin-gold/30 text-skin-gold' : 'bg-skin-green/20 text-skin-green'}`}
                      style={{ width: `${pctAgree}%` }}
                    >
                      {pctAgree > 10 ? `${pctAgree}%` : ''}
                    </div>
                    <div
                      className={`flex items-center justify-center text-xs font-mono font-bold transition-all ${disagreeIsMinority ? 'bg-skin-gold/30 text-skin-gold' : 'bg-skin-pink/20 text-skin-pink'}`}
                      style={{ width: `${pctDisagree}%` }}
                    >
                      {pctDisagree > 10 ? `${pctDisagree}%` : ''}
                    </div>
                  </div>
                  {results.minorityStance && (
                    <p className="text-center text-xs font-mono text-skin-gold">
                      Minority bonus: {results.minorityStance} (+10 silver)
                    </p>
                  )}
                </>
              );
            })()}
          </div>

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
