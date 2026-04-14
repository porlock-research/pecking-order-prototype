import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import BlinkRenderer from './BlinkRenderer';

interface BlinkProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Blink(props: BlinkProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Blink"
      description="Tap on BLACK. Freeze on WHITE. Black = +1. White = −3. The flash is a trap."
      Renderer={BlinkRenderer}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const blackTaps = result.blackTaps || 0;
        const whiteTaps = result.whiteTaps || 0;
        const longestStreak = result.longestStreak || 0;
        const { scorePerSilver, scorePerGold, whitePenalty } = Config.game.blink;
        const silver = Math.floor(score / scorePerSilver);
        const gold = Math.floor(score / scorePerGold);

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Score</span>
              <span className="text-white">{score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Black taps</span>
              <span className="text-white">+{blackTaps}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">White taps</span>
              <span className="text-skin-danger">−{whiteTaps * whitePenalty} ({whiteTaps})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Longest streak</span>
              <span className="text-white">×{longestStreak}</span>
            </div>
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
