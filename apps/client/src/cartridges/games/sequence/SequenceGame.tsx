import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import SequenceRenderer from './SequenceRenderer';

interface SequenceGameProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function SequenceGame(props: SequenceGameProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={SequenceRenderer}
      renderHero={(result) => {
        const correctRounds = result.correctRounds || 0;
        const score = result.score || 0;
        return <SequenceHero correctRounds={correctRounds} score={score} />;
      }}
      renderBreakdown={(result) => {
        const correctRounds = result.correctRounds || 0;
        const score = result.score || 0;

        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Rounds Survived</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{correctRounds}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Total Score</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{score} pts</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Max Sequence</span>
              <span style={{ color: 'var(--po-text)' }}>{3 + correctRounds - 1} numbers</span>
            </div>
          </div>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Sequence — numbered tiles in order,
 * chained left-to-right. Length of the chain = longest sequence
 * the player recalled. Last correct tile glows, last failed (if
 * any) is marked dim with a broken-link gap.
 */
function SequenceHero({ correctRounds, score }: { correctRounds: number; score: number }) {
  const accent = 'var(--po-blue)';
  const maxLen = 3 + correctRounds - 1;
  const visible = Math.max(3, Math.min(10, maxLen));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.4}>
        <svg width={200} height={80} viewBox="-100 -40 200 80" aria-hidden>
          {Array.from({ length: visible }, (_, i) => {
            const x = -86 + i * 20;
            const isLast = i === visible - 1;
            return (
              <g key={i}>
                {/* Chain connector */}
                {i > 0 && (
                  <line
                    x1={x - 20 + 10}
                    y1={0}
                    x2={x - 10}
                    y2={0}
                    stroke={`color-mix(in oklch, ${accent} 40%, transparent)`}
                    strokeWidth={1.25}
                  />
                )}
                {/* Tile */}
                <rect
                  x={x - 9}
                  y={-11}
                  width={18}
                  height={22}
                  rx={3}
                  fill={isLast ? accent : `color-mix(in oklch, ${accent} 22%, transparent)`}
                  stroke={isLast ? accent : `color-mix(in oklch, ${accent} 48%, transparent)`}
                  strokeWidth={1}
                />
                {/* Tile number */}
                <text
                  x={x}
                  y={3}
                  textAnchor="middle"
                  style={{
                    fontFamily: 'var(--po-font-display)',
                    fontSize: 12,
                    fontWeight: 800,
                    fill: isLast ? 'var(--po-bg-deep)' : 'var(--po-text)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={correctRounds} label="rounds" accent={accent} />
        <HeroStat value={maxLen} label="longest" accent={accent} />
      </HeroStatRow>
    </div>
  );
}
