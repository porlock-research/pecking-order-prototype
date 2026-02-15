import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createActor, fromPromise, type AnyActorRef, type Snapshot } from 'xstate';
import type { SocialPlayer, GameProjection } from '@pecking-order/shared-types';
import {
  gapRunMachine,
  triviaMachine,
  realtimeTriviaMachine,
  FALLBACK_QUESTIONS,
  projectGameCartridge,
} from '@pecking-order/game-cartridges';
import GapRun from '../cartridges/GapRun';
import RealtimeTrivia from '../cartridges/RealtimeTrivia';
import Trivia from '../cartridges/Trivia';

// --- Types ---

type GameType = 'GAP_RUN' | 'TRIVIA' | 'REALTIME_TRIVIA';

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
    case 'TRIVIA': return triviaMachine;
    case 'REALTIME_TRIVIA': return realtimeTriviaMachine;
  }
}

// --- Main Component ---

export default function GameDevHarness() {
  const [gameType, setGameType] = useState<GameType>('GAP_RUN');
  const [seed, setSeed] = useState(42);
  const [cartridge, setCartridge] = useState<GameProjection | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<AnyActorRef | null>(null);

  // Scroll event log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventLog]);

  const addLog = useCallback((type: string, payload?: Record<string, any>, label?: string) => {
    setEventLog(prev => [...prev, { ts: Date.now(), type, payload, label }]);
  }, []);

  // --- Reset: stop old actor, create new one ---
  const resetCartridge = useCallback((type: GameType, s: number) => {
    // Stop existing actor
    if (actorRef.current) {
      actorRef.current.stop();
      actorRef.current = null;
    }

    setEventLog([]);
    setCartridge(null);

    const machine = getMachine(type);
    const input = { gameType: type, roster: MOCK_ROSTER, dayIndex: 1 };

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
      }),
      emitPlayerGameResult: ({ event }: any) => logEvent('CARTRIDGE.PLAYER_GAME_RESULT', {
        playerId: event.playerId, silverReward: event.silverReward,
      }),
    };

    // Build provide overrides per game type
    const provideConfig: any = { actions: { ...parentStubs } };

    if (type === 'TRIVIA' || type === 'REALTIME_TRIVIA') {
      provideConfig.actors = {
        fetchQuestions: fromPromise(async () => FALLBACK_QUESTIONS),
      };
    }
    if (type === 'REALTIME_TRIVIA') {
      provideConfig.delays = { QUESTION_TIMER: 8000, RESULT_TIMER: 2000 };
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
    resetCartridge(gameType, seed);
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
            setGameType(t);
            resetCartridge(t, seed);
          }}
          className="bg-skin-panel border border-white/[0.1] rounded-lg px-3 py-1.5 text-xs font-mono text-skin-base focus:border-skin-gold/50 focus:outline-none"
        >
          <option value="GAP_RUN">GAP_RUN</option>
          <option value="TRIVIA">TRIVIA</option>
          <option value="REALTIME_TRIVIA">REALTIME_TRIVIA</option>
        </select>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-mono text-skin-dim uppercase tracking-widest">Seed</label>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value) || 0)}
            className="w-20 bg-skin-panel border border-white/[0.1] rounded-lg px-2 py-1.5 text-xs font-mono text-skin-base focus:border-skin-gold/50 focus:outline-none"
          />
        </div>

        <button
          onClick={() => resetCartridge(gameType, seed)}
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
          {cartridge && gameType === 'TRIVIA' && <Trivia {...commonProps} />}
          {cartridge && gameType === 'REALTIME_TRIVIA' && <RealtimeTrivia {...commonProps} />}
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
