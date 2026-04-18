import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import BlinkRenderer from './BlinkRenderer';

interface BlinkProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Blink(props: BlinkProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={BlinkRenderer}
      renderHero={(result) => {
        const blackTaps = result.blackTaps || 0;
        const whiteTaps = result.whiteTaps || 0;
        const longestStreak = result.longestStreak || 0;
        return <BlinkHero blackTaps={blackTaps} whiteTaps={whiteTaps} longestStreak={longestStreak} />;
      }}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const blackTaps = result.blackTaps || 0;
        const whiteTaps = result.whiteTaps || 0;
        const longestStreak = result.longestStreak || 0;
        const { scorePerSilver, scorePerGold, whitePenalty } = Config.game.blink;
        const silver = Math.floor(score / scorePerSilver);
        const gold = Math.floor(score / scorePerGold);

        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Score</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Black taps</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>+{blackTaps}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>White taps</span>
              <span style={{ color: 'var(--po-pink)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>−{whiteTaps * whitePenalty} ({whiteTaps})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Longest streak</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>×{longestStreak}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--po-border)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Rewards</span>
              <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{silver} silver · {gold} gold</span>
            </div>
          </div>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Blink — an array of squares, black tapped
 * ones filled in violet, white (penalty) ones crossed out in pink.
 * Longest streak shown as a connected accent line through the grid.
 */
function BlinkHero({
  blackTaps,
  whiteTaps,
  longestStreak,
}: {
  blackTaps: number;
  whiteTaps: number;
  longestStreak: number;
}) {
  const accent = 'var(--po-violet)';
  const penalty = 'var(--po-pink)';
  // 6x4 grid = 24 cells
  const total = 24;
  const blackCount = Math.min(blackTaps, total);
  const whiteStart = blackCount;
  const whiteCount = Math.min(whiteTaps, total - blackCount);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.4}>
        <svg width={180} height={120} viewBox="-90 -60 180 120" aria-hidden>
          {Array.from({ length: total }, (_, i) => {
            const col = i % 6;
            const row = Math.floor(i / 6);
            const x = -78 + col * 28;
            const y = -48 + row * 28;
            const isBlack = i < blackCount;
            const isWhite = i >= whiteStart && i < whiteStart + whiteCount;
            const inStreak = i < longestStreak;
            return (
              <g key={i}>
                <rect
                  x={x - 9}
                  y={y - 9}
                  width={18}
                  height={18}
                  rx={3}
                  fill={isBlack ? accent : isWhite ? `color-mix(in oklch, ${penalty} 18%, transparent)` : 'var(--po-bg-glass)'}
                  stroke={isBlack ? accent : isWhite ? `color-mix(in oklch, ${penalty} 50%, transparent)` : 'var(--po-border)'}
                  strokeWidth={1}
                />
                {isWhite && (
                  <>
                    <line x1={x - 4} y1={y - 4} x2={x + 4} y2={y + 4} stroke={penalty} strokeWidth={1.25} />
                    <line x1={x + 4} y1={y - 4} x2={x - 4} y2={y + 4} stroke={penalty} strokeWidth={1.25} />
                  </>
                )}
                {inStreak && i > 0 && i % 6 !== 0 && (
                  <line
                    x1={x - 28 + 9}
                    y1={y}
                    x2={x - 9}
                    y2={y}
                    stroke="color-mix(in oklch, var(--po-gold) 90%, transparent)"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={blackTaps} label="hits" accent={accent} />
        <HeroStat value={longestStreak} label="streak" accent="var(--po-gold)" suffix="×" />
      </HeroStatRow>
    </div>
  );
}
