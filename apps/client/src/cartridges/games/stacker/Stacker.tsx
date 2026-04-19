import React from 'react';
import type { ArcadeGameProjection, SocialPlayer } from '@pecking-order/shared-types';
import ArcadeGameWrapper from '../wrappers/ArcadeGameWrapper';
import StackerRenderer from './StackerRenderer';

interface StackerProps {
  cartridge: ArcadeGameProjection;
  playerId: string;
  roster: Record<string, SocialPlayer>;
  engine: { sendGameAction: (type: string, payload?: Record<string, any>) => void };
  onDismiss?: () => void;
}

export default function Stacker(props: StackerProps) {
  return (
    <ArcadeGameWrapper
      {...props}
      Renderer={StackerRenderer}
      renderHero={(result) => {
        const height = result.height || 0;
        const perfectLayers = result.perfectLayers || 0;
        return <StackerHero height={height} perfectLayers={perfectLayers} />;
      }}
      renderBreakdown={(result) => {
        const height = result.height || 0;
        const perfectLayers = result.perfectLayers || 0;
        return (
          <div style={{ background: 'var(--po-bg-glass)', border: '1px solid var(--po-border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--po-font-body)', fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--po-text-dim)' }}>
              <span>Height</span>
              <span style={{ color: 'var(--po-text)', fontFamily: 'var(--po-font-display)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{height} layers</span>
            </div>
            {perfectLayers > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 700 }}>Perfect Drops</span>
                <span style={{ color: 'var(--po-gold)', fontFamily: 'var(--po-font-display)', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{perfectLayers}</span>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}

/**
 * Bespoke peak frame for Stacker — a literal tower built from the
 * player's actual layer count. Perfect layers glow gold; standard
 * layers are dim. Reads as a frozen monument.
 */
function StackerHero({ height, perfectLayers }: { height: number; perfectLayers: number }) {
  const accent = 'var(--po-gold)';
  const visibleLayers = Math.max(1, Math.min(20, height));
  const layerHeight = 6;
  const baseWidth = 96;
  const taperPerLayer = 1.6;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        aria-hidden
        style={{
          display: 'flex',
          flexDirection: 'column-reverse',
          alignItems: 'center',
          gap: 2,
          minHeight: 140,
          paddingTop: 10,
        }}
      >
        {Array.from({ length: visibleLayers }, (_, i) => {
          const isPerfect = i < perfectLayers;
          const width = Math.max(28, baseWidth - i * taperPerLayer);
          return (
            <div
              key={i}
              style={{
                width,
                height: layerHeight,
                borderRadius: 2,
                background: isPerfect ? accent : 'var(--po-bg-glass)',
                border: isPerfect
                  ? 'none'
                  : `1px solid color-mix(in oklch, ${accent} 22%, transparent)`,
                boxShadow: isPerfect
                  ? `0 0 8px -2px color-mix(in oklch, ${accent} 60%, transparent)`
                  : 'none',
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
        <Stat value={height} label="layers" accent={accent} />
        <Stat value={perfectLayers} label="perfect" accent={accent} />
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent: string;
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
