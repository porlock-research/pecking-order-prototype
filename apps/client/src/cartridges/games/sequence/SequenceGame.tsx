import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import SequenceRenderer from './SequenceRenderer';

interface SequenceGameProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function SequenceGame(props: SequenceGameProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Sequence"
      description="Memorize a sequence of numbers, then recall the one at the highlighted position. Each round adds one more number. How far can you go?"
      Renderer={SequenceRenderer}
      renderBreakdown={(result) => {
        const correctRounds = result.correctRounds || 0;
        const score = result.score || 0;

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between text-skin-dim">
              <span>Rounds Survived</span>
              <span className="text-skin-base font-bold">{correctRounds}</span>
            </div>
            <div className="flex justify-between text-skin-dim">
              <span>Total Score</span>
              <span className="text-skin-base font-bold">{score} pts</span>
            </div>
            <div className="flex justify-between text-skin-dim">
              <span>Max Sequence</span>
              <span className="text-skin-base">{3 + correctRounds - 1} numbers</span>
            </div>
          </div>
        );
      }}
    />
  );
}
