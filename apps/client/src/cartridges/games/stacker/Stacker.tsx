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
      title="Stacker"
      description="Blocks slide back and forth. Tap to drop and stack them. Overhang is trimmed — align perfectly to keep your width. How high can you go?"
      Renderer={StackerRenderer}
      renderBreakdown={(result) => {
        const height = result.height || 0;
        const perfectLayers = result.perfectLayers || 0;
        return (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2 font-mono text-sm">
            <div className="flex justify-between text-skin-dim">
              <span>Height</span>
              <span className="text-skin-base font-bold">{height} layers</span>
            </div>
            {perfectLayers > 0 && (
              <div className="flex justify-between">
                <span className="text-skin-gold gold-glow">Perfect Drops</span>
                <span className="text-skin-gold font-bold gold-glow">{perfectLayers}</span>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
