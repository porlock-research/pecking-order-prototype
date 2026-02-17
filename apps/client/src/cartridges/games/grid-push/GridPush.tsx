import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import GridPushRenderer from './GridPushRenderer';

interface GridPushProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function GridPush(props: GridPushProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Grid Push"
      description="Flip tiles to build runs. Each safe flip scores its position (1st=1, 2nd=2...). Bank to lock in points. Hit a bomb and your current run is lost!"
      Renderer={GridPushRenderer}
      renderBreakdown={(result) => {
        const bankedTotal = result.bankedTotal || 0;
        const longestRun = result.longestRun || 0;
        const totalFlips = result.totalFlips || 0;

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between text-skin-dim">
              <span>Banked Total</span>
              <span className="text-skin-base font-bold">{bankedTotal} pts</span>
            </div>
            <div className="flex justify-between text-skin-dim">
              <span>Longest Run</span>
              <span className="text-skin-base font-bold">{longestRun} flips</span>
            </div>
            <div className="flex justify-between text-skin-dim">
              <span>Total Flips</span>
              <span className="text-skin-base">{totalFlips}</span>
            </div>
          </div>
        );
      }}
    />
  );
}
