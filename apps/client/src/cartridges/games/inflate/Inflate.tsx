import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import InflateRenderer from './InflateRenderer';

interface InflateProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Inflate(props: InflateProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={InflateRenderer}
      renderHero={(result) => {
        const banked = result.balloonsBanked || 0;
        const popped = result.balloonsPopped || 0;
        const score = result.score || 0;
        return <InflateHero banked={banked} popped={popped} score={score} />;
      }}
      renderBreakdown={(result) => {
        const score = result.score || 0;
        const balloonsBanked = result.balloonsBanked || 0;
        const balloonsPopped = result.balloonsPopped || 0;
        const perfectBanks = result.perfectBanks || 0;
        const { scorePerSilver, perfectBankBonus } = Config.game.inflate;
        const baseSilver = Math.floor(score / scorePerSilver);
        const bonusSilver = Math.floor(perfectBanks / perfectBankBonus);

        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Score</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Balloons banked</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{balloonsBanked}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Balloons popped</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{balloonsPopped}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Perfect banks</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{perfectBanks}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--po-border)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Silver</span>
              <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{baseSilver} + {bonusSilver} bonus</span>
            </div>
          </div>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Inflate — one big balloon sized to the
 * player's score, with a small row of "popped" balloon ghosts
 * trailing behind. Knot at the bottom, highlight at the top.
 */
function InflateHero({ banked, popped, score }: { banked: number; popped: number; score: number }) {
  const accent = 'var(--po-orange)';
  // Balloon size scales with score (32 → 56 radius)
  const r = Math.min(56, 32 + score * 0.5);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.45}>
        <svg width={160} height={140} viewBox="-80 -70 160 140" aria-hidden>
          {/* Popped balloon ghosts (trailing) */}
          {Array.from({ length: Math.min(popped, 5) }, (_, i) => (
            <g key={i} transform={`translate(${-60 + i * 12}, 40)`} opacity={0.35}>
              <path d="M -5 0 L 5 0 L 3 5 L -3 5 Z" fill={`color-mix(in oklch, ${accent} 40%, transparent)`} />
              <path d="M -4 2 L 4 2 L 2 -2 L -2 -2 Z" fill="none" stroke={`color-mix(in oklch, ${accent} 40%, transparent)`} strokeWidth={0.8} strokeDasharray="1 1" />
            </g>
          ))}
          {/* Main balloon */}
          <g transform="translate(8, -4)">
            {/* String */}
            <path d={`M 0 ${r - 2} Q -2 ${r + 16} 2 ${r + 34}`} stroke={`color-mix(in oklch, ${accent} 60%, transparent)`} strokeWidth={1} fill="none" />
            {/* Body */}
            <ellipse cx={0} cy={0} rx={r * 0.86} ry={r} fill={accent} />
            {/* Knot */}
            <path d={`M -3 ${r - 1} L 3 ${r - 1} L 2 ${r + 4} L -2 ${r + 4} Z`} fill={`color-mix(in oklch, ${accent} 70%, black)`} />
            {/* Highlight */}
            <ellipse cx={-r * 0.32} cy={-r * 0.38} rx={r * 0.22} ry={r * 0.36}
                     fill="color-mix(in oklch, var(--po-orange) 35%, white)" opacity={0.55} />
          </g>
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={banked} label="banked" accent={accent} />
        <HeroStat value={popped} label="popped" accent="var(--po-pink)" />
      </HeroStatRow>
    </div>
  );
}
