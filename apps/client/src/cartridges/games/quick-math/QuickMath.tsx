import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import QuickMathRenderer from './QuickMathRenderer';

interface QuickMathProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendGameAction: (type: string, payload?: Record<string, any>) => void };
  onDismiss?: () => void;
}

export default function QuickMath(props: QuickMathProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={QuickMathRenderer}
      renderHero={(result) => {
        const correct = result.correctAnswers || 0;
        const total = result.totalRounds || 0;
        const streak = result.streak || 0;
        return <QuickMathHero correct={correct} total={total} streak={streak} />;
      }}
      renderBreakdown={(result) => {
        const correct = result.correctAnswers || 0;
        const total = result.totalRounds || 0;
        const streak = result.streak || 0;
        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Correct</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{correct}/{total}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Accuracy</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{total > 0 ? Math.round(correct / total * 100) : 0}%</span>
            </div>
            {streak > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 700 }}>Best Streak</span>
                <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{streak}x</span>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Quick Math — an equals-sign composition
 * with the player's correct/total fraction on the left and total
 * time-efficient streak on the right. Reads as an exam stamp.
 */
function QuickMathHero({ correct, total, streak }: { correct: number; total: number; streak: number }) {
  const accent = 'var(--po-green)';
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.4}>
        <svg width={180} height={110} viewBox="-90 -55 180 110" aria-hidden>
          {/* Answer slate — a chalkboard look with the fraction */}
          <rect
            x={-80} y={-40}
            width={160} height={80}
            rx={10}
            fill="color-mix(in oklch, var(--po-green) 10%, var(--po-bg-deep))"
            stroke={`color-mix(in oklch, ${accent} 40%, transparent)`}
            strokeWidth={1.25}
          />
          {/* Fraction bar */}
          <line x1={-22} y1={0} x2={22} y2={0} stroke={accent} strokeWidth={2} strokeLinecap="round" />
          {/* Numerator */}
          <text
            x={0} y={-8}
            textAnchor="middle"
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 22,
              fontWeight: 800,
              fill: 'var(--po-text)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {correct}
          </text>
          {/* Denominator */}
          <text
            x={0} y={22}
            textAnchor="middle"
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 18,
              fontWeight: 700,
              fill: 'var(--po-text-dim)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {total}
          </text>
          {/* Equals sign on the right */}
          <line x1={34} y1={-6} x2={60} y2={-6} stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
          <line x1={34} y1={6} x2={60} y2={6} stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
          {/* Accuracy percentage */}
          <text
            x={72} y={2}
            textAnchor="end"
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 16,
              fontWeight: 800,
              fill: accent,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {accuracy}%
          </text>
          {/* Plus/minus/times icons on left side */}
          <g transform="translate(-60, -6)" fill={`color-mix(in oklch, ${accent} 50%, transparent)`}>
            <text style={{ fontFamily: 'var(--po-font-display)', fontSize: 14, fontWeight: 800 }}>+</text>
            <text y={12} style={{ fontFamily: 'var(--po-font-display)', fontSize: 14, fontWeight: 800 }}>×</text>
          </g>
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={correct} label="correct" accent={accent} />
        <HeroStat value={streak} label="streak" accent="var(--po-gold)" suffix="×" />
      </HeroStatRow>
    </div>
  );
}
