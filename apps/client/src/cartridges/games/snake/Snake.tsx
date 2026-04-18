import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { ScoreBreakdown, ScoreRow, ScoreDivider } from '../shared';
import SnakeRenderer from './SnakeRenderer';

interface SnakeProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Snake(props: SnakeProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={SnakeRenderer}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const finalLength = result.finalLength || 0;
        const { scorePerSilver, lengthBonus } = Config.game.snake;
        const baseSilver = Math.floor(score / scorePerSilver);
        const bonusSilver = Math.floor(finalLength / lengthBonus);

        return (
          <ScoreBreakdown>
            <ScoreRow label="Pellets eaten" value={score} />
            <ScoreRow label="Final length" value={finalLength} />
            <ScoreDivider />
            <ScoreRow
              label="Silver"
              value={`${baseSilver} + ${bonusSilver} bonus`}
              tone="var(--po-gold)"
              emphasize
            />
          </ScoreBreakdown>
        );
      }}
    />
  );
}
