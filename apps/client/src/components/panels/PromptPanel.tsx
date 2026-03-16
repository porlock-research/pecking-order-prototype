import React, { Suspense } from 'react';
import { PromptTypes } from '@pecking-order/shared-types';
import { useGameStore } from '../../store/useGameStore';

const PROMPT_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  [PromptTypes.PLAYER_PICK]: React.lazy(() => import('../../cartridges/prompts/PlayerPickPrompt')),
  [PromptTypes.PREDICTION]: React.lazy(() => import('../../cartridges/prompts/PredictionPrompt')),
  [PromptTypes.WOULD_YOU_RATHER]: React.lazy(() => import('../../cartridges/prompts/WouldYouRatherPrompt')),
  [PromptTypes.HOT_TAKE]: React.lazy(() => import('../../cartridges/prompts/HotTakePrompt')),
  [PromptTypes.CONFESSION]: React.lazy(() => import('../../cartridges/prompts/ConfessionPrompt')),
  [PromptTypes.GUESS_WHO]: React.lazy(() => import('../../cartridges/prompts/GuessWhoPrompt')),
};

interface PromptPanelProps {
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function PromptPanel({ engine }: PromptPanelProps) {
  const activePromptCartridge = useGameStore((s) => s.activePromptCartridge);
  const playerId = useGameStore((s) => s.playerId);
  const roster = useGameStore((s) => s.roster);

  if (!activePromptCartridge) return null;

  const common = { cartridge: activePromptCartridge, playerId: playerId!, roster, engine };
  const Component = PROMPT_COMPONENTS[activePromptCartridge.promptType];

  if (!Component) {
    return (
      <div className="mx-4 my-2 p-4 rounded-xl bg-glass border border-white/[0.06] text-center">
        <span className="text-sm font-mono text-skin-dim">
          UNKNOWN_PROMPT_TYPE: {activePromptCartridge.promptType}
        </span>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <Component {...common} />
    </Suspense>
  );
}
