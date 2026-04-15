import React, { Suspense } from 'react';
import type { CartridgeKind } from '@pecking-order/shared-types';
import type { GameEngine } from '../../../types';

const VotingPanel  = React.lazy(() => import('../../../../components/panels/VotingPanel'));
const GamePanel    = React.lazy(() => import('../../../../components/panels/GamePanel'));
const PromptPanel  = React.lazy(() => import('../../../../components/panels/PromptPanel'));
const DilemmaPanel = React.lazy(() => import('../../../../components/panels/DilemmaPanel'));

interface Props {
  kind: CartridgeKind;
  engine: GameEngine;
}

/**
 * Routes to the shell-agnostic cartridge panel for the given kind. Panels read
 * their own active state from the store; this component does not pass cartridge
 * data via props. Completed cartridges MUST NOT route through here — use
 * CartridgeResultCard instead (spec §3 "Routing constraint").
 */
export function PlayableCartridgeMount({ kind, engine }: Props) {
  return (
    <div style={{ flex: 1, overflow: 'auto' }} data-testid={`cartridge-panel-${kind}`}>
      <Suspense fallback={null}>
        {kind === 'voting'  && <VotingPanel engine={engine as any} />}
        {kind === 'game'    && <GamePanel engine={engine as any} />}
        {kind === 'prompt'  && <PromptPanel engine={engine as any} />}
        {kind === 'dilemma' && <DilemmaPanel engine={engine as any} />}
      </Suspense>
    </div>
  );
}
