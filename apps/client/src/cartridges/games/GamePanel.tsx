import React, { useState, useEffect } from 'react';
import { GameTypes } from '@pecking-order/shared-types';
import { useGameStore } from '../../store/useGameStore';
import GapRun from './gap-run/GapRun';
import GridPush from './grid-push/GridPush';
import SequenceGame from './sequence/SequenceGame';
import ReactionTime from './reaction-time/ReactionTime';
import ColorMatch from './color-match/ColorMatch';
import Stacker from './stacker/Stacker';
import QuickMath from './quick-math/QuickMath';
import SimonSays from './simon-says/SimonSays';
import AimTrainer from './aim-trainer/AimTrainer';
import RealtimeTrivia from './realtime-trivia/RealtimeTrivia';
import Trivia from './trivia/Trivia';
import BetBetBet from './bet-bet-bet/BetBetBet';
import BlindAuction from './blind-auction/BlindAuction';
import KingsRansom from './kings-ransom/KingsRansom';
import TouchScreen from './touch-screen/TouchScreen';

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
    case GameTypes.GAP_RUN:
      return <GapRun {...common} />;
    case GameTypes.GRID_PUSH:
      return <GridPush {...common} />;
    case GameTypes.SEQUENCE:
      return <SequenceGame {...common} />;
    case GameTypes.REACTION_TIME:
      return <ReactionTime {...common} />;
    case GameTypes.COLOR_MATCH:
      return <ColorMatch {...common} />;
    case GameTypes.STACKER:
      return <Stacker {...common} />;
    case GameTypes.QUICK_MATH:
      return <QuickMath {...common} />;
    case GameTypes.SIMON_SAYS:
      return <SimonSays {...common} />;
    case GameTypes.AIM_TRAINER:
      return <AimTrainer {...common} />;
    case GameTypes.REALTIME_TRIVIA:
      return <RealtimeTrivia {...common} />;
    case GameTypes.TRIVIA:
      return <Trivia {...common} />;
    case GameTypes.BET_BET_BET:
      return <BetBetBet {...common} />;
    case GameTypes.BLIND_AUCTION:
      return <BlindAuction {...common} />;
    case GameTypes.KINGS_RANSOM:
      return <KingsRansom {...common} />;
    case GameTypes.TOUCH_SCREEN:
      return <TouchScreen {...common} />;
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
