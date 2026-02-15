import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import GapRun from './GapRun';
import GridPush from './GridPush';
import SequenceGame from './SequenceGame';
import ReactionTime from './ReactionTime';
import ColorMatch from './ColorMatch';
import Stacker from './Stacker';
import QuickMath from './QuickMath';
import SimonSays from './SimonSays';
import AimTrainer from './AimTrainer';
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
  const [dismissed, setDismissed] = useState(false);

  // Reset dismiss when a new game starts
  useEffect(() => { setDismissed(false); }, [activeGameCartridge?.gameType]);

  if (!activeGameCartridge || dismissed) return null;

  const onDismiss = () => setDismissed(true);
  const common = { cartridge: activeGameCartridge, playerId: playerId!, roster, engine, onDismiss };

  switch (activeGameCartridge.gameType) {
    case 'GAP_RUN':
      return <GapRun {...common} />;
    case 'GRID_PUSH':
      return <GridPush {...common} />;
    case 'SEQUENCE':
      return <SequenceGame {...common} />;
    case 'REACTION_TIME':
      return <ReactionTime {...common} />;
    case 'COLOR_MATCH':
      return <ColorMatch {...common} />;
    case 'STACKER':
      return <Stacker {...common} />;
    case 'QUICK_MATH':
      return <QuickMath {...common} />;
    case 'SIMON_SAYS':
      return <SimonSays {...common} />;
    case 'AIM_TRAINER':
      return <AimTrainer {...common} />;
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
