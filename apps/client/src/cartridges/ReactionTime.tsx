import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from './ArcadeGameWrapper';
import ReactionTimeRenderer from './ReactionTimeRenderer';

interface ReactionTimeProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendGameAction: (type: string, payload?: Record<string, any>) => void };
  onDismiss?: () => void;
}

export default function ReactionTime(props: ReactionTimeProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Reaction Time"
      description="Wait for the screen to turn green, then tap as fast as you can. 5 rounds — your average reaction time determines your score."
      Renderer={ReactionTimeRenderer}
      renderBreakdown={(result) => {
        const avg = result.avgReactionMs || 0;
        const best = result.bestReactionMs || 0;
        const rounds = result.roundsCompleted || 0;
        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between text-skin-dim">
              <span>Average</span>
              <span className="text-skin-base font-bold">{avg}ms</span>
            </div>
            <div className="flex justify-between text-skin-dim">
              <span>Best</span>
              <span className="text-skin-gold font-bold">{best}ms</span>
            </div>
            <div className="flex justify-between text-skin-dim">
              <span>Rounds</span>
              <span className="text-skin-base">{rounds}</span>
            </div>
          </div>
        );
      }}
    />
  );
}
