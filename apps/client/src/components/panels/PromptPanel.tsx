import React from 'react';
import { PromptTypes } from '@pecking-order/shared-types';
import { useGameStore } from '../../store/useGameStore';
import PlayerPickPrompt from '../../cartridges/prompts/PlayerPickPrompt';
import PredictionPrompt from '../../cartridges/prompts/PredictionPrompt';
import WouldYouRatherPrompt from '../../cartridges/prompts/WouldYouRatherPrompt';
import HotTakePrompt from '../../cartridges/prompts/HotTakePrompt';
import ConfessionPrompt from '../../cartridges/prompts/ConfessionPrompt';
import GuessWhoPrompt from '../../cartridges/prompts/GuessWhoPrompt';

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

  switch (activePromptCartridge.promptType) {
    case PromptTypes.PLAYER_PICK:
      return <PlayerPickPrompt {...common} />;
    case PromptTypes.PREDICTION:
      return <PredictionPrompt {...common} />;
    case PromptTypes.WOULD_YOU_RATHER:
      return <WouldYouRatherPrompt {...common} />;
    case PromptTypes.HOT_TAKE:
      return <HotTakePrompt {...common} />;
    case PromptTypes.CONFESSION:
      return <ConfessionPrompt {...common} />;
    case PromptTypes.GUESS_WHO:
      return <GuessWhoPrompt {...common} />;
    default:
      return (
        <div className="mx-4 my-2 p-4 rounded-xl bg-glass border border-white/[0.06] text-center">
          <span className="text-sm font-mono text-skin-dim">
            UNKNOWN_PROMPT_TYPE: {activePromptCartridge.promptType}
          </span>
        </div>
      );
  }
}
