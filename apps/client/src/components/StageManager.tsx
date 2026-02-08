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
      <div className="stage-placeholder">
        <p>Waiting for the stage to begin...</p>
        <style>{`
          .stage-placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            background: #222;
            border-radius: 8px;
            border: 2px dashed #444;
          }
        `}</style>
      </div>
    );
  }

  const Component = GAME_REGISTRY[cartridgeId];

  return (
    <Suspense fallback={<div>Loading Stage...</div>}>
      <Component 
        stage="PLAY" 
        payload={{}} 
        onAction={onAction} 
      />
    </Suspense>
  );
};
