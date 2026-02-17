import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import SimonSaysRenderer from './SimonSaysRenderer';

interface SimonSaysProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendGameAction: (type: string, payload?: Record<string, any>) => void };
  onDismiss?: () => void;
}

export default function SimonSays(props: SimonSaysProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Simon Says"
      description="Watch the colored pads flash in a pattern, then repeat it. The sequence grows by one each round. How long can you keep up?"
      Renderer={SimonSaysRenderer}
      renderBreakdown={(result) => {
        const rounds = result.roundsCompleted || 0;
        const longest = result.longestSequence || 0;
        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between text-skin-dim">
              <span>Rounds Survived</span>
              <span className="text-skin-base font-bold">{rounds}</span>
            </div>
            <div className="flex justify-between text-skin-dim">
              <span>Longest Sequence</span>
              <span className="text-skin-base font-bold">{longest}</span>
            </div>
          </div>
        );
      }}
    />
  );
}
