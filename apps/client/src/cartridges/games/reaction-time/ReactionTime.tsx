import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import ReactionTimeRenderer from './ReactionTimeRenderer';

interface ReactionTimeProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendGameAction: (type: string, payload?: Record<string, any>) => void };
  onDismiss?: () => void;
}

export default function ReactionTime(props: ReactionTimeProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={ReactionTimeRenderer}
      renderHero={(result) => {
        const avg = result.avgReactionMs || 0;
        const best = result.bestReactionMs || 0;
        return <ReactionTimeHero avgMs={avg} bestMs={best} />;
      }}
      renderBreakdown={(result) => {
        const avg = result.avgReactionMs || 0;
        const best = result.bestReactionMs || 0;
        const rounds = result.roundsCompleted || 0;
        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Average</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{avg}ms</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Best</span>
              <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{best}ms</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Rounds</span>
              <span style={{ color: 'var(--po-text)' }}>{rounds}</span>
            </div>
          </div>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Reaction Time — concentric rings, with the
 * inner ring's radius mapped inversely to reaction time. Faster =
 * smaller, tighter bullseye. The BEST time sits in the center in pink.
 */
function ReactionTimeHero({ avgMs, bestMs }: { avgMs: number; bestMs: number }) {
  const accent = 'var(--po-pink)';
  // Inverse map: 150ms = tightest (20px), 500ms+ = loosest (56px)
  const innerRadius = Math.max(18, Math.min(56, 56 - Math.max(0, 500 - bestMs) * 0.11));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.5}>
        <svg width={140} height={140} viewBox="-70 -70 140 140" aria-hidden>
          {/* Outer aim ring */}
          <circle cx={0} cy={0} r={62} fill="none" stroke={`color-mix(in oklch, ${accent} 20%, transparent)`} strokeWidth={1} />
          <circle cx={0} cy={0} r={48} fill="none" stroke={`color-mix(in oklch, ${accent} 30%, transparent)`} strokeWidth={1} />
          {/* Average reaction ring */}
          <circle cx={0} cy={0} r={Math.min(56, Math.max(22, 22 + (avgMs - 150) * 0.1))}
                  fill="none" stroke={`color-mix(in oklch, ${accent} 55%, transparent)`} strokeWidth={2} strokeDasharray="4 3" />
          {/* Best reaction ring (filled) */}
          <circle cx={0} cy={0} r={innerRadius}
                  fill={`color-mix(in oklch, ${accent} 18%, transparent)`}
                  stroke={accent} strokeWidth={2} />
          {/* Bullseye dot */}
          <circle cx={0} cy={0} r={4} fill={accent} />
          {/* Crosshairs */}
          <line x1={-64} y1={0} x2={-52} y2={0} stroke={`color-mix(in oklch, ${accent} 40%, transparent)`} strokeWidth={1} />
          <line x1={52} y1={0} x2={64} y2={0} stroke={`color-mix(in oklch, ${accent} 40%, transparent)`} strokeWidth={1} />
          <line x1={0} y1={-64} x2={0} y2={-52} stroke={`color-mix(in oklch, ${accent} 40%, transparent)`} strokeWidth={1} />
          <line x1={0} y1={52} x2={0} y2={64} stroke={`color-mix(in oklch, ${accent} 40%, transparent)`} strokeWidth={1} />
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={avgMs} label="average" accent={accent} suffix="ms" size={24} />
        <HeroStat value={bestMs} label="best" accent="var(--po-gold)" suffix="ms" size={24} />
      </HeroStatRow>
    </div>
  );
}
