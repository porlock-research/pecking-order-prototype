'use client';

import { startGameStub } from "./actions";
import type { DebugManifestConfig, DebugDayConfig } from "./actions";
import { useState } from "react";

const AVAILABLE_VOTE_TYPES = [
  { value: "MAJORITY", label: "Majority Vote" },
  { value: "EXECUTIONER", label: "Executioner" },
  { value: "BUBBLE", label: "Bubble (Top 3 Immune)" },
  { value: "SECOND_TO_LAST", label: "Second to Last (Auto)" },
  { value: "PODIUM_SACRIFICE", label: "Podium Sacrifice" },
  { value: "SHIELD", label: "Shield (Vote to Save)" },
  { value: "TRUST_PAIRS", label: "Trust Pairs" },
];

const AVAILABLE_GAME_TYPES = [
  { value: "NONE", label: "No Game" },
  { value: "TRIVIA", label: "Trivia" },
  { value: "REALTIME_TRIVIA", label: "Real-Time Trivia" },
];

function createDefaultDay(): DebugDayConfig {
  return {
    voteType: "MAJORITY",
    gameType: "NONE",
    events: { INJECT_PROMPT: true, OPEN_DMS: true, START_GAME: false, END_GAME: false, OPEN_VOTING: true, CLOSE_VOTING: false, CLOSE_DMS: false, END_DAY: true },
  };
}

function createDefaultManifestConfig(): DebugManifestConfig {
  return { dayCount: 2, days: [createDefaultDay(), createDefaultDay()] };
}

export default function LobbyRoot() {
  const [status, setStatus] = useState<string>("SYSTEM_IDLE");
  const [gameId, setGameId] = useState<string | null>(null);
  const [mode, setMode] = useState<"PECKING_ORDER" | "BLITZ" | "DEBUG_PECKING_ORDER">("PECKING_ORDER");
  const [isLoading, setIsLoading] = useState(false);
  const [debugConfig, setDebugConfig] = useState<DebugManifestConfig>(createDefaultManifestConfig);

  function handleDayCountChange(delta: number) {
    setDebugConfig(prev => {
      const newCount = Math.max(1, Math.min(7, prev.dayCount + delta));
      const days = [...prev.days];
      while (days.length < newCount) days.push(createDefaultDay());
      return { dayCount: newCount, days: days.slice(0, newCount) };
    });
  }

  function handleVoteTypeChange(dayIdx: number, voteType: string) {
    setDebugConfig(prev => {
      const days = prev.days.map((d, i) => i === dayIdx ? { ...d, voteType } : d);
      return { ...prev, days };
    });
  }

  function handleGameTypeChange(dayIdx: number, gameType: string) {
    setDebugConfig(prev => {
      const days = prev.days.map((d, i) => i === dayIdx ? { ...d, gameType } : d);
      return { ...prev, days };
    });
  }

  function handleEventToggle(dayIdx: number, eventKey: keyof DebugDayConfig['events']) {
    setDebugConfig(prev => {
      const days = prev.days.map((d, i) =>
        i === dayIdx ? { ...d, events: { ...d.events, [eventKey]: !d.events[eventKey] } } : d
      );
      return { ...prev, days };
    });
  }

  async function handleStart() {
    setIsLoading(true);
    setStatus("INITIALIZING_PROTOCOL...");
    setGameId(null);

    // Artificial delay for effect
    await new Promise(r => setTimeout(r, 800));

    const config = mode === 'DEBUG_PECKING_ORDER' ? debugConfig : undefined;
    const result = await startGameStub(mode, config);
    setIsLoading(false);

    if (result.success) {
      setStatus(`LOBBY_CREATED: ${result.gameId}`);
      setGameId(result.gameId ?? null);
    } else {
      setStatus(`ERROR: ${result.error}`);
    }
  }

  return (
    <div className="min-h-screen bg-skin-deep bg-grid-pattern flex flex-col items-center justify-center p-4 font-body text-skin-base relative selection:bg-skin-gold/30">

      {/* Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-skin-panel/40 to-transparent opacity-60 pointer-events-none" />

      <div className="max-w-xl w-full relative z-10">

        {/* Header */}
        <header className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center justify-center px-3 py-1 border border-skin-base rounded-full bg-skin-glass backdrop-blur-sm mb-4">
            <span className="w-2 h-2 rounded-full bg-skin-green animate-pulse-live mr-2"></span>
            <span className="text-xs font-mono text-skin-dim tracking-widest uppercase">Network Online</span>
          </div>

          <h1 className="text-6xl md:text-7xl font-display font-black tracking-tighter text-skin-gold mb-2 text-glow">
            PECKING ORDER
          </h1>

          <p className="text-lg text-skin-dim font-light tracking-wide max-w-sm mx-auto">
            7 Days. 8 Players. <span className="badge-skew">One Survivor.</span>
          </p>
        </header>

        {/* Main Interface Card */}
        <div className="bg-skin-panel/30 backdrop-blur-md border border-skin-base p-1 rounded-3xl shadow-card overflow-hidden">
          <div className="bg-skin-deep/60 rounded-[20px] p-8 border border-skin-base">

            <div className="space-y-8">
              {/* Game Mode Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display">
                  Configuration
                </label>
                <div className="relative group">
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as any)}
                    className="w-full appearance-none bg-skin-input text-skin-base border border-skin-base rounded-xl px-5 py-4 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all font-mono text-sm hover:border-skin-dim/30"
                  >
                    <option value="PECKING_ORDER">STANDARD_CYCLE (7 Days)</option>
                    <option value="BLITZ">BLITZ_PROTOCOL (Fast Paced)</option>
                    <option value="DEBUG_PECKING_ORDER">DEBUG_OVERRIDE (Manual)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-skin-dim/50 group-hover:text-skin-dim transition-colors">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                  </div>
                </div>
              </div>

              {/* Debug Manifest Panel */}
              {mode === 'DEBUG_PECKING_ORDER' && !gameId && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display">
                      Debug Manifest
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-skin-dim/60">Days:</span>
                      <button
                        onClick={() => handleDayCountChange(-1)}
                        disabled={debugConfig.dayCount <= 1}
                        className="w-7 h-7 flex items-center justify-center bg-skin-input border border-skin-base rounded-lg font-mono text-sm text-skin-dim hover:text-skin-gold hover:border-skin-gold/30 transition-all disabled:opacity-30 disabled:hover:text-skin-dim disabled:hover:border-skin-base"
                      >
                        −
                      </button>
                      <span className="font-mono text-sm text-skin-gold w-4 text-center">{debugConfig.dayCount}</span>
                      <button
                        onClick={() => handleDayCountChange(1)}
                        disabled={debugConfig.dayCount >= 7}
                        className="w-7 h-7 flex items-center justify-center bg-skin-input border border-skin-base rounded-lg font-mono text-sm text-skin-dim hover:text-skin-gold hover:border-skin-gold/30 transition-all disabled:opacity-30 disabled:hover:text-skin-dim disabled:hover:border-skin-base"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {debugConfig.days.map((day, idx) => (
                      <div key={idx} className="border border-skin-base rounded-lg bg-skin-input/40 p-4 space-y-3">
                        <div className="font-mono text-xs text-skin-gold tracking-widest">
                          DAY_{String(idx + 1).padStart(2, '0')}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <label className="text-[10px] font-mono text-skin-dim/50 mb-1 block">Vote</label>
                            <select
                              value={day.voteType}
                              onChange={(e) => handleVoteTypeChange(idx, e.target.value)}
                              className="w-full appearance-none bg-skin-input text-skin-base border border-skin-base rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all font-mono text-xs hover:border-skin-dim/30"
                            >
                              {AVAILABLE_VOTE_TYPES.map(vt => (
                                <option key={vt.value} value={vt.value}>{vt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="relative">
                            <label className="text-[10px] font-mono text-skin-dim/50 mb-1 block">Game</label>
                            <select
                              value={day.gameType}
                              onChange={(e) => handleGameTypeChange(idx, e.target.value)}
                              className="w-full appearance-none bg-skin-input text-skin-base border border-skin-base rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all font-mono text-xs hover:border-skin-dim/30"
                            >
                              {AVAILABLE_GAME_TYPES.map(gt => (
                                <option key={gt.value} value={gt.value}>{gt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {(['INJECT_PROMPT', 'OPEN_DMS', 'START_GAME', 'END_GAME', 'OPEN_VOTING', 'CLOSE_VOTING', 'CLOSE_DMS', 'END_DAY'] as const).map(eventKey => (
                            <label key={eventKey} className="flex items-center gap-2 cursor-pointer group/cb">
                              <input
                                type="checkbox"
                                checked={day.events[eventKey]}
                                onChange={() => handleEventToggle(idx, eventKey)}
                                className="accent-[var(--po-gold)] w-3.5 h-3.5"
                              />
                              <span className="font-mono text-xs text-skin-dim/70 group-hover/cb:text-skin-dim transition-colors">
                                {eventKey}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleStart}
                disabled={isLoading || !!gameId}
                className={`group w-full py-5 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transform transition-all flex items-center justify-center gap-3 relative overflow-hidden
                  ${isLoading
                    ? 'bg-skin-input text-skin-dim/40 cursor-wait'
                    : gameId
                      ? 'bg-skin-green/10 text-skin-green border border-skin-green/30 cursor-default'
                      : 'bg-skin-pink text-skin-base shadow-btn btn-press hover:brightness-110 active:scale-[0.99]'
                  }`}
              >
                {isLoading ? (
                  <>
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></span>
                  </>
                ) : gameId ? (
                  <>Protocol Active</>
                ) : (
                  <>Initialize Lobby</>
                )}
              </button>

              {/* Terminal Output */}
              <div className="font-mono text-xs border-t border-skin-base/30 pt-6 mt-6">
                <div className="flex justify-between items-center text-skin-dim/50 mb-2">
                  <span>SYSTEM_LOG</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-skin-green/50 pulse-live"></span>
                </div>
                <div className={`p-3 rounded bg-skin-deep/80 border border-skin-base/30 text-left transition-colors duration-300 ${gameId ? 'text-skin-green' : 'text-skin-dim/70'}`}>
                  {`> ${status}`}
                  <span className="animate-pulse">_</span>
                </div>
              </div>

              {/* Success Actions */}
              {gameId && (
                <div className="grid grid-cols-1 gap-3 slide-up-in pt-2">
                  <a
                    href={`${process.env.NEXT_PUBLIC_GAME_CLIENT_URL || 'http://localhost:5173'}/?gameId=${gameId}&playerId=p1`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 bg-skin-panel/30 hover:bg-skin-panel/50 text-skin-base rounded-lg transition-all border border-skin-base hover:border-skin-dim/30 group"
                  >
                    <span className="font-medium text-sm flex flex-col">
                      <span className="font-bold text-skin-base">Enter Simulation</span>
                      <span className="text-xs text-skin-dim/60">Connect as Player 1</span>
                    </span>
                    <span className="text-skin-dim/40 group-hover:text-skin-gold group-hover:translate-x-1 transition-all">→</span>
                  </a>

                  {mode === 'DEBUG_PECKING_ORDER' && (
                    <a
                      href={`/admin/game/${gameId}`}
                      className="flex items-center justify-between p-4 bg-skin-info/10 hover:bg-skin-info/20 text-skin-info rounded-lg transition-all border border-skin-info/20 hover:border-skin-info/40 group"
                    >
                      <span className="font-medium text-sm flex flex-col">
                        <span className="font-bold text-skin-info">Admin Console</span>
                        <span className="text-xs text-skin-info/50">God Mode Controls</span>
                      </span>
                      <span className="text-skin-info/30 group-hover:text-skin-info group-hover:translate-x-1 transition-all">⚡️</span>
                    </a>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-[10px] text-skin-dim/30 uppercase tracking-widest font-mono">
          <div>Secure Connection</div>
          <div>v0.9.2 BETA</div>
          <div>PartyKit Inc.</div>
        </div>

      </div>
    </div>
  );
}
