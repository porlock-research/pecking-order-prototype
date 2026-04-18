import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import FlappyRenderer from './FlappyRenderer';

interface FlappyProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Flappy(props: FlappyProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={FlappyRenderer}
      renderHero={(result) => {
        const score = result.score || 0;
        const coinsCollected = result.coinsCollected || 0;
        return <FlappyHero score={score} coinsCollected={coinsCollected} />;
      }}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const coinsCollected = result.coinsCollected || 0;
        const { scorePerSilver, coinBonus } = Config.game.flappy;
        const baseSilver = Math.floor(score / scorePerSilver);
        const bonusSilver = Math.floor(coinsCollected / coinBonus);

        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Score</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Coins</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{coinsCollected}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--po-border)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Silver</span>
              <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{baseSilver} + {bonusSilver} bonus</span>
            </div>
          </div>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Flappy — a stylized bird silhouette with
 * a trailing arc of dots whose count scales with score. The arc
 * reads as "this is how far you flew".
 */
function FlappyHero({ score, coinsCollected }: { score: number; coinsCollected: number }) {
  const accent = 'var(--po-blue)';
  const arcDots = Math.max(6, Math.min(24, Math.round(score * 1.2)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.45}>
        <svg width={160} height={120} viewBox="-80 -60 160 120" aria-hidden>
          {/* Trailing arc — from bottom-left to the bird */}
          {Array.from({ length: arcDots }, (_, i) => {
            const t = i / arcDots;
            const x = -70 + t * 75;
            const y = 40 - Math.sin(t * Math.PI * 0.6) * 55;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={2 + t * 1.5}
                fill={accent}
                opacity={0.2 + t * 0.55}
              />
            );
          })}
          {/* Bird body */}
          <g transform="translate(18, -14)">
            <ellipse cx={0} cy={0} rx={18} ry={13} fill={accent} />
            {/* Wing */}
            <path d="M -6 -2 Q -14 -14 -22 -6 Q -14 -2 -10 0 Z" fill="color-mix(in oklch, var(--po-blue) 75%, white)" />
            {/* Eye */}
            <circle cx={8} cy={-3} r={2.5} fill="var(--po-text)" />
            <circle cx={9} cy={-3.5} r={1} fill="var(--po-bg-deep)" />
            {/* Beak */}
            <path d="M 16 0 L 24 -2 L 24 4 Z" fill="var(--po-orange)" />
          </g>
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={score} label="pipes" accent={accent} />
        <HeroStat value={coinsCollected} label="coins" accent="var(--po-gold)" />
      </HeroStatRow>
    </div>
  );
}
