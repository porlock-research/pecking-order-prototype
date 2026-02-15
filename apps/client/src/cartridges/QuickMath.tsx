import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from './ArcadeGameWrapper';
import QuickMathRenderer from './QuickMathRenderer';

interface QuickMathProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendGameAction: (type: string, payload?: Record<string, any>) => void };
  onDismiss?: () => void;
}

export default function QuickMath(props: QuickMathProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Quick Math"
      description="Solve arithmetic problems as fast as you can. 5 seconds per question, 15 questions total. Difficulty increases with harder operations."
      Renderer={QuickMathRenderer}
      renderBreakdown={(result) => {
        const correct = result.correctAnswers || 0;
        const total = result.totalRounds || 0;
        const streak = result.streak || 0;
        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between text-skin-dim">
              <span>Correct</span>
              <span className="text-skin-base font-bold">{correct}/{total}</span>
            </div>
            <div className="flex justify-between text-skin-dim">
              <span>Accuracy</span>
              <span className="text-skin-base font-bold">{total > 0 ? Math.round(correct / total * 100) : 0}%</span>
            </div>
            {streak > 1 && (
              <div className="flex justify-between">
                <span className="text-skin-gold gold-glow">Best Streak</span>
                <span className="text-skin-gold font-bold gold-glow">{streak}x</span>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
