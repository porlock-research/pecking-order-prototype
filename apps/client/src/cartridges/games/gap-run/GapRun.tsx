import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
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
      renderHero={(result) => {
        const distance = result.distance || 0;
        const jumps = result.jumps || 0;
        return <GapRunHero distance={distance} jumps={jumps} />;
      }}
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

/**
 * Bespoke peak frame for Gap Run — a horizontal track with vertical
 * obstacle bars, and the runner's footprint path threading the gaps.
 * Length of the track scales with distance covered.
 */
function GapRunHero({ distance, jumps }: { distance: number; jumps: number }) {
  const accent = 'var(--po-orange)';
  // Number of obstacle bars scales with distance (min 4, max 14)
  const bars = Math.max(4, Math.min(14, Math.round(distance / 30)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.4}>
        <svg width={180} height={100} viewBox="-90 -50 180 100" aria-hidden>
          {/* Ground line */}
          <line x1={-82} y1={24} x2={82} y2={24} stroke={`color-mix(in oklch, ${accent} 40%, transparent)`} strokeWidth={1.25} />
          {/* Obstacle bars */}
          {Array.from({ length: bars }, (_, i) => {
            const x = -78 + (i + 0.5) * (156 / bars);
            const h = 14 + (i % 3) * 6;
            return (
              <rect key={i} x={x - 2} y={24 - h} width={4} height={h} fill={accent} opacity={0.85} rx={1} />
            );
          })}
          {/* Runner's arc path threading gaps */}
          <path
            d={`M -80 24 ${Array.from({ length: bars }, (_, i) => {
              const x = -78 + (i + 0.5) * (156 / bars);
              return `Q ${x - 4} 6 ${x} 24 T ${x + 4} 24`;
            }).join(' ')}`}
            fill="none"
            stroke="color-mix(in oklch, var(--po-orange) 70%, white)"
            strokeWidth={1.5}
            strokeDasharray="3 2"
            opacity={0.85}
          />
          {/* Runner marker at the end */}
          <circle cx={78} cy={24} r={4} fill="color-mix(in oklch, var(--po-orange) 80%, white)" />
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={distance} label="distance" accent={accent} suffix="m" />
        <HeroStat value={jumps} label="jumps" accent={accent} />
      </HeroStatRow>
    </div>
  );
}
