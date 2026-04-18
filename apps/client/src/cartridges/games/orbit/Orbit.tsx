import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import OrbitRenderer from './OrbitRenderer';

interface OrbitProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Orbit(props: OrbitProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={OrbitRenderer}
      renderHero={(result) => {
        const transfers = result.transfers || 0;
        const perfectCaptures = result.perfectCaptures || 0;
        return <OrbitHero transfers={transfers} perfectCaptures={perfectCaptures} />;
      }}
      renderBreakdown={(result) => {
        const transfers = result.transfers || 0;
        const perfectCaptures = result.perfectCaptures || 0;
        const { transfersPerSilver, perfectsPerBonusSilver } = Config.game.orbit;
        const baseSilver = Math.floor(transfers / transfersPerSilver);
        const bonusSilver = Math.floor(perfectCaptures / perfectsPerBonusSilver);

        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Transfers</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{transfers}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Perfect captures</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{perfectCaptures}</span>
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
 * Bespoke peak frame for Orbit — nested elliptical orbits with a
 * traveling satellite marker. Number of orbits shown scales with
 * transfers, and perfect captures get gold dots along the paths.
 */
function OrbitHero({ transfers, perfectCaptures }: { transfers: number; perfectCaptures: number }) {
  const accent = 'var(--po-blue)';
  const orbits = Math.max(2, Math.min(5, Math.round(transfers / 3)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.45}>
        <svg width={150} height={150} viewBox="-75 -75 150 150" aria-hidden>
          {/* Central star */}
          <circle cx={0} cy={0} r={6} fill="color-mix(in oklch, var(--po-gold) 95%, white)" />
          <circle cx={0} cy={0} r={12} fill="var(--po-gold)" opacity={0.25} />
          {/* Orbits */}
          {Array.from({ length: orbits }, (_, i) => {
            const rx = 18 + i * 12;
            const ry = 12 + i * 9;
            const rotate = i * 22;
            return (
              <g key={i} transform={`rotate(${rotate})`}>
                <ellipse
                  cx={0} cy={0}
                  rx={rx} ry={ry}
                  fill="none"
                  stroke={`color-mix(in oklch, ${accent} ${40 - i * 4}%, transparent)`}
                  strokeWidth={1}
                />
                {/* Satellite marker on each orbit */}
                <circle cx={rx} cy={0} r={3} fill={accent} />
              </g>
            );
          })}
          {/* Perfect capture trail — small gold dots scattered on outer orbit */}
          {Array.from({ length: Math.min(6, perfectCaptures) }, (_, i) => {
            const rx = 18 + (orbits - 1) * 12;
            const ry = 12 + (orbits - 1) * 9;
            const angle = (i / 6) * Math.PI * 2;
            return (
              <circle
                key={i}
                cx={Math.cos(angle) * rx}
                cy={Math.sin(angle) * ry}
                r={2}
                fill="var(--po-gold)"
              />
            );
          })}
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={transfers} label="transfers" accent={accent} />
        <HeroStat value={perfectCaptures} label="perfect" accent="var(--po-gold)" />
      </HeroStatRow>
    </div>
  );
}
