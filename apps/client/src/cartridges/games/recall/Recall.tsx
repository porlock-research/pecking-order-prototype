import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import RecallRenderer from './RecallRenderer';

interface RecallProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Recall(props: RecallProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Recall"
      description="Memorize the grid. Tap 1 to lock in — the other numbers vanish. Then tap them in order from memory. Grids grow 3×3 → 6×6."
      Renderer={RecallRenderer}
      renderBreakdown={(result) => {
        const roundsCleared = result.roundsCleared || 0;
        const highestSize = result.highestSize || 0;
        const fullClear = result.fullClear || 0;
        const { silverBySize, fullClearGold } = Config.game.recall;
        let silver = 0;
        for (let n = 0; n <= highestSize; n++) silver += silverBySize[n] ?? 0;
        const gold = fullClear ? fullClearGold : 0;

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Rounds cleared</span>
              <span className="text-white">{roundsCleared}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Highest grid</span>
              <span className="text-white">{highestSize > 0 ? `${highestSize}×${highestSize}` : '—'}</span>
            </div>
            {fullClear > 0 && (
              <div className="flex justify-between">
                <span className="text-white/50">Full clear</span>
                <span className="text-skin-gold">PERFECT</span>
              </div>
            )}
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/50">Rewards</span>
              <span className="text-skin-gold">{silver} silver · {gold} gold</span>
            </div>
          </div>
        );
      }}
    />
  );
}
