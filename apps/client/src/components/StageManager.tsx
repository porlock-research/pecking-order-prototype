import React, { lazy, Suspense } from 'react';
import { useGameStore } from '../store/useGameStore';
import { CartridgeId } from '@pecking-order/shared-types';

const Trivia = lazy(() => import('../cartridges/Trivia'));
const Voting = lazy(() => import('../cartridges/Voting'));

const GAME_REGISTRY: Record<string, React.LazyExoticComponent<React.FC<any>>> = {
  TRIVIA: Trivia,
  VOTE_EXECUTIONER: Voting,
  VOTE_TRUST: Voting, // Use Voting as stub for both
};

interface StageManagerProps {
  onAction: (action: any) => void;
}

export const StageManager: React.FC<StageManagerProps> = ({ onAction }) => {
  const manifest = useGameStore((s) => s.manifest);

  // Logic to determine current cartridge - for now looking at a stubbed field
  // In a real scenario, the server would tell us which cartridge is active
  const cartridgeId: CartridgeId | undefined = manifest?.todaysCartridgeId;

  if (!cartridgeId || !GAME_REGISTRY[cartridgeId]) {
    return (
      <div className="flex items-center justify-center h-[200px] bg-skin-panel/50 rounded-card border-2 border-dashed border-white/10">
        <p className="font-mono text-skin-dim shimmer">Waiting for the stage to begin...</p>
      </div>
    );
  }

  const Component = GAME_REGISTRY[cartridgeId];

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[200px] font-mono text-skin-dim shimmer">Loading Stage...</div>}>
      <Component
        stage="PLAY"
        payload={{}}
        onAction={onAction}
      />
    </Suspense>
  );
};
