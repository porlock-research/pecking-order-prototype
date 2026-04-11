import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import OrbitRenderer from './OrbitRenderer';

interface OrbitProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Orbit(props: OrbitProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Orbit"
      description="Tap to release your planet and fly to the next star. Time your release carefully — miss and you drift into the void."
      Renderer={OrbitRenderer}
      renderBreakdown={(result) => {
        const transfers = result.transfers || 0;
        const perfectCaptures = result.perfectCaptures || 0;
        const { transfersPerSilver, perfectsPerBonusSilver } = Config.game.orbit;
        const baseSilver = Math.floor(transfers / transfersPerSilver);
        const bonusSilver = Math.floor(perfectCaptures / perfectsPerBonusSilver);

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Transfers</span>
              <span className="text-white">{transfers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Perfect captures</span>
              <span className="text-white">{perfectCaptures}</span>
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
