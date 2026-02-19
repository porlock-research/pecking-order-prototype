import React, { useState, useEffect } from 'react';
import { GameTypes } from '@pecking-order/shared-types';
import { useGameStore } from '../../store/useGameStore';
import GapRun from '../../cartridges/games/gap-run/GapRun';
import GridPush from '../../cartridges/games/grid-push/GridPush';
import SequenceGame from '../../cartridges/games/sequence/SequenceGame';
import ReactionTime from '../../cartridges/games/reaction-time/ReactionTime';
import ColorMatch from '../../cartridges/games/color-match/ColorMatch';
import Stacker from '../../cartridges/games/stacker/Stacker';
import QuickMath from '../../cartridges/games/quick-math/QuickMath';
import SimonSays from '../../cartridges/games/simon-says/SimonSays';
import AimTrainer from '../../cartridges/games/aim-trainer/AimTrainer';
import RealtimeTrivia from '../../cartridges/games/realtime-trivia/RealtimeTrivia';
import Trivia from '../../cartridges/games/trivia/Trivia';
import BetBetBet from '../../cartridges/games/bet-bet-bet/BetBetBet';
import BlindAuction from '../../cartridges/games/blind-auction/BlindAuction';
import KingsRansom from '../../cartridges/games/kings-ransom/KingsRansom';
import TouchScreen from '../../cartridges/games/touch-screen/TouchScreen';
import TheSplit from '../../cartridges/games/the-split/TheSplit';

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
    case GameTypes.THE_SPLIT:
      return <TheSplit {...common} />;
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
