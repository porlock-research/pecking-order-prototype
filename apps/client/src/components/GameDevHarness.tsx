import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { createActor, fromPromise, type AnyActorRef, type Snapshot } from 'xstate';
import type { SocialPlayer, GameProjection } from '@pecking-order/shared-types';

// --- Types ---

type GameType = 'GAP_RUN' | 'GRID_PUSH' | 'SEQUENCE' | 'REACTION_TIME' | 'COLOR_MATCH' | 'STACKER' | 'QUICK_MATH' | 'SIMON_SAYS' | 'AIM_TRAINER' | 'TRIVIA' | 'REALTIME_TRIVIA' | 'BET_BET_BET' | 'BLIND_AUCTION' | 'KINGS_RANSOM' | 'TOUCH_SCREEN' | 'THE_SPLIT';

interface GapRunConfig {
  difficulty: number; // 0-1
}

interface TriviaConfig {
  roundCount: number;
}

interface RealtimeTriviaConfig {
  questionTimer: number; // ms
}

interface LiveGameConfig {
  difficulty: number;
  liveMode: boolean;
}

type GameConfig = GapRunConfig | TriviaConfig | RealtimeTriviaConfig | LiveGameConfig;

interface LogEntry {
  ts: number;
  type: string;
  payload?: Record<string, any>;
  label?: string;
}

// --- Lazy Registry ---

interface GameDef {
  loadMachine: () => Promise<any>;
  Component: React.LazyExoticComponent<React.ComponentType<any>>;
  defaultConfig: GameConfig;
  botPayload?: () => Record<string, any>;
}

const GAME_DEFS: Record<GameType, GameDef> = {
  GAP_RUN: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.gapRunMachine),
    Component: lazy(() => import('../cartridges/games/gap-run/GapRun')),
    defaultConfig: { difficulty: 0.2 },
  },
  GRID_PUSH: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.gridPushMachine),
    Component: lazy(() => import('../cartridges/games/grid-push/GridPush')),
    defaultConfig: { difficulty: 0.2 },
  },
  SEQUENCE: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.sequenceMachine),
    Component: lazy(() => import('../cartridges/games/sequence/SequenceGame')),
    defaultConfig: { difficulty: 0.2 },
  },
  REACTION_TIME: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.reactionTimeMachine),
    Component: lazy(() => import('../cartridges/games/reaction-time/ReactionTime')),
    defaultConfig: { difficulty: 0.2 },
  },
  COLOR_MATCH: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.colorMatchMachine),
    Component: lazy(() => import('../cartridges/games/color-match/ColorMatch')),
    defaultConfig: { difficulty: 0.2 },
  },
  STACKER: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.stackerMachine),
    Component: lazy(() => import('../cartridges/games/stacker/Stacker')),
    defaultConfig: { difficulty: 0.2 },
  },
  QUICK_MATH: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.quickMathMachine),
    Component: lazy(() => import('../cartridges/games/quick-math/QuickMath')),
    defaultConfig: { difficulty: 0.2 },
  },
  SIMON_SAYS: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.simonSaysMachine),
    Component: lazy(() => import('../cartridges/games/simon-says/SimonSays')),
    defaultConfig: { difficulty: 0.2 },
  },
  AIM_TRAINER: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.aimTrainerMachine),
    Component: lazy(() => import('../cartridges/games/aim-trainer/AimTrainer')),
    defaultConfig: { difficulty: 0.2 },
  },
  TRIVIA: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.triviaMachine),
    Component: lazy(() => import('../cartridges/games/trivia/Trivia')),
    defaultConfig: { roundCount: 5 },
  },
  REALTIME_TRIVIA: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.realtimeTriviaMachine),
    Component: lazy(() => import('../cartridges/games/realtime-trivia/RealtimeTrivia')),
    defaultConfig: { questionTimer: 8000 },
  },
  BET_BET_BET: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.betBetBetMachine),
    Component: lazy(() => import('../cartridges/games/bet-bet-bet/BetBetBet')),
    defaultConfig: { difficulty: 0.2 },
    botPayload: () => ({ amount: Math.floor(Math.random() * 30) + 1 }),
  },
  BLIND_AUCTION: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.blindAuctionMachine),
    Component: lazy(() => import('../cartridges/games/blind-auction/BlindAuction')),
    defaultConfig: { difficulty: 0.2 },
    botPayload: () => ({ slot: Math.floor(Math.random() * 3) + 1, amount: Math.floor(Math.random() * 20) }),
  },
  KINGS_RANSOM: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.kingsRansomMachine),
    Component: lazy(() => import('../cartridges/games/kings-ransom/KingsRansom')),
    defaultConfig: { difficulty: 0.2 },
    botPayload: () => ({ action: Math.random() > 0.5 ? 'STEAL' : 'PROTECT' }),
  },
  TOUCH_SCREEN: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.touchScreenMachine),
    Component: lazy(() => import('../cartridges/games/touch-screen/TouchScreen')),
    defaultConfig: { difficulty: 0.2, liveMode: false },
  },
  THE_SPLIT: {
    loadMachine: () => import('@pecking-order/game-cartridges').then(m => m.theSplitMachine),
    Component: lazy(() => import('../cartridges/games/the-split/TheSplit')),
    defaultConfig: { difficulty: 0.2 },
    botPayload: () => ({ action: Math.random() > 0.5 ? 'SPLIT' : 'STEAL' }),
  },
};

const GAME_TYPES = Object.keys(GAME_DEFS) as GameType[];

// --- Mock Data ---

const MOCK_ROSTER: Record<string, SocialPlayer> = {
  'dev-p1': { id: 'dev-p1', personaName: 'Debug Hero', avatarUrl: '', status: 'ALIVE', silver: 50 } as any,
  'dev-p2': { id: 'dev-p2', personaName: 'Test Villain', avatarUrl: '', status: 'ALIVE', silver: 30 } as any,
  'dev-p3': { id: 'dev-p3', personaName: 'NPC Sidekick', avatarUrl: '', status: 'ALIVE', silver: 40 } as any,
};
const MOCK_PLAYER_ID = 'dev-p1';

// --- Main Component ---

export default function GameDevHarness() {
  const [gameType, setGameType] = useState<GameType>('GAP_RUN');
  const [config, setConfig] = useState<GameConfig>(GAME_DEFS.GAP_RUN.defaultConfig);
  const [cartridge, setCartridge] = useState<GameProjection | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<AnyActorRef | null>(null);

  // Scroll event log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventLog]);

  // --- Reset: stop old actor, async-load machine, create new actor ---
  const resetCartridge = useCallback(async (type: GameType, cfg: GameConfig) => {
    // Stop existing actor
    if (actorRef.current) {
      actorRef.current.stop();
      actorRef.current = null;
    }

    setEventLog([]);
    setCartridge(null);
    setLoading(true);

    const [machine, pkg] = await Promise.all([
      GAME_DEFS[type].loadMachine(),
      import('@pecking-order/game-cartridges'),
    ]);
    const { projectGameCartridge, FALLBACK_QUESTIONS } = pkg;

    setLoading(false);

    const input: any = { gameType: type, roster: MOCK_ROSTER, dayIndex: 1 };

    // Pass per-game config into machine input
    const ARCADE_TYPES: string[] = ['GAP_RUN', 'GRID_PUSH', 'SEQUENCE', 'REACTION_TIME', 'COLOR_MATCH', 'STACKER', 'QUICK_MATH', 'SIMON_SAYS', 'AIM_TRAINER'];
    if (ARCADE_TYPES.includes(type) && 'difficulty' in cfg) {
      input.difficulty = cfg.difficulty;
    }
    if ('liveMode' in cfg) {
      input.mode = (cfg as LiveGameConfig).liveMode ? 'LIVE' : 'SOLO';
    }

    // Stub sendParent actions: machines use sendParent for fact pipeline,
    // but standalone actors have no parent. Override with log-capturing stubs.
    const logEvent = (eventType: string, data: any) => {
      setEventLog(prev => [...prev, {
        ts: Date.now(),
        type: eventType,
        payload: data,
        label: 'Machine Event',
      }]);
    };

    // All sendParent-based actions, replaced with event log captures
    const parentStubs: Record<string, (args: any) => void> = {
      emitSync: () => logEvent('FACT.RECORD', { type: 'GAME_ROUND' }),
      emitRoundSync: () => logEvent('FACT.RECORD', { type: 'GAME_ROUND' }),
      reportResults: ({ context }: any) => logEvent('FACT.RECORD', {
        type: 'GAME_RESULT', gameType: context.gameType,
        silverRewards: context.results?.silverRewards,
      }),
      emitPlayerGameResult: ({ event }: any) => logEvent('CARTRIDGE.PLAYER_GAME_RESULT', {
        playerId: event.playerId, silverReward: event.silverReward,
      }),
      emitDecisionFact: ({ event }: any) => logEvent('FACT.RECORD', {
        type: 'GAME_DECISION', actorId: event.senderId,
      }),
      emitAllSubmitted: () => logEvent('FACT.RECORD', { type: 'ALL_SUBMITTED' }),
    };

    // Build provide overrides per game type
    const provideConfig: any = { actions: { ...parentStubs } };

    if (type === 'TRIVIA' || type === 'REALTIME_TRIVIA') {
      provideConfig.actors = {
        fetchQuestions: fromPromise(async () => FALLBACK_QUESTIONS),
      };
    }
    if (type === 'REALTIME_TRIVIA') {
      const qt = 'questionTimer' in cfg ? (cfg as RealtimeTriviaConfig).questionTimer : 8000;
      provideConfig.delays = { QUESTION_TIMER: qt, RESULT_TIMER: 2000 };
    }

    const configuredMachine = (machine as any).provide(provideConfig);

    const actor = createActor(configuredMachine, { input });

    // Subscribe to state changes → project for client
    actor.subscribe((snapshot: Snapshot<any>) => {
      const ctx = (snapshot as any).context;
      if (ctx) {
        const projected = projectGameCartridge(ctx, MOCK_PLAYER_ID);
        if (projected) {
          setCartridge(projected);
        }
      }
    });

    actor.start();
    actorRef.current = actor;
  }, []);

  // Initialize on mount
  useEffect(() => {
    resetCartridge(gameType, config);
    return () => {
      if (actorRef.current) {
        actorRef.current.stop();
        actorRef.current = null;
      }
    };
  }, []);

  // --- Send game action to real actor ---
  const sendGameAction = useCallback((type: string, payload?: Record<string, any>) => {
    setEventLog(prev => [...prev, { ts: Date.now(), type, payload, label: 'sendGameAction' }]);

    if (actorRef.current) {
      actorRef.current.send({ type, ...payload, senderId: MOCK_PLAYER_ID });
    }
  }, []);

  const engine = { sendGameAction };

  // --- Render ---
  const commonProps = {
    cartridge: cartridge as any,
    playerId: MOCK_PLAYER_ID,
    roster: MOCK_ROSTER,
    engine,
    onDismiss: () => {
      setEventLog(prev => [...prev, { ts: Date.now(), type: 'UI', payload: {}, label: 'Dismiss clicked' }]);
    },
  };

  const def = GAME_DEFS[gameType];
  const ActiveComponent = def.Component;

  return (
    <div className="fixed inset-0 flex flex-col bg-skin-fill text-skin-base font-body overflow-hidden bg-grid-pattern">
      {/* Top bar */}
      <header className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-b border-white/[0.06] px-4 py-3 flex items-center gap-4 z-50">
        <h1 className="text-sm font-black font-display tracking-tighter text-skin-gold uppercase">
          Game Dev Harness
        </h1>

        <select
          value={gameType}
          onChange={(e) => {
            const t = e.target.value as GameType;
            const newCfg = GAME_DEFS[t].defaultConfig;
            setGameType(t);
            setConfig(newCfg);
            resetCartridge(t, newCfg);
          }}
          className="bg-skin-panel border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs font-mono text-skin-base focus:border-skin-gold/50 focus:outline-none"
        >
          {GAME_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Mode toggle (live games) */}
        {'liveMode' in config && (
          <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
            {([false, true] as const).map((isLive) => (
              <button
                key={isLive ? 'LIVE' : 'SOLO'}
                onClick={() => {
                  const newCfg = { ...config, liveMode: isLive };
                  setConfig(newCfg);
                  resetCartridge(gameType, newCfg);
                }}
                className={`px-3 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                  (config as LiveGameConfig).liveMode === isLive
                    ? 'bg-skin-gold/20 text-skin-gold'
                    : 'text-skin-dim hover:text-skin-base'
                }`}
              >
                {isLive ? 'LIVE' : 'SOLO'}
              </button>
            ))}
          </div>
        )}

        {/* Per-game config */}
        {!['TRIVIA', 'REALTIME_TRIVIA'].includes(gameType) && 'difficulty' in config && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Difficulty</label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round((config as GapRunConfig).difficulty * 100)}
              onChange={(e) => setConfig({ ...config, difficulty: Number(e.target.value) / 100 })}
              className="w-24 accent-[#ffd700]"
            />
            <span className="text-xs font-mono text-skin-base w-8 text-right">
              {Math.round((config as GapRunConfig).difficulty * 100)}%
            </span>
          </div>
        )}

        {gameType === 'TRIVIA' && 'roundCount' in config && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Rounds</label>
            <input
              type="number"
              min={1}
              max={20}
              value={(config as TriviaConfig).roundCount}
              onChange={(e) => setConfig({ ...config, roundCount: Math.max(1, Number(e.target.value) || 5) })}
              className="w-16 bg-skin-panel border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs font-mono text-skin-base focus:border-skin-gold/50 focus:outline-none"
            />
          </div>
        )}

        {gameType === 'REALTIME_TRIVIA' && 'questionTimer' in config && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Timer</label>
            <input
              type="number"
              min={3}
              max={30}
              value={Math.round((config as RealtimeTriviaConfig).questionTimer / 1000)}
              onChange={(e) => setConfig({ ...config, questionTimer: Math.max(3000, Number(e.target.value) * 1000 || 8000) })}
              className="w-16 bg-skin-panel border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs font-mono text-skin-base focus:border-skin-gold/50 focus:outline-none"
            />
            <span className="text-[10px] font-mono text-skin-dim">sec</span>
          </div>
        )}

        {gameType === 'TOUCH_SCREEN' && (
          <>
            <button
              onClick={() => {
                if (!actorRef.current) return;
                const botIds = ['dev-p2', 'dev-p3'];
                for (const botId of botIds) {
                  actorRef.current.send({ type: 'GAME.TOUCH_SCREEN.READY', senderId: botId });
                  setEventLog(prev => [...prev, { ts: Date.now(), type: 'GAME.TOUCH_SCREEN.READY', payload: { senderId: botId }, label: 'Bot Ready' }]);
                }
              }}
              className="px-4 py-1.5 bg-skin-green/10 border border-skin-green/30 rounded-lg text-xs font-mono font-bold text-skin-green uppercase tracking-wider hover:bg-skin-green/20 transition-colors"
            >
              Ready Bots
            </button>
            <button
              onClick={() => {
                if (!actorRef.current) return;
                const botIds = ['dev-p2', 'dev-p3'];
                for (const botId of botIds) {
                  actorRef.current.send({ type: 'GAME.TOUCH_SCREEN.TOUCH', senderId: botId });
                  setEventLog(prev => [...prev, { ts: Date.now(), type: 'GAME.TOUCH_SCREEN.TOUCH', payload: { senderId: botId }, label: 'Bot Touch' }]);
                }
              }}
              className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs font-mono font-bold text-blue-400 uppercase tracking-wider hover:bg-blue-500/20 transition-colors"
            >
              Touch Bots
            </button>
            <button
              onClick={() => {
                if (!actorRef.current) return;
                const botIds = ['dev-p2', 'dev-p3'];
                const botId = botIds[Math.floor(Math.random() * botIds.length)];
                actorRef.current.send({ type: 'GAME.TOUCH_SCREEN.RELEASE', senderId: botId });
                setEventLog(prev => [...prev, { ts: Date.now(), type: 'GAME.TOUCH_SCREEN.RELEASE', payload: { senderId: botId }, label: 'Bot Release' }]);
              }}
              className="px-4 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-mono font-bold text-red-400 uppercase tracking-wider hover:bg-red-500/20 transition-colors"
            >
              Release Bot
            </button>
            <button
              onClick={() => {
                if (actorRef.current) {
                  actorRef.current.send({ type: 'INTERNAL.END_GAME' });
                  setEventLog(prev => [...prev, { ts: Date.now(), type: 'INTERNAL.END_GAME', label: 'Manual Trigger' }]);
                }
              }}
              className="px-4 py-1.5 bg-skin-gold/10 border border-skin-gold/30 rounded-lg text-xs font-mono font-bold text-skin-gold uppercase tracking-wider hover:bg-skin-gold/20 transition-colors"
            >
              End Game
            </button>
          </>
        )}

        {gameType !== 'TOUCH_SCREEN' && def.botPayload && (
          <>
            <button
              onClick={() => {
                if (!actorRef.current) return;
                const botIds = ['dev-p2', 'dev-p3'];
                for (const botId of botIds) {
                  const payload = def.botPayload!();
                  actorRef.current.send({ type: `GAME.${gameType}.SUBMIT`, senderId: botId, ...payload });
                  setEventLog(prev => [...prev, { ts: Date.now(), type: `GAME.${gameType}.SUBMIT`, payload: { senderId: botId, ...payload }, label: 'Bot Submit' }]);
                }
              }}
              className="px-4 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg text-xs font-mono font-bold text-purple-400 uppercase tracking-wider hover:bg-purple-500/20 transition-colors"
            >
              Submit Bots
            </button>
            <button
              onClick={() => {
                if (actorRef.current) {
                  actorRef.current.send({ type: 'INTERNAL.END_GAME' });
                  setEventLog(prev => [...prev, { ts: Date.now(), type: 'INTERNAL.END_GAME', label: 'Manual Trigger' }]);
                }
              }}
              className="px-4 py-1.5 bg-skin-gold/10 border border-skin-gold/30 rounded-lg text-xs font-mono font-bold text-skin-gold uppercase tracking-wider hover:bg-skin-gold/20 transition-colors"
            >
              End Game (Reveal)
            </button>
          </>
        )}

        <button
          onClick={() => resetCartridge(gameType, config)}
          className="px-4 py-1.5 bg-white/[0.06] border border-white/[0.1] rounded-lg text-xs font-mono font-bold text-skin-dim uppercase tracking-wider hover:bg-white/[0.1] hover:text-skin-base transition-colors"
        >
          Reset
        </button>
      </header>

      {/* Middle: Game cartridge */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-md mx-auto">
          {(loading || !cartridge) && (
            <div className="p-6 text-center">
              <span className="inline-block w-5 h-5 border-2 border-skin-gold border-t-transparent rounded-full spin-slow" />
              <p className="text-sm font-mono text-skin-dim animate-pulse mt-2">Loading machine...</p>
            </div>
          )}
          <Suspense fallback={
            <div className="p-6 text-center">
              <span className="inline-block w-5 h-5 border-2 border-skin-gold border-t-transparent rounded-full spin-slow" />
              <p className="text-sm font-mono text-skin-dim animate-pulse mt-2">Loading component...</p>
            </div>
          }>
            {cartridge && !loading && <ActiveComponent {...commonProps} />}
          </Suspense>
        </div>
      </div>

      {/* Bottom: Event log */}
      <div className="shrink-0 h-48 border-t border-white/[0.06] bg-skin-panel/60 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
          <span className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Event Log</span>
          <span className="text-[10px] font-mono text-skin-dim">{eventLog.length} events</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 font-mono text-[11px]">
          {eventLog.length === 0 && (
            <p className="text-skin-dim/40 italic">No events yet. Start a game to see actions here.</p>
          )}
          {eventLog.map((entry, i) => {
            const time = new Date(entry.ts).toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 } as any);
            const isMachineEvent = entry.label === 'Machine Event';
            const isUi = entry.type === 'UI';
            return (
              <div key={i} className="flex gap-2">
                <span className="text-skin-dim/40 shrink-0">{time}</span>
                {entry.label && (
                  <span className={`shrink-0 px-1.5 rounded text-[9px] uppercase tracking-wider font-bold
                    ${isMachineEvent ? 'bg-purple-500/20 text-purple-400' : isUi ? 'bg-blue-500/20 text-blue-400' : 'bg-skin-gold/20 text-skin-gold'}`}>
                    {entry.label}
                  </span>
                )}
                <span className={`font-bold ${isMachineEvent ? 'text-purple-400' : 'text-skin-base'}`}>
                  {entry.type}
                </span>
                {entry.payload && Object.keys(entry.payload).length > 0 && (
                  <span className="text-skin-dim/60 truncate">
                    {JSON.stringify(entry.payload)}
                  </span>
                )}
              </div>
            );
          })}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
