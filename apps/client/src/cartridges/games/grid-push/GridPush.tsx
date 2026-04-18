import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import GridPushRenderer from './GridPushRenderer';

interface GridPushProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function GridPush(props: GridPushProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={GridPushRenderer}
      renderHero={(result) => {
        const bankedTotal = result.bankedTotal || 0;
        const longestRun = result.longestRun || 0;
        return <GridPushHero bankedTotal={bankedTotal} longestRun={longestRun} />;
      }}
      renderBreakdown={(result) => {
        const bankedTotal = result.bankedTotal || 0;
        const longestRun = result.longestRun || 0;
        const totalFlips = result.totalFlips || 0;

        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Banked Total</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{bankedTotal} pts</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Longest Run</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{longestRun} flips</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Total Flips</span>
              <span style={{ color: 'var(--po-text)' }}>{totalFlips}</span>
            </div>
          </div>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Grid Push — a 5x5 grid showing aligned
 * tiles in the player's color. The longest run is highlighted in
 * gold and traced with a connecting line.
 */
function GridPushHero({ bankedTotal, longestRun }: { bankedTotal: number; longestRun: number }) {
  const accent = 'var(--po-orange)';
  const grid = 5;
  const cell = 14;
  const gap = 2;
  // Pattern: highlight the longest-run cells in a horizontal line near the middle
  const runLen = Math.max(0, Math.min(grid, longestRun));
  const runRow = Math.floor(grid / 2);
  const runStart = Math.floor((grid - runLen) / 2);
  // Filled tiles — distribute by bankedTotal
  const filledCount = Math.min(grid * grid, Math.round(bankedTotal / 4));
  const filled = new Set<number>();
  for (let i = 0; i < filledCount; i++) filled.add((i * 7) % (grid * grid));
  // Force the run to be filled
  for (let c = runStart; c < runStart + runLen; c++) filled.add(runRow * grid + c);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.4}>
        <svg width={120} height={120} viewBox="-60 -60 120 120" aria-hidden>
          {Array.from({ length: grid * grid }, (_, i) => {
            const col = i % grid;
            const row = Math.floor(i / grid);
            const totalSize = grid * (cell + gap) - gap;
            const x = -totalSize / 2 + col * (cell + gap);
            const y = -totalSize / 2 + row * (cell + gap);
            const inRun = row === runRow && col >= runStart && col < runStart + runLen;
            const isFilled = filled.has(i);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={cell}
                height={cell}
                rx={2}
                fill={inRun ? 'var(--po-gold)' : isFilled ? accent : 'var(--po-bg-glass)'}
                stroke={inRun ? 'var(--po-gold)' : isFilled ? accent : 'var(--po-border)'}
                strokeWidth={1}
                opacity={inRun ? 1 : isFilled ? 0.85 : 1}
              />
            );
          })}
          {/* Run-trace line */}
          {runLen > 1 && (
            <line
              x1={-((grid - 1) * (cell + gap)) / 2 + runStart * (cell + gap)}
              y1={-((grid - 1) * (cell + gap)) / 2 + runRow * (cell + gap)}
              x2={-((grid - 1) * (cell + gap)) / 2 + (runStart + runLen - 1) * (cell + gap)}
              y2={-((grid - 1) * (cell + gap)) / 2 + runRow * (cell + gap)}
              stroke="var(--po-bg-deep)"
              strokeWidth={2}
              opacity={0.5}
            />
          )}
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={bankedTotal} label="banked" accent={accent} />
        <HeroStat value={longestRun} label="longest" accent="var(--po-gold)" suffix="×" />
      </HeroStatRow>
    </div>
  );
}
