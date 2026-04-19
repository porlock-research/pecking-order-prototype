import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import RecallRenderer from './RecallRenderer';

interface RecallProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Recall(props: RecallProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={RecallRenderer}
      renderHero={(result) => {
        const roundsCleared = result.roundsCleared || 0;
        const highestSize = result.highestSize || 0;
        const fullClear = (result.fullClear || 0) > 0;
        return <RecallHero roundsCleared={roundsCleared} highestSize={highestSize} fullClear={fullClear} />;
      }}
      renderBreakdown={(result) => {
        const roundsCleared = result.roundsCleared || 0;
        const highestSize = result.highestSize || 0;
        const fullClear = result.fullClear || 0;
        const { silverBySize, fullClearGold } = Config.game.recall;
        let silver = 0;
        for (let n = 0; n <= highestSize; n++) silver += silverBySize[n] ?? 0;
        const gold = fullClear ? fullClearGold : 0;

        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Rounds cleared</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{roundsCleared}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Highest grid</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{highestSize > 0 ? `${highestSize}×${highestSize}` : '—'}</span>
            </div>
            {fullClear > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--po-text-dim)' }}>Full clear</span>
                <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>PERFECT</span>
              </div>
            )}
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
 * Bespoke peak frame for Recall — the largest grid the player
 * cleared, rendered as a grid of memory tiles with a few lit
 * (recalled) in blue. The grid size itself IS the hero — bigger
 * grid = better memory.
 */
function RecallHero({
  roundsCleared,
  highestSize,
  fullClear,
}: {
  roundsCleared: number;
  highestSize: number;
  fullClear: boolean;
}) {
  const accent = 'var(--po-blue)';
  const size = Math.max(2, Math.min(8, highestSize || 3));
  const cellSize = Math.min(16, 96 / size);
  const gap = 2;
  const total = size * size;
  // "Lit" cells — about half, deterministic pattern
  const lit = new Set(Array.from({ length: Math.ceil(total / 2) }, (_, i) => (i * 7) % total));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.4}>
        <svg width={130} height={130} viewBox="-65 -65 130 130" aria-hidden>
          {/* Grid cells */}
          {Array.from({ length: total }, (_, i) => {
            const col = i % size;
            const row = Math.floor(i / size);
            const totalWidth = size * (cellSize + gap) - gap;
            const x = -totalWidth / 2 + col * (cellSize + gap);
            const y = -totalWidth / 2 + row * (cellSize + gap);
            const isLit = lit.has(i);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={isLit ? accent : 'var(--po-bg-glass)'}
                stroke={isLit ? accent : 'var(--po-border)'}
                strokeWidth={1}
              />
            );
          })}
          {/* Perfect badge — corner star if full clear */}
          {fullClear && (
            <g transform="translate(52, -52)">
              <circle cx={0} cy={0} r={10} fill="var(--po-gold)" />
              <text
                x={0} y={3}
                textAnchor="middle"
                style={{
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 10,
                  fontWeight: 800,
                  fill: 'var(--po-bg-deep)',
                }}
              >
                ★
              </text>
            </g>
          )}
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={highestSize > 0 ? `${highestSize}×${highestSize}` : '—'} label="grid" accent={accent} />
        <HeroStat value={roundsCleared} label="rounds" accent={accent} />
      </HeroStatRow>
    </div>
  );
}
