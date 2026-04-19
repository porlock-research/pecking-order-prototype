import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import { Config } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import { HeroStat, HeroStatRow, HeroFrame } from '../shared';
import ShockwaveRenderer from './ShockwaveRenderer';

interface ShockwaveProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  onDismiss?: () => void;
}

export default function Shockwave(props: ShockwaveProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={ShockwaveRenderer}
      renderHero={(result) => {
        const wavesCleared = result.wavesCleared || 0;
        const maxCombo = result.maxCombo || 0;
        return <ShockwaveHero wavesCleared={wavesCleared} maxCombo={maxCombo} />;
      }}
      renderBreakdown={(result) => {
        const wavesCleared = result.wavesCleared || 0;
        const nearMisses = result.nearMisses || 0;
        const maxCombo = result.maxCombo || 0;
        const { scorePerSilver, nearMissBonus } = Config.game.shockwave;
        const waveSilver = Math.floor(wavesCleared / scorePerSilver);
        const bonusSilver = Math.floor(nearMisses / nearMissBonus);

        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Waves cleared</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{wavesCleared}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Near misses</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{nearMisses}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Max combo</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{maxCombo}x</span>
            </div>
            <div style={{ borderTop: '1px solid var(--po-border)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--po-text-dim)' }}>Silver</span>
              <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{waveSilver} + {bonusSilver} bonus</span>
            </div>
          </div>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Shockwave — concentric shock rings expanding
 * outward with a survivor-dot in the center. Wave count drives how
 * many rings; each inner ring is denser.
 */
function ShockwaveHero({ wavesCleared, maxCombo }: { wavesCleared: number; maxCombo: number }) {
  const accent = 'var(--po-violet)';
  const rings = Math.max(3, Math.min(8, wavesCleared));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <HeroFrame accent={accent} haloIntensity={0.5}>
        <svg width={150} height={150} viewBox="-75 -75 150 150" aria-hidden>
          {/* Outer shock rings */}
          {Array.from({ length: rings }, (_, i) => {
            const r = 14 + i * 8;
            const opacity = 0.15 + (rings - i) * 0.07;
            return (
              <circle
                key={i}
                cx={0} cy={0} r={r}
                fill="none"
                stroke={accent}
                strokeWidth={1.5}
                opacity={opacity}
              />
            );
          })}
          {/* Inner core rings — dense */}
          <circle cx={0} cy={0} r={8} fill={`color-mix(in oklch, ${accent} 30%, transparent)`} />
          <circle cx={0} cy={0} r={8} fill="none" stroke={accent} strokeWidth={1} />
          {/* Survivor dot */}
          <circle cx={0} cy={0} r={3.5} fill="color-mix(in oklch, var(--po-violet) 50%, white)" />
          {/* Lightning hints */}
          <path d="M -64 0 L -50 -4 L -40 2" fill="none" stroke={accent} strokeWidth={1.25} opacity={0.7} />
          <path d="M 64 0 L 50 4 L 40 -2" fill="none" stroke={accent} strokeWidth={1.25} opacity={0.7} />
          <path d="M 0 -64 L -4 -50 L 2 -40" fill="none" stroke={accent} strokeWidth={1.25} opacity={0.7} />
          <path d="M 0 64 L 4 50 L -2 40" fill="none" stroke={accent} strokeWidth={1.25} opacity={0.7} />
        </svg>
      </HeroFrame>
      <HeroStatRow>
        <HeroStat value={wavesCleared} label="waves" accent={accent} />
        <HeroStat value={maxCombo} label="max combo" accent={accent} suffix="×" />
      </HeroStatRow>
    </div>
  );
}
