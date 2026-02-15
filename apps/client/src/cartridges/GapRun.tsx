import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from './ArcadeGameWrapper';
import GapRunRenderer from './GapRunRenderer';

interface GapRunProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function GapRun(props: GapRunProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Gap Run"
      description="Jump over gaps to survive as long as possible. Tap or press Space to jump. The longer you run, the more silver you earn!"
      Renderer={GapRunRenderer}
      renderBreakdown={(result, silverReward) => {
        const distance = result.distance || 0;
        const jumps = result.jumps || 0;
        const timeElapsed = result.timeElapsed || 0;
        const distanceSilver = Math.min(15, Math.floor(distance / 100));
        const survived = distance > 0 && timeElapsed >= (props.cartridge.timeLimit || 45000) - 1000;
        const survivalBonus = survived ? 5 : 0;

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between text-skin-dim">
              <span>Distance</span>
              <span className="text-skin-base font-bold">{distance}m</span>
            </div>
            <div className="flex justify-between text-skin-dim">
              <span>Distance Silver</span>
              <span className="text-skin-base font-bold">{distanceSilver} silver</span>
            </div>
            {survivalBonus > 0 && (
              <div className="flex justify-between">
                <span className="text-skin-gold gold-glow">Survival Bonus</span>
                <span className="text-skin-gold font-bold gold-glow">+{survivalBonus} silver</span>
              </div>
            )}
            <div className="flex justify-between text-skin-dim">
              <span>Jumps</span>
              <span className="text-skin-base">{jumps}</span>
            </div>
          </div>
        );
      }}
    />
  );
}
