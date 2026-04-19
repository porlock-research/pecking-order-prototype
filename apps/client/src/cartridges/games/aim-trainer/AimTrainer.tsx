import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
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
      Renderer={AimTrainerRenderer}
      renderHero={(result) => {
        const hits = result.targetsHit || 0;
        const total = result.totalTargets || 0;
        const score = result.score || 0;
        const accuracy = total > 0 ? Math.round((hits / total) * 100) : 0;
        return <AimTrainerHero hits={hits} total={total} accuracy={accuracy} score={score} />;
      }}
      renderBreakdown={(result) => {
        const hits = result.targetsHit || 0;
        const total = result.totalTargets || 0;
        const score = result.score || 0;
        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Targets Hit</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{hits}/{total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Accuracy</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{total > 0 ? Math.round(hits / total * 100) : 0}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Score</span>
              <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{score} pts</span>
            </div>
          </div>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Aim Trainer — concentric target rings with
 * hit-dots scattered across them. Accuracy drives where the dots
 * land: high accuracy = tight center cluster; low = scattered.
 */
function AimTrainerHero({
  hits,
  total: _total,
  accuracy,
  score: _score,
}: {
  hits: number;
  total: number;
  accuracy: number;
  score: number;
}) {
  const accent = 'var(--po-orange)';
  const dotCount = Math.min(18, hits);
  // Deterministic "scatter" keyed off hit count
  const dots = Array.from({ length: dotCount }, (_, i) => {
    const seed = (i * 97) % 360;
    const spread = 54 * (1 - accuracy / 100) + 8;
    const r = spread + Math.sin(i * 1.7) * 8;
    const angle = (seed * Math.PI) / 180;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.4}>
        <svg width={140} height={140} viewBox="-70 -70 140 140" aria-hidden>
          {/* Target rings — 5 band */}
          {[60, 46, 32, 20, 10].map((r, i) => (
            <circle
              key={r}
              cx={0} cy={0} r={r}
              fill={i === 0 ? 'var(--po-bg-glass)' : 'none'}
              stroke={`color-mix(in oklch, ${accent} ${24 + i * 8}%, transparent)`}
              strokeWidth={1.25}
            />
          ))}
          {/* Bullseye */}
          <circle cx={0} cy={0} r={4} fill={accent} />
          {/* Hit dots */}
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={2.5} fill={accent} opacity={0.9} />
          ))}
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={hits} label="hits" accent={accent} />
        <HeroStat value={accuracy} label="accuracy" accent={accent} suffix="%" />
      </HeroStatRow>
    </div>
  );
}
