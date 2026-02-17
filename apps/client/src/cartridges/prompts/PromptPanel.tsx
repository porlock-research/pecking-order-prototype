import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import PlayerPickPrompt from './PlayerPickPrompt';
import PredictionPrompt from './PredictionPrompt';
import WouldYouRatherPrompt from './WouldYouRatherPrompt';
import HotTakePrompt from './HotTakePrompt';
import ConfessionPrompt from './ConfessionPrompt';
import GuessWhoPrompt from './GuessWhoPrompt';

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
    case 'PLAYER_PICK':
      return <PlayerPickPrompt {...common} />;
    case 'PREDICTION':
      return <PredictionPrompt {...common} />;
    case 'WOULD_YOU_RATHER':
      return <WouldYouRatherPrompt {...common} />;
    case 'HOT_TAKE':
      return <HotTakePrompt {...common} />;
    case 'CONFESSION':
      return <ConfessionPrompt {...common} />;
    case 'GUESS_WHO':
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
