import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import SnakeRenderer from './SnakeRenderer';

interface SnakeProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Snake(props: SnakeProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={SnakeRenderer}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const finalLength = result.finalLength || 0;
        const { scorePerSilver, lengthBonus } = Config.game.snake;
        const baseSilver = Math.floor(score / scorePerSilver);
        const bonusSilver = Math.floor(finalLength / lengthBonus);

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Pellets eaten</span>
              <span className="text-white">{score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Final length</span>
              <span className="text-white">{finalLength}</span>
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
