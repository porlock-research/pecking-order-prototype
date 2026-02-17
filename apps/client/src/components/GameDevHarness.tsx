import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createActor, fromPromise, type AnyActorRef, type Snapshot } from 'xstate';
import type { SocialPlayer, GameProjection } from '@pecking-order/shared-types';
import {
  gapRunMachine,
  gridPushMachine,
  sequenceMachine,
  reactionTimeMachine,
  colorMatchMachine,
  stackerMachine,
  quickMathMachine,
  simonSaysMachine,
  aimTrainerMachine,
  triviaMachine,
  realtimeTriviaMachine,
  betBetBetMachine,
  blindAuctionMachine,
  kingsRansomMachine,
  touchScreenMachine,
  FALLBACK_QUESTIONS,
  projectGameCartridge,
} from '@pecking-order/game-cartridges';
import GapRun from '../cartridges/games/gap-run/GapRun';
import GridPush from '../cartridges/games/grid-push/GridPush';
import SequenceGame from '../cartridges/games/sequence/SequenceGame';
import ReactionTime from '../cartridges/games/reaction-time/ReactionTime';
import ColorMatch from '../cartridges/games/color-match/ColorMatch';
import Stacker from '../cartridges/games/stacker/Stacker';
import QuickMath from '../cartridges/games/quick-math/QuickMath';
import SimonSays from '../cartridges/games/simon-says/SimonSays';
import AimTrainer from '../cartridges/games/aim-trainer/AimTrainer';
import RealtimeTrivia from '../cartridges/games/realtime-trivia/RealtimeTrivia';
import Trivia from '../cartridges/games/trivia/Trivia';
import BetBetBet from '../cartridges/games/bet-bet-bet/BetBetBet';
import BlindAuction from '../cartridges/games/blind-auction/BlindAuction';
import KingsRansom from '../cartridges/games/kings-ransom/KingsRansom';
import TouchScreen from '../cartridges/games/touch-screen/TouchScreen';

// --- Types ---

type GameType = 'GAP_RUN' | 'GRID_PUSH' | 'SEQUENCE' | 'REACTION_TIME' | 'COLOR_MATCH' | 'STACKER' | 'QUICK_MATH' | 'SIMON_SAYS' | 'AIM_TRAINER' | 'TRIVIA' | 'REALTIME_TRIVIA' | 'BET_BET_BET' | 'BLIND_AUCTION' | 'KINGS_RANSOM' | 'TOUCH_SCREEN';

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

function defaultConfig(type: GameType): GameConfig {
  switch (type) {
    case 'GAP_RUN': return { difficulty: 0.2 };
    case 'GRID_PUSH': return { difficulty: 0.2 };
    case 'SEQUENCE': return { difficulty: 0.2 };
    case 'REACTION_TIME': return { difficulty: 0.2 };
    case 'COLOR_MATCH': return { difficulty: 0.2 };
    case 'STACKER': return { difficulty: 0.2 };
    case 'QUICK_MATH': return { difficulty: 0.2 };
    case 'SIMON_SAYS': return { difficulty: 0.2 };
    case 'AIM_TRAINER': return { difficulty: 0.2 };
    case 'TRIVIA': return { roundCount: 5 };
    case 'REALTIME_TRIVIA': return { questionTimer: 8000 };
    case 'BET_BET_BET': return { difficulty: 0.2 };
    case 'BLIND_AUCTION': return { difficulty: 0.2 };
    case 'KINGS_RANSOM': return { difficulty: 0.2 };
    case 'TOUCH_SCREEN': return { difficulty: 0.2, liveMode: false };
  }
}

interface LogEntry {
  ts: number;
  type: string;
  payload?: Record<string, any>;
  label?: string;
}

// --- Mock Data ---

const MOCK_ROSTER: Record<string, SocialPlayer> = {
  'dev-p1': { id: 'dev-p1', personaName: 'Debug Hero', avatarUrl: '', status: 'ALIVE', silver: 50 } as any,
  'dev-p2': { id: 'dev-p2', personaName: 'Test Villain', avatarUrl: '', status: 'ALIVE', silver: 30 } as any,
  'dev-p3': { id: 'dev-p3', personaName: 'NPC Sidekick', avatarUrl: '', status: 'ALIVE', silver: 40 } as any,
};
const MOCK_PLAYER_ID = 'dev-p1';

// --- Machine Selection ---

function getMachine(type: GameType) {
  switch (type) {
    case 'GAP_RUN': return gapRunMachine;
    case 'GRID_PUSH': return gridPushMachine;
    case 'SEQUENCE': return sequenceMachine;
    case 'REACTION_TIME': return reactionTimeMachine;
    case 'COLOR_MATCH': return colorMatchMachine;
    case 'STACKER': return stackerMachine;
    case 'QUICK_MATH': return quickMathMachine;
    case 'SIMON_SAYS': return simonSaysMachine;
    case 'AIM_TRAINER': return aimTrainerMachine;
    case 'TRIVIA': return triviaMachine;
    case 'REALTIME_TRIVIA': return realtimeTriviaMachine;
    case 'BET_BET_BET': return betBetBetMachine;
    case 'BLIND_AUCTION': return blindAuctionMachine;
    case 'KINGS_RANSOM': return kingsRansomMachine;
    case 'TOUCH_SCREEN': return touchScreenMachine;
  }
}

// --- Main Component ---

export default function GameDevHarness() {
  const [gameType, setGameType] = useState<GameType>('GAP_RUN');
  const [config, setConfig] = useState<GameConfig>(defaultConfig('GAP_RUN'));
  const [cartridge, setCartridge] = useState<GameProjection | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<AnyActorRef | null>(null);

  // Scroll event log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventLog]);

  // --- Reset: stop old actor, create new one ---
  const resetCartridge = useCallback((type: GameType, cfg: GameConfig) => {
    // Stop existing actor
    if (actorRef.current) {
      actorRef.current.stop();
      actorRef.current = null;
    }

    setEventLog([]);
    setCartridge(null);

    const machine = getMachine(type);
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
            const newCfg = defaultConfig(t);
            setGameType(t);
            setConfig(newCfg);
            resetCartridge(t, newCfg);
          }}
          className="bg-skin-panel border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs font-mono text-skin-base focus:border-skin-gold/50 focus:outline-none"
        >
          <option value="GAP_RUN">GAP_RUN</option>
          <option value="GRID_PUSH">GRID_PUSH</option>
          <option value="SEQUENCE">SEQUENCE</option>
          <option value="REACTION_TIME">REACTION_TIME</option>
          <option value="COLOR_MATCH">COLOR_MATCH</option>
          <option value="STACKER">STACKER</option>
          <option value="QUICK_MATH">QUICK_MATH</option>
          <option value="SIMON_SAYS">SIMON_SAYS</option>
          <option value="AIM_TRAINER">AIM_TRAINER</option>
          <option value="TRIVIA">TRIVIA</option>
          <option value="REALTIME_TRIVIA">REALTIME_TRIVIA</option>
          <option value="BET_BET_BET">BET_BET_BET</option>
          <option value="BLIND_AUCTION">BLIND_AUCTION</option>
          <option value="KINGS_RANSOM">KINGS_RANSOM</option>
          <option value="TOUCH_SCREEN">TOUCH_SCREEN</option>
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

        {['BET_BET_BET', 'BLIND_AUCTION', 'KINGS_RANSOM'].includes(gameType) && (
          <>
            <button
              onClick={() => {
                if (!actorRef.current) return;
                const botIds = ['dev-p2', 'dev-p3'];
                for (const botId of botIds) {
                  let payload: Record<string, any> = {};
                  if (gameType === 'BET_BET_BET') {
                    payload = { amount: Math.floor(Math.random() * 30) + 1 };
                  } else if (gameType === 'BLIND_AUCTION') {
                    payload = { slot: Math.floor(Math.random() * 3) + 1, amount: Math.floor(Math.random() * 20) };
                  } else if (gameType === 'KINGS_RANSOM') {
                    payload = { action: Math.random() > 0.5 ? 'STEAL' : 'PROTECT' };
                  }
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
          {!cartridge && (
            <div className="p-6 text-center">
              <span className="inline-block w-5 h-5 border-2 border-skin-gold border-t-transparent rounded-full spin-slow" />
              <p className="text-sm font-mono text-skin-dim animate-pulse mt-2">Loading machine...</p>
            </div>
          )}
          {cartridge && gameType === 'GAP_RUN' && <GapRun {...commonProps} />}
          {cartridge && gameType === 'GRID_PUSH' && <GridPush {...commonProps} />}
          {cartridge && gameType === 'SEQUENCE' && <SequenceGame {...commonProps} />}
          {cartridge && gameType === 'REACTION_TIME' && <ReactionTime {...commonProps} />}
          {cartridge && gameType === 'COLOR_MATCH' && <ColorMatch {...commonProps} />}
          {cartridge && gameType === 'STACKER' && <Stacker {...commonProps} />}
          {cartridge && gameType === 'QUICK_MATH' && <QuickMath {...commonProps} />}
          {cartridge && gameType === 'SIMON_SAYS' && <SimonSays {...commonProps} />}
          {cartridge && gameType === 'AIM_TRAINER' && <AimTrainer {...commonProps} />}
          {cartridge && gameType === 'TRIVIA' && <Trivia {...commonProps} />}
          {cartridge && gameType === 'REALTIME_TRIVIA' && <RealtimeTrivia {...commonProps} />}
          {cartridge && gameType === 'BET_BET_BET' && <BetBetBet {...commonProps} />}
          {cartridge && gameType === 'BLIND_AUCTION' && <BlindAuction {...commonProps} />}
          {cartridge && gameType === 'KINGS_RANSOM' && <KingsRansom {...commonProps} />}
          {cartridge && gameType === 'TOUCH_SCREEN' && <TouchScreen {...commonProps} />}
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
