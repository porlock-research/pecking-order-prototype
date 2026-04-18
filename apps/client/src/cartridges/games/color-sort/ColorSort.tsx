import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import ColorSortRenderer from './ColorSortRenderer';

interface ColorSortProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function ColorSort(props: ColorSortProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={ColorSortRenderer}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const sortedTubes = result.sortedTubes || 0;
        const solved = result.solved || 0;
        const { scorePerSilver, solvedBonus } = Config.game.colorSort;
        const baseSilver = Math.floor(score / scorePerSilver);
        const bonus = solved ? solvedBonus : 0;

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Tubes sorted</span>
              <span className="text-white">{sortedTubes} / 5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Fully solved</span>
              <span className="text-white">{solved ? 'Yes' : 'No'}</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/50">Silver</span>
              <span className="text-skin-gold">{baseSilver}{bonus ? ` + ${bonus} bonus` : ''}</span>
            </div>
          </div>
        );
      }}
    />
  );
}
