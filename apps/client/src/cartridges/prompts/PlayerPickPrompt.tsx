import React, { useState } from 'react';
import { PromptPhases, ActivityEvents, type SocialPlayer } from '@pecking-order/shared-types';
import { Users, Heart } from 'lucide-react';
import { PersonaAvatar } from '../../components/PersonaAvatar';

interface PromptCartridge {
  promptType: 'PLAYER_PICK';
  promptText: string;
  phase: 'ACTIVE' | 'RESULTS';
  eligibleVoters: string[];
  responses: Record<string, string>;
  results: {
    mostPicked: { playerId: string; count: number } | null;
    mutualPicks: Array<[string, string]>;
    silverRewards: Record<string, number>;
  } | null;
}

interface PlayerPickPromptProps {
  cartridge: PromptCartridge;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function PlayerPickPrompt({ cartridge, playerId, roster, engine }: PlayerPickPromptProps) {
  const { promptText, phase, eligibleVoters, responses, results } = cartridge;
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const hasResponded = playerId in responses;
  const respondedCount = Object.keys(responses).length;
  const totalEligible = eligibleVoters.length;

  const name = (id: string) => roster[id]?.personaName || id;

  const handleSubmit = (targetId: string) => {
    if (hasResponded || phase !== PromptPhases.ACTIVE) return;
    setSelectedTarget(targetId);
    engine.sendActivityAction(ActivityEvents.PROMPT.SUBMIT, { targetId });
  };

  // Pick targets = all eligible except self
  const targets = eligibleVoters.filter(id => id !== playerId);

  return (
    <div className="mx-4 my-2 rounded-xl bg-glass border border-white/[0.06] overflow-hidden slide-up-in shadow-card">

      {/* Header */}
      <div className="px-4 py-3 bg-skin-pink/5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-skin-pink/10 border border-skin-pink/30 rounded-pill px-2.5 py-0.5 text-skin-pink uppercase tracking-widest">
            Activity
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
              <Users size={14} className="text-skin-pink" />
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
                    disabled={hasResponded}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all text-sm
                      ${isSelected
                        ? 'bg-skin-pink/20 border-skin-pink/50 text-skin-pink'
                        : 'bg-white/[0.03] border-white/[0.06] text-skin-base hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.98]'
                      }`}
                  >
                    <PersonaAvatar avatarUrl={player.avatarUrl} personaName={player.personaName} size={32} />
                    <span className="font-medium">{player.personaName}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-skin-dim">
                You picked <span className="font-bold text-skin-pink">{name(responses[playerId])}</span>
              </p>
              <p className="text-xs text-skin-dim mt-1 font-mono">
                Waiting for others...
              </p>
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

          {/* Most Picked */}
          {results.mostPicked && (
            <div className="text-center py-3 rounded-lg bg-skin-pink/5 border border-skin-pink/10">
              <p className="text-xs text-skin-dim uppercase tracking-wider mb-1">Most Picked</p>
              <p className="text-lg font-bold text-skin-pink">
                {name(results.mostPicked.playerId)}
              </p>
              <p className="text-xs text-skin-dim">
                {results.mostPicked.count} {results.mostPicked.count === 1 ? 'pick' : 'picks'}
              </p>
            </div>
          )}

          {/* Mutual Picks */}
          {results.mutualPicks.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-skin-dim uppercase tracking-wider font-mono">Mutual Picks</p>
              {results.mutualPicks.map(([a, b], idx) => {
                const isMe = a === playerId || b === playerId;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm
                      ${isMe ? 'bg-skin-pink/10 border-skin-pink/30' : 'bg-white/[0.02] border-white/[0.04]'}`}
                  >
                    <span className={isMe ? 'font-bold text-skin-pink' : 'text-skin-base'}>{name(a)}</span>
                    <Heart size={12} className="text-skin-pink" />
                    <span className={isMe ? 'font-bold text-skin-pink' : 'text-skin-base'}>{name(b)}</span>
                    <span className="text-xs font-mono text-skin-green ml-2">+10 silver each</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Your Silver */}
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
