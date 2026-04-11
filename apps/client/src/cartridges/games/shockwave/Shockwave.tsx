import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import ShockwaveRenderer from './ShockwaveRenderer';

interface ShockwaveProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Shockwave(props: ShockwaveProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Shockwave"
      description="Dodge the contracting rings! Move toward your cursor/finger, click to dash. Survive as long as you can."
      Renderer={ShockwaveRenderer}
      renderBreakdown={(result) => {
        const wavesCleared = result.wavesCleared || 0;
        const nearMisses = result.nearMisses || 0;
        const maxCombo = result.maxCombo || 0;
        const { scorePerSilver, nearMissBonus } = Config.game.shockwave;
        const waveSilver = Math.floor(wavesCleared / scorePerSilver);
        const bonusSilver = Math.floor(nearMisses / nearMissBonus);

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Waves cleared</span>
              <span className="text-white">{wavesCleared}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Near misses</span>
              <span className="text-white">{nearMisses}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Max combo</span>
              <span className="text-white">{maxCombo}x</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/50">Silver</span>
              <span className="text-skin-gold">{waveSilver} + {bonusSilver} bonus</span>
            </div>
          </div>
        );
      }}
    />
  );
}
