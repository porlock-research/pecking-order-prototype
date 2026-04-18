import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import ColorMatchRenderer from './ColorMatchRenderer';

interface ColorMatchProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendGameAction: (type: string, payload?: Record<string, any>) => void };
  onDismiss?: () => void;
}

export default function ColorMatch(props: ColorMatchProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={ColorMatchRenderer}
      renderHero={(result) => {
        const correct = result.correctAnswers || 0;
        const total = result.totalRounds || 0;
        const streak = result.streak || 0;
        return <ColorMatchHero correct={correct} total={total} streak={streak} />;
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
 * Bespoke peak frame for Color Match — a cluster of ink-blot circles
 * in the game's five colors, with correct-answer count overlaid.
 * High accuracy = blots in a tight neat arrangement; low = scattered.
 */
function ColorMatchHero({ correct, total, streak }: { correct: number; total: number; streak: number }) {
  const accent = 'var(--po-orange)';
  const colors = ['var(--po-orange)', 'var(--po-pink)', 'var(--po-violet)', 'var(--po-blue)', 'var(--po-green)'];
  const accuracy = total > 0 ? correct / total : 0;
  // Cluster radius: high accuracy → tight, low → spread
  const radius = 12 + (1 - accuracy) * 28;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.45}>
        <svg width={140} height={140} viewBox="-70 -70 140 140" aria-hidden>
          {/* Five ink-blot circles arranged in a star pattern */}
          {colors.map((color, i) => {
            const angle = (i / colors.length) * Math.PI * 2 - Math.PI / 2;
            const cx = Math.cos(angle) * radius;
            const cy = Math.sin(angle) * radius;
            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={20}
                fill={color}
                opacity={0.72}
                style={{ mixBlendMode: 'screen' as const }}
              />
            );
          })}
          {/* Center accuracy ring */}
          <circle cx={0} cy={0} r={22} fill="var(--po-bg-deep)" opacity={0.5} />
          <text
            x={0} y={2}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 18,
              fontWeight: 800,
              fill: 'var(--po-text)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {correct}/{total}
          </text>
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={Math.round(accuracy * 100)} label="accuracy" accent={accent} suffix="%" />
        <HeroStat value={streak} label="streak" accent="var(--po-gold)" suffix="×" />
      </HeroStatRow>
    </div>
  );
}
