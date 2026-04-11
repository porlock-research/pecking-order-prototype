import React, { Suspense, useState, useEffect } from 'react';
import { GameTypes } from '@pecking-order/shared-types';
import { useGameStore } from '../../store/useGameStore';

const GAME_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  [GameTypes.GAP_RUN]: React.lazy(() => import('../../cartridges/games/gap-run/GapRun')),
  [GameTypes.GRID_PUSH]: React.lazy(() => import('../../cartridges/games/grid-push/GridPush')),
  [GameTypes.SEQUENCE]: React.lazy(() => import('../../cartridges/games/sequence/SequenceGame')),
  [GameTypes.REACTION_TIME]: React.lazy(() => import('../../cartridges/games/reaction-time/ReactionTime')),
  [GameTypes.COLOR_MATCH]: React.lazy(() => import('../../cartridges/games/color-match/ColorMatch')),
  [GameTypes.STACKER]: React.lazy(() => import('../../cartridges/games/stacker/Stacker')),
  [GameTypes.QUICK_MATH]: React.lazy(() => import('../../cartridges/games/quick-math/QuickMath')),
  [GameTypes.SIMON_SAYS]: React.lazy(() => import('../../cartridges/games/simon-says/SimonSays')),
  [GameTypes.AIM_TRAINER]: React.lazy(() => import('../../cartridges/games/aim-trainer/AimTrainer')),
  [GameTypes.REALTIME_TRIVIA]: React.lazy(() => import('../../cartridges/games/realtime-trivia/RealtimeTrivia')),
  [GameTypes.TRIVIA]: React.lazy(() => import('../../cartridges/games/trivia/Trivia')),
  [GameTypes.BET_BET_BET]: React.lazy(() => import('../../cartridges/games/bet-bet-bet/BetBetBet')),
  [GameTypes.BLIND_AUCTION]: React.lazy(() => import('../../cartridges/games/blind-auction/BlindAuction')),
  [GameTypes.KINGS_RANSOM]: React.lazy(() => import('../../cartridges/games/kings-ransom/KingsRansom')),
  [GameTypes.TOUCH_SCREEN]: React.lazy(() => import('../../cartridges/games/touch-screen/TouchScreen')),
  [GameTypes.THE_SPLIT]: React.lazy(() => import('../../cartridges/games/the-split/TheSplit')),
  [GameTypes.SHOCKWAVE]: React.lazy(() => import('../../cartridges/games/shockwave/Shockwave')),
  [GameTypes.ORBIT]: React.lazy(() => import('../../cartridges/games/orbit/Orbit')),
  [GameTypes.BEAT_DROP]: React.lazy(() => import('../../cartridges/games/beat-drop/BeatDrop')),
};

interface GamePanelProps {
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  inline?: boolean;
}

export default function GamePanel({ engine, inline }: GamePanelProps) {
  const activeGameCartridge = useGameStore((s) => s.activeGameCartridge);
  const playerId = useGameStore((s) => s.playerId);
  const roster = useGameStore((s) => s.roster);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismiss when a new game starts
  useEffect(() => { setDismissed(false); }, [activeGameCartridge?.gameType]);

  if (!activeGameCartridge || (!inline && dismissed)) return null;

  const onDismiss = inline ? undefined : () => setDismissed(true);
  const common = { cartridge: activeGameCartridge, playerId: playerId!, roster, engine, onDismiss };
  const Component = GAME_COMPONENTS[activeGameCartridge.gameType];

  if (!Component) {
    return (
      <div className="mx-4 my-2 p-4 rounded-xl bg-glass border border-white/[0.06] text-center">
        <span className="text-sm font-mono text-skin-dim">
          UNKNOWN_GAME_TYPE: {activeGameCartridge.gameType}
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
