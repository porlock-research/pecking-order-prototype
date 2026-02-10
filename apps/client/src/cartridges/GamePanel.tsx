import React from 'react';
import { useGameStore } from '../store/useGameStore';
import RealtimeTrivia from './RealtimeTrivia';
import Trivia from './Trivia';

interface GamePanelProps {
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function GamePanel({ engine }: GamePanelProps) {
  const activeGameCartridge = useGameStore((s) => s.activeGameCartridge);
  const playerId = useGameStore((s) => s.playerId);
  const roster = useGameStore((s) => s.roster);

  if (!activeGameCartridge) return null;

  const common = { cartridge: activeGameCartridge, playerId: playerId!, roster, engine };

  switch (activeGameCartridge.gameType) {
    case 'REALTIME_TRIVIA':
      return <RealtimeTrivia {...common} />;
    case 'TRIVIA':
      return <Trivia {...common} />;
    default:
      return (
        <div className="mx-4 my-2 p-4 rounded-xl bg-glass border border-white/[0.06] text-center">
          <span className="text-sm font-mono text-skin-dim">
            UNKNOWN_GAME_TYPE: {activeGameCartridge.gameType}
          </span>
        </div>
      );
  }
}
