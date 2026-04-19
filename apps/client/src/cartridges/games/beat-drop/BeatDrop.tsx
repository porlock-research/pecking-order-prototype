import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import BeatDropRenderer from './BeatDropRenderer';

interface BeatDropProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function BeatDrop(props: BeatDropProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={BeatDropRenderer}
      renderHero={(result) => {
        const maxCombo = result.maxCombo || 0;
        const perfectHits = result.perfectHits || 0;
        const accuracyPct = result.accuracyPct || 0;
        return <BeatDropHero maxCombo={maxCombo} perfectHits={perfectHits} accuracyPct={accuracyPct} />;
      }}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const perfectHits = result.perfectHits || 0;
        const maxCombo = result.maxCombo || 0;
        const accuracyPct = result.accuracyPct || 0;
        const { scorePerSilver, perfectAccuracyBonus } = Config.game.beatDrop;
        const baseSilver = Math.floor(score / scorePerSilver);
        const bonusSilver = accuracyPct === 100 ? perfectAccuracyBonus : 0;

        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Score</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{score.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Perfect hits</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{perfectHits}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Max combo</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{maxCombo}x</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Accuracy</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{accuracyPct}%</span>
            </div>
            <div style={{ borderTop: '1px solid var(--po-border)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Silver</span>
              <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{baseSilver}{bonusSilver > 0 ? ` + ${bonusSilver} perfect bonus` : ''}</span>
            </div>
          </div>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Beat Drop — a waveform that crescendos to
 * the player's max combo, with "perfect" hit dots marked in pink.
 * Reads as a frozen rhythm snapshot.
 */
function BeatDropHero({
  maxCombo,
  perfectHits,
  accuracyPct,
}: {
  maxCombo: number;
  perfectHits: number;
  accuracyPct: number;
}) {
  const accent = 'var(--po-pink)';
  const pink = 'var(--po-pink)';
  const bars = 20;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.5}>
        <svg width={180} height={110} viewBox="-90 -55 180 110" aria-hidden>
          {/* Waveform bars — heights peak in the middle (climax) */}
          {Array.from({ length: bars }, (_, i) => {
            const t = i / (bars - 1);
            const climax = Math.sin(t * Math.PI);
            const jitter = (i % 3 === 0 ? 0.85 : i % 2 === 0 ? 1 : 0.7);
            const h = 6 + climax * jitter * (14 + maxCombo * 0.5);
            const x = -80 + i * 8;
            const isPerfect = i < Math.round((perfectHits / Math.max(1, bars)) * bars);
            const fill = isPerfect ? pink : `color-mix(in oklch, ${pink} 45%, transparent)`;
            return (
              <rect
                key={i}
                x={x}
                y={-h}
                width={5}
                height={h * 2}
                rx={2}
                fill={fill}
              />
            );
          })}
          {/* Center beat marker */}
          <circle cx={0} cy={0} r={5} fill={pink} />
          <circle cx={0} cy={0} r={12} fill="none" stroke={pink} strokeWidth={1} opacity={0.5} />
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={maxCombo} label="max combo" accent={pink} suffix="×" />
        <HeroStat value={accuracyPct} label="accuracy" accent={pink} suffix="%" />
      </HeroStatRow>
    </div>
  );
}
