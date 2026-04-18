import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import GapRunRenderer from './GapRunRenderer';

interface GapRunProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function GapRun(props: GapRunProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={GapRunRenderer}
      renderBreakdown={(result, silverReward) => {
        const distance = result.distance || 0;
        const jumps = result.jumps || 0;
        const timeElapsed = result.timeElapsed || 0;
        const { maxDistanceSilver, distancePerSilver, survivalGraceMs, survivalBonus: survivalBonusValue } = Config.game.gapRun;
        const distanceSilver = Math.min(maxDistanceSilver, Math.floor(distance / distancePerSilver));
        const survived = distance > 0 && timeElapsed >= (props.cartridge.timeLimit || Config.game.gapRun.timeLimitMs) - survivalGraceMs;
        const survivalBonus = survived ? survivalBonusValue : 0;

        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Distance</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{distance}m</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Distance Silver</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{distanceSilver} silver</span>
            </div>
            {survivalBonus > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 700 }}>Survival Bonus</span>
                <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>+{survivalBonus} silver</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Jumps</span>
              <span style={{ color: 'var(--po-text)' }}>{jumps}</span>
            </div>
          </div>
        );
      }}
    />
  );
}
