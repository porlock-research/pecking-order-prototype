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

function createDefaultDay(): DebugDayConfig {
  return {
    voteType: "MAJORITY",
    events: { INJECT_PROMPT: true, OPEN_VOTING: true, CLOSE_VOTING: false, END_DAY: true },
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
    <div className="min-h-screen bg-black bg-grid-pattern flex flex-col items-center justify-center p-4 font-sans text-white relative selection:bg-yellow-500/30">
      
      {/* Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-indigo-900/20 to-transparent opacity-50 pointer-events-none" />

      <div className="max-w-xl w-full relative z-10">
        
        {/* Header */}
        <header className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center justify-center px-3 py-1 border border-white/10 rounded-full bg-white/5 backdrop-blur-sm mb-4">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2"></span>
            <span className="text-xs font-mono text-white/60 tracking-widest uppercase">Network Online</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40 mb-2">
            PECKING ORDER
          </h1>
          
          <p className="text-lg text-white/60 font-light tracking-wide max-w-sm mx-auto">
            7 Days. 8 Players. <span className="text-yellow-400 font-medium">One Survivor.</span>
          </p>
        </header>

        {/* Main Interface Card */}
        <div className="bg-zinc-900/50 backdrop-blur-md border border-white/10 p-1 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/5">
          <div className="bg-black/40 rounded-[20px] p-8 border border-white/5">
            
            <div className="space-y-8">
              {/* Game Mode Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">
                  Configuration
                </label>
                <div className="relative group">
                  <select 
                    value={mode}
                    onChange={(e) => setMode(e.target.value as any)}
                    className="w-full appearance-none bg-zinc-900/80 text-white border border-white/10 rounded-xl px-5 py-4 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all font-mono text-sm hover:border-white/20"
                  >
                    <option value="PECKING_ORDER">STANDARD_CYCLE (7 Days)</option>
                    <option value="BLITZ">BLITZ_PROTOCOL (Fast Paced)</option>
                    <option value="DEBUG_PECKING_ORDER">DEBUG_OVERRIDE (Manual)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-white/30 group-hover:text-white/60 transition-colors">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {/* Debug Manifest Panel */}
              {mode === 'DEBUG_PECKING_ORDER' && !gameId && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest pl-1">
                      Debug Manifest
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/40">Days:</span>
                      <button
                        onClick={() => handleDayCountChange(-1)}
                        disabled={debugConfig.dayCount <= 1}
                        className="w-7 h-7 flex items-center justify-center bg-zinc-900/80 border border-white/10 rounded-lg font-mono text-sm text-white/60 hover:text-yellow-400 hover:border-yellow-500/30 transition-all disabled:opacity-30 disabled:hover:text-white/60 disabled:hover:border-white/10"
                      >
                        −
                      </button>
                      <span className="font-mono text-sm text-yellow-400 w-4 text-center">{debugConfig.dayCount}</span>
                      <button
                        onClick={() => handleDayCountChange(1)}
                        disabled={debugConfig.dayCount >= 7}
                        className="w-7 h-7 flex items-center justify-center bg-zinc-900/80 border border-white/10 rounded-lg font-mono text-sm text-white/60 hover:text-yellow-400 hover:border-yellow-500/30 transition-all disabled:opacity-30 disabled:hover:text-white/60 disabled:hover:border-white/10"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {debugConfig.days.map((day, idx) => (
                      <div key={idx} className="border border-white/10 rounded-lg bg-zinc-900/40 p-4 space-y-3">
                        <div className="font-mono text-xs text-yellow-400 tracking-widest">
                          DAY_{String(idx + 1).padStart(2, '0')}
                        </div>

                        <div className="relative">
                          <select
                            value={day.voteType}
                            onChange={(e) => handleVoteTypeChange(idx, e.target.value)}
                            className="w-full appearance-none bg-zinc-900/80 text-white border border-white/10 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all font-mono text-sm hover:border-white/20"
                          >
                            {AVAILABLE_VOTE_TYPES.map(vt => (
                              <option key={vt.value} value={vt.value}>{vt.label}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/30">
                            <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {(['INJECT_PROMPT', 'OPEN_VOTING', 'CLOSE_VOTING', 'END_DAY'] as const).map(eventKey => (
                            <label key={eventKey} className="flex items-center gap-2 cursor-pointer group/cb">
                              <input
                                type="checkbox"
                                checked={day.events[eventKey]}
                                onChange={() => handleEventToggle(idx, eventKey)}
                                className="accent-yellow-500 w-3.5 h-3.5"
                              />
                              <span className="font-mono text-xs text-white/50 group-hover/cb:text-white/70 transition-colors">
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
                className={`group w-full py-5 font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transform transition-all flex items-center justify-center gap-3 relative overflow-hidden
                  ${isLoading 
                    ? 'bg-zinc-800 text-white/30 cursor-wait' 
                    : gameId 
                      ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 cursor-default'
                      : 'bg-white text-black hover:bg-yellow-400 hover:scale-[1.01] active:scale-[0.99]'
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
              <div className="font-mono text-xs border-t border-white/5 pt-6 mt-6">
                <div className="flex justify-between items-center text-white/30 mb-2">
                  <span>SYSTEM_LOG</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500/50"></span>
                </div>
                <div className={`p-3 rounded bg-black/50 border border-white/5 text-left transition-colors duration-300 ${gameId ? 'text-emerald-400/90' : 'text-white/50'}`}>
                  {`> ${status}`}
                  <span className="animate-pulse">_</span>
                </div>
              </div>

              {/* Success Actions */}
              {gameId && (
                <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700 pt-2">
                  <a 
                    href={`http://localhost:5173/?gameId=${gameId}&playerId=p1`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 bg-zinc-800/50 hover:bg-zinc-800 text-white/90 rounded-lg transition-all border border-white/5 hover:border-white/20 group"
                  >
                    <span className="font-medium text-sm flex flex-col">
                      <span className="font-bold text-white">Enter Simulation</span>
                      <span className="text-xs text-white/40">Connect as Player 1</span>
                    </span>
                    <span className="text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all">→</span>
                  </a>

                  {mode === 'DEBUG_PECKING_ORDER' && (
                    <a 
                      href={`/admin/game/${gameId}`}
                      className="flex items-center justify-between p-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 rounded-lg transition-all border border-indigo-500/20 hover:border-indigo-500/40 group"
                    >
                      <span className="font-medium text-sm flex flex-col">
                        <span className="font-bold text-indigo-300">Admin Console</span>
                        <span className="text-xs text-indigo-300/50">God Mode Controls</span>
                      </span>
                      <span className="text-indigo-400/30 group-hover:text-indigo-300 group-hover:translate-x-1 transition-all">⚡️</span>
                    </a>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center text-[10px] text-white/20 uppercase tracking-widest font-mono">
          <div>Secure Connection</div>
          <div>v0.9.2 BETA</div>
          <div>PartyKit Inc.</div>
        </div>

      </div>
    </div>
  );
}
