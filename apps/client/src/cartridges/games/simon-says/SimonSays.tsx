import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import SimonSaysRenderer from './SimonSaysRenderer';

interface SimonSaysProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendGameAction: (type: string, payload?: Record<string, any>) => void };
  onDismiss?: () => void;
}

export default function SimonSays(props: SimonSaysProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={SimonSaysRenderer}
      renderHero={(result) => {
        const rounds = result.roundsCompleted || 0;
        const longest = result.longestSequence || 0;
        return <SimonSaysHero rounds={rounds} longest={longest} />;
      }}
      renderBreakdown={(result) => {
        const rounds = result.roundsCompleted || 0;
        const longest = result.longestSequence || 0;
        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Rounds Survived</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{rounds}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Longest Sequence</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{longest}</span>
            </div>
          </div>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Simon Says — the classic 4-quadrant wheel
 * with a pulse ring showing the "last-recalled" note glowing in green.
 * Longest sequence pips arc around the wheel.
 */
function SimonSaysHero({ rounds, longest }: { rounds: number; longest: number }) {
  const accent = 'var(--po-green)';
  // Four quadrant colors from the Pulse accent family
  const quads = [
    { color: 'var(--po-green)', angle: 225 },
    { color: 'var(--po-pink)', angle: 315 },
    { color: 'var(--po-orange)', angle: 45 },
    { color: 'var(--po-blue)', angle: 135 },
  ];
  const lastIdx = longest % 4;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.45}>
        <svg width={140} height={140} viewBox="-70 -70 140 140" aria-hidden>
          {/* Four quadrants — top-left, top-right, bottom-right, bottom-left */}
          {quads.map((q, i) => {
            const isLast = i === lastIdx;
            const opacity = isLast ? 0.95 : 0.55;
            // Quadrant path — 90° pie slice from center
            const startAngle = i * 90;
            const endAngle = (i + 1) * 90;
            const r = 52;
            const x1 = Math.cos((startAngle * Math.PI) / 180) * r;
            const y1 = Math.sin((startAngle * Math.PI) / 180) * r;
            const x2 = Math.cos((endAngle * Math.PI) / 180) * r;
            const y2 = Math.sin((endAngle * Math.PI) / 180) * r;
            const path = `M 0 0 L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
            return (
              <path
                key={i}
                d={path}
                fill={q.color}
                opacity={opacity}
                stroke="var(--po-bg-deep)"
                strokeWidth={3}
              />
            );
          })}
          {/* Center button */}
          <circle cx={0} cy={0} r={14} fill="var(--po-bg-deep)" />
          <circle cx={0} cy={0} r={14} fill="none" stroke={accent} strokeWidth={1.5} />
          {/* Longest-sequence pip arc */}
          {Array.from({ length: Math.min(longest, 20) }, (_, i) => {
            const angle = -Math.PI / 2 + (i / 20) * Math.PI * 2;
            return (
              <circle
                key={i}
                cx={Math.cos(angle) * 62}
                cy={Math.sin(angle) * 62}
                r={1.8}
                fill="var(--po-gold)"
                opacity={0.85}
              />
            );
          })}
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={rounds} label="rounds" accent={accent} />
        <HeroStat value={longest} label="longest" accent="var(--po-gold)" />
      </HeroStatRow>
    </div>
  );
}
