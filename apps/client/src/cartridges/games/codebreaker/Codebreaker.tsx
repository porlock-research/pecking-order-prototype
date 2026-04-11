import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import CodebreakerRenderer from './CodebreakerRenderer';

interface CodebreakerProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Codebreaker(props: CodebreakerProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      title="Codebreaker"
      description="Crack the hidden color code! Guess, get feedback, deduce. Fewer guesses = more points."
      Renderer={CodebreakerRenderer}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const codesCracked = result.codesCracked || 0;
        const averageGuesses = result.averageGuesses || 0;
        const bestSolve = result.bestSolve || 0;
        const { scorePerSilver, geniusBonus } = Config.game.codebreaker;
        const baseSilver = Math.floor(score / scorePerSilver);
        const bonus = bestSolve <= 2 ? geniusBonus : 0;

        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-white/50">Score</span>
              <span className="text-white">{score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Codes cracked</span>
              <span className="text-white">{codesCracked}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Avg guesses</span>
              <span className="text-white">{averageGuesses}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Best solve</span>
              <span className="text-white">{bestSolve} guess{bestSolve !== 1 ? 'es' : ''}</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between">
              <span className="text-white/50">Silver</span>
              <span className="text-skin-gold">{baseSilver}{bonus > 0 ? ` + ${bonus} genius bonus` : ''}</span>
            </div>
          </div>
        );
      }}
    />
  );
}
