import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import InflateRenderer from './InflateRenderer';

interface InflateProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Inflate(props: InflateProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Inflate"
      description="Hold to inflate the balloon. Release to bank points. Don't pop it! 3 lives."
      Renderer={InflateRenderer}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const balloonsBanked = result.balloonsBanked || 0;
        const balloonsPopped = result.balloonsPopped || 0;
        const perfectBanks = result.perfectBanks || 0;
        const { scorePerSilver, perfectBankBonus } = Config.game.inflate;
        const baseSilver = Math.floor(score / scorePerSilver);
        const bonusSilver = Math.floor(perfectBanks / perfectBankBonus);

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Score</span>
              <span className="text-white">{score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Balloons banked</span>
              <span className="text-white">{balloonsBanked}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Balloons popped</span>
              <span className="text-white">{balloonsPopped}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Perfect banks</span>
              <span className="text-white">{perfectBanks}</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/50">Silver</span>
              <span className="text-skin-gold">{baseSilver} + {bonusSilver} bonus</span>
            </div>
          </div>
        );
      }}
    />
  );
}
