import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { ScoreBreakdown, ScoreRow, ScoreDivider } from '../shared';
import SnakeRenderer from './SnakeRenderer';

interface SnakeProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Snake(props: SnakeProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={SnakeRenderer}
      renderHero={(result) => {
        const score = result.score || 0;
        const finalLength = result.finalLength || 0;
        return <SnakeHero score={score} finalLength={finalLength} />;
      }}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const finalLength = result.finalLength || 0;
        const { scorePerSilver, lengthBonus } = Config.game.snake;
        const baseSilver = Math.floor(score / scorePerSilver);
        const bonusSilver = Math.floor(finalLength / lengthBonus);

        return (
          <ScoreBreakdown>
            <ScoreRow label="Pellets eaten" value={score} />
            <ScoreRow label="Final length" value={finalLength} />
            <ScoreDivider />
            <ScoreRow
              label="Silver"
              value={`${baseSilver} + ${bonusSilver} bonus`}
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
 * Bespoke peak frame for Snake — a coiling line of dots whose count
 * scales with `finalLength`. The longer your snake, the longer the
 * coil. Reads as a frozen victory pose, not a chart.
 */
function SnakeHero({ score, finalLength }: { score: number; finalLength: number }) {
  const accent = 'var(--po-green)';
  // Coil sample: render up to 32 segments, each step further along the spiral.
  const segments = Math.max(8, Math.min(32, Math.round(finalLength / 12)));
  const r0 = 12;
  const rStep = 5;
  const angleStep = 0.55;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <svg
        width={148}
        height={148}
        viewBox="-80 -80 160 160"
        aria-hidden
        style={{ filter: `drop-shadow(0 0 16px color-mix(in oklch, ${accent} 40%, transparent))` }}
      >
        {Array.from({ length: segments }, (_, i) => {
          const t = i / segments;
          const r = r0 + i * rStep * 0.9;
          const a = i * angleStep;
          const x = r * Math.cos(a);
          const y = r * Math.sin(a);
          const size = 6 - t * 3;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={size}
              fill={accent}
              opacity={0.35 + (1 - t) * 0.55}
            />
          );
        })}
        <circle cx={0} cy={0} r={9} fill={accent} />
      </svg>
      <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
        <Stat value={score} label="pellets" accent={accent} />
        <Stat value={finalLength} label="length" accent={accent} suffix="px" />
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  accent,
  suffix,
}: {
  value: number;
  label: string;
  accent: string;
  suffix?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: -0.4,
          color: accent,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
        {suffix && (
          <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 2 }}>{suffix}</span>
        )}
      </span>
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--po-text-dim)',
        }}
      >
        {label}
      </span>
    </div>
  );
}
