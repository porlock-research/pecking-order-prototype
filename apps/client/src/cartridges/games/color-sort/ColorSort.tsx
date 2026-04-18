import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame, ScoreBreakdown, ScoreRow, ScoreDivider } from '../shared';
import ColorSortRenderer from './ColorSortRenderer';

interface ColorSortProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function ColorSort(props: ColorSortProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={ColorSortRenderer}
      renderHero={(result) => {
        const sortedTubes = result.sortedTubes || 0;
        const solved = (result.solved || 0) > 0;
        return <ColorSortHero sortedTubes={sortedTubes} solved={solved} />;
      }}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const sortedTubes = result.sortedTubes || 0;
        const solved = result.solved || 0;
        const { scorePerSilver, solvedBonus } = Config.game.colorSort;
        const baseSilver = Math.floor(score / scorePerSilver);
        const bonus = solved ? solvedBonus : 0;

        return (
          <ScoreBreakdown>
            <ScoreRow label="Tubes sorted" value={`${sortedTubes} / 5`} />
            <ScoreRow label="Fully solved" value={solved ? 'Yes' : 'No'} />
            <ScoreDivider />
            <ScoreRow
              label="Silver"
              value={`${baseSilver}${bonus ? ` + ${bonus} bonus` : ''}`}
              tone="var(--po-gold)"
              emphasize
            />
          </ScoreBreakdown>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Color Sort — 5 test-tubes filled with
 * layered color bands. Sorted tubes show a single solid column;
 * unsorted ones keep mixed bands. Solved = gold stars at the top.
 */
function ColorSortHero({ sortedTubes, solved }: { sortedTubes: number; solved: boolean }) {
  const accent = 'var(--po-violet)';
  const tubeColors = ['var(--po-orange)', 'var(--po-pink)', 'var(--po-blue)', 'var(--po-green)', 'var(--po-violet)'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.4}>
        <svg width={180} height={110} viewBox="-90 -55 180 110" aria-hidden>
          {tubeColors.map((color, i) => {
            const isSorted = i < sortedTubes;
            const cx = -66 + i * 33;
            return (
              <g key={i}>
                {/* Tube outline */}
                <rect
                  x={cx - 10}
                  y={-40}
                  width={20}
                  height={76}
                  rx={8}
                  fill="var(--po-bg-deep)"
                  stroke="var(--po-border)"
                  strokeWidth={1.25}
                />
                {/* Fill */}
                {isSorted ? (
                  <rect
                    x={cx - 8}
                    y={-28}
                    width={16}
                    height={62}
                    rx={6}
                    fill={color}
                  />
                ) : (
                  // Mixed stack — 4 bands
                  tubeColors.slice(0, 4).map((c, j) => (
                    <rect
                      key={j}
                      x={cx - 8}
                      y={-28 + j * 15}
                      width={16}
                      height={15}
                      rx={j === 0 ? 6 : 0}
                      fill={c}
                      opacity={0.85}
                    />
                  ))
                )}
                {/* Sorted gold star */}
                {isSorted && solved && (
                  <text
                    x={cx}
                    y={-46}
                    textAnchor="middle"
                    style={{
                      fontSize: 13,
                      fill: 'var(--po-gold)',
                    }}
                  >
                    ★
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={`${sortedTubes}/5`} label="sorted" accent={accent} />
        <HeroStat value={solved ? 'Yes' : 'No'} label="solved" accent={solved ? 'var(--po-gold)' : 'var(--po-text-dim)'} size={22} />
      </HeroStatRow>
    </div>
  );
}
