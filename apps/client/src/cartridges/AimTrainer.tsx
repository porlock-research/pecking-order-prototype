import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from './ArcadeGameWrapper';
import AimTrainerRenderer from './AimTrainerRenderer';

interface AimTrainerProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendGameAction: (type: string, payload?: Record<string, any>) => void };
  onDismiss?: () => void;
}

export default function AimTrainer(props: AimTrainerProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Aim Trainer"
      description="Targets appear and shrink. Tap them before they vanish — the smaller they are when you hit them, the more points you earn. 30 seconds on the clock."
      Renderer={AimTrainerRenderer}
      renderBreakdown={(result) => {
        const hits = result.targetsHit || 0;
        const total = result.totalTargets || 0;
        const score = result.score || 0;
        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between text-skin-dim">
              <span>Targets Hit</span>
              <span className="text-skin-base font-bold">{hits}/{total}</span>
            </div>
            <div className="flex justify-between text-skin-dim">
              <span>Accuracy</span>
              <span className="text-skin-base font-bold">{total > 0 ? Math.round(hits / total * 100) : 0}%</span>
            </div>
            <div className="flex justify-between text-skin-dim">
              <span>Score</span>
              <span className="text-skin-gold font-bold">{score} pts</span>
            </div>
          </div>
        );
      }}
    />
  );
}
