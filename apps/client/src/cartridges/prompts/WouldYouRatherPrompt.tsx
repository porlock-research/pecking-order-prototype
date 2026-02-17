import React from 'react';
import { PromptPhases, type SocialPlayer } from '@pecking-order/shared-types';
import { Scale } from 'lucide-react';

interface WyrCartridge {
  promptType: 'WOULD_YOU_RATHER';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  optionA: string;
  optionB: string;
  eligibleVoters: string[];
  choices: Record<string, 'A' | 'B'>;
  results: {
    optionA: string;
    optionB: string;
    countA: number;
    countB: number;
    minorityChoice: 'A' | 'B' | null;
    silverRewards: Record<string, number>;
  } | null;
}

interface WouldYouRatherPromptProps {
  cartridge: WyrCartridge;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function WouldYouRatherPrompt({ cartridge, playerId, roster, engine }: WouldYouRatherPromptProps) {
  const { promptText, phase, optionA, optionB, eligibleVoters, choices, results } = cartridge;
  const hasResponded = playerId in choices;
  const respondedCount = Object.keys(choices).length;
  const totalEligible = eligibleVoters.length;

  const handleChoose = (choice: 'A' | 'B') => {
    if (hasResponded || phase !== PromptPhases.ACTIVE) return;
    engine.sendActivityAction('ACTIVITY.WYR.CHOOSE', { choice });
  };

  return (
    <div className="mx-4 my-2 rounded-xl bg-glass border border-white/[0.06] overflow-hidden slide-up-in shadow-card">
      {/* Header */}
      <div className="px-4 py-3 bg-skin-pink/5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-2.5 py-0.5 text-skin-pink uppercase tracking-widest">
            Would You Rather
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
              <Scale size={14} className="text-skin-pink" />
            </div>
            <p className="text-sm font-bold text-skin-base leading-relaxed pt-1">
              {promptText}
            </p>
          </div>

          {!hasResponded ? (
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => handleChoose('A')}
                className="px-4 py-4 rounded-lg border bg-white/[0.03] border-white/[0.06] text-skin-base hover:bg-skin-pink/10 hover:border-skin-pink/30 active:scale-[0.98] transition-all text-sm font-medium text-left"
              >
                <span className="text-skin-pink font-mono text-xs mr-2">A.</span>
                {optionA}
              </button>
              <div className="text-center text-xs font-mono text-skin-dim/40 uppercase tracking-widest">or</div>
              <button
                onClick={() => handleChoose('B')}
                className="px-4 py-4 rounded-lg border bg-white/[0.03] border-white/[0.06] text-skin-base hover:bg-skin-pink/10 hover:border-skin-pink/30 active:scale-[0.98] transition-all text-sm font-medium text-left"
              >
                <span className="text-skin-pink font-mono text-xs mr-2">B.</span>
                {optionB}
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-skin-dim">
                You chose <span className="font-bold text-skin-pink">{choices[playerId] === 'A' ? optionA : optionB}</span>
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

          {/* Percentage Bar */}
          <div className="space-y-2">
            {(() => {
              const total = results.countA + results.countB;
              const pctA = total > 0 ? Math.round((results.countA / total) * 100) : 50;
              const pctB = 100 - pctA;
              const aIsMinority = results.minorityChoice === 'A';
              const bIsMinority = results.minorityChoice === 'B';
              return (
                <>
                  <div className="flex justify-between text-xs font-mono text-skin-dim">
                    <span>{results.optionA}</span>
                    <span>{results.optionB}</span>
                  </div>
                  <div className="flex rounded-lg overflow-hidden h-8 border border-white/[0.06]">
                    <div
                      className={`flex items-center justify-center text-xs font-mono font-bold transition-all ${aIsMinority ? 'bg-skin-gold/30 text-skin-gold' : 'bg-skin-pink/20 text-skin-pink'}`}
                      style={{ width: `${pctA}%` }}
                    >
                      {pctA}%
                    </div>
                    <div
                      className={`flex items-center justify-center text-xs font-mono font-bold transition-all ${bIsMinority ? 'bg-skin-gold/30 text-skin-gold' : 'bg-skin-pink/20 text-skin-pink'}`}
                      style={{ width: `${pctB}%` }}
                    >
                      {pctB}%
                    </div>
                  </div>
                  {results.minorityChoice && (
                    <p className="text-center text-xs font-mono text-skin-gold">
                      Minority bonus: {results.minorityChoice === 'A' ? results.optionA : results.optionB} (+10 silver)
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
