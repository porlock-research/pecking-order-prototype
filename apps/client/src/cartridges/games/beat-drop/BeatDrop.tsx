import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import BeatDropRenderer from './BeatDropRenderer';

interface BeatDropProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function BeatDrop(props: BeatDropProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={BeatDropRenderer}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const perfectHits = result.perfectHits || 0;
        const maxCombo = result.maxCombo || 0;
        const accuracyPct = result.accuracyPct || 0;
        const { scorePerSilver, perfectAccuracyBonus } = Config.game.beatDrop;
        const baseSilver = Math.floor(score / scorePerSilver);
        const bonusSilver = accuracyPct === 100 ? perfectAccuracyBonus : 0;

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Score</span>
              <span className="text-white">{score.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Perfect hits</span>
              <span className="text-white">{perfectHits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Max combo</span>
              <span className="text-white">{maxCombo}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Accuracy</span>
              <span className="text-white">{accuracyPct}%</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/50">Silver</span>
              <span className="text-skin-gold">{baseSilver}{bonusSilver > 0 ? ` + ${bonusSilver} perfect bonus` : ''}</span>
            </div>
          </div>
        );
      }}
    />
  );
}
