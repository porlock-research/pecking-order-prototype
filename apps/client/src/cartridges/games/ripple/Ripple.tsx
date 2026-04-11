import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import RippleRenderer from './RippleRenderer';

interface RippleProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Ripple(props: RippleProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Ripple"
      description="Tap to drop stones. Ride the waves to hit targets. Converge two ripples for AMPLIFY bonus!"
      Renderer={RippleRenderer}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const stonesUsed = result.stonesUsed || 0;
        const amplifies = result.amplifies || 0;
        const { scorePerSilver, maxStones } = Config.game.ripple;

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Score</span>
              <span className="text-white">{score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Stones used</span>
              <span className="text-white">{stonesUsed} / {maxStones}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Amplifies</span>
              <span className="text-white">{amplifies}</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/50">Silver</span>
              <span className="text-skin-gold">{Math.min(Config.game.arcade.maxSilver, Math.floor(score / scorePerSilver))}</span>
            </div>
          </div>
        );
      }}
    />
  );
}
