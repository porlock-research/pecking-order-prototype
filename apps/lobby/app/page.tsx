'use client';

import { createGame, startDebugGame, getAuthStatus, getActiveGames } from './actions';
import type { DebugManifestConfig, DebugDayConfig, ActiveGame } from './actions';
import { useState, useEffect } from 'react';

const AVAILABLE_VOTE_TYPES = [
  { value: 'MAJORITY', label: 'Majority Vote' },
  { value: 'EXECUTIONER', label: 'Executioner' },
  { value: 'BUBBLE', label: 'Bubble (Top 3 Immune)' },
  { value: 'SECOND_TO_LAST', label: 'Second to Last (Auto)' },
  { value: 'PODIUM_SACRIFICE', label: 'Podium Sacrifice' },
  { value: 'SHIELD', label: 'Shield (Vote to Save)' },
  { value: 'TRUST_PAIRS', label: 'Trust Pairs' },
  { value: 'FINALS', label: 'Finals (Crown Winner)' },
];

const AVAILABLE_GAME_TYPES = [
  { value: 'NONE', label: 'No Game' },
  { value: 'TRIVIA', label: 'Trivia' },
  { value: 'REALTIME_TRIVIA', label: 'Real-Time Trivia' },
];

const AVAILABLE_ACTIVITY_TYPES = [
  { value: 'NONE', label: 'No Activity' },
  { value: 'PLAYER_PICK', label: 'Player Pick' },
  { value: 'PREDICTION', label: 'Prediction' },
  { value: 'WOULD_YOU_RATHER', label: 'Would You Rather' },
  { value: 'HOT_TAKE', label: 'Hot Take' },
  { value: 'CONFESSION', label: 'Confession' },
  { value: 'GUESS_WHO', label: 'Guess Who' },
];

const PUSH_TRIGGER_LABELS: { key: string; label: string }[] = [
  { key: 'DM_SENT', label: 'DM Received' },
  { key: 'ELIMINATION', label: 'Elimination' },
  { key: 'WINNER_DECLARED', label: 'Winner Declared' },
  { key: 'DAY_START', label: 'Day Started' },
  { key: 'ACTIVITY', label: 'Activity Started' },
  { key: 'VOTING', label: 'Voting Opened' },
  { key: 'NIGHT_SUMMARY', label: 'Night Summary' },
  { key: 'DAILY_GAME', label: 'Game Time' },
];

function createDefaultDay(): DebugDayConfig {
  return {
    voteType: 'MAJORITY',
    gameType: 'TRIVIA',
    activityType: 'PLAYER_PICK',
    events: { INJECT_PROMPT: true, START_ACTIVITY: true, END_ACTIVITY: true, OPEN_DMS: true, START_GAME: true, END_GAME: true, OPEN_VOTING: true, CLOSE_VOTING: true, CLOSE_DMS: true, END_DAY: true },
  };
}

function createDefaultManifestConfig(): DebugManifestConfig {
  return {
    dayCount: 2,
    days: [createDefaultDay(), createDefaultDay()],
    pushConfig: {
      DM_SENT: true, ELIMINATION: true, WINNER_DECLARED: true,
      DAY_START: true, ACTIVITY: true, VOTING: true, NIGHT_SUMMARY: true, DAILY_GAME: true,
    },
  };
}

export default function LobbyRoot() {
  const [status, setStatus] = useState<string>('SYSTEM_IDLE');
  const [gameId, setGameId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [clientHost, setClientHost] = useState<string>('http://localhost:5173');
  const [mode, setMode] = useState<'PECKING_ORDER' | 'BLITZ' | 'DEBUG_PECKING_ORDER'>('PECKING_ORDER');
  const [isLoading, setIsLoading] = useState(false);
  const [debugConfig, setDebugConfig] = useState<DebugManifestConfig>(createDefaultManifestConfig);
  const [tokens, setTokens] = useState<Record<string, string> | null>(null);
  const [skipInvites, setSkipInvites] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);

  useEffect(() => {
    getAuthStatus().then(s => { if (s.authed && s.email) setAuthEmail(s.email); });
    getActiveGames().then(setActiveGames);
  }, []);

  function handleDayCountChange(delta: number) {
    setDebugConfig(prev => {
      const newCount = Math.max(1, Math.min(7, prev.dayCount + delta));
      const days = [...prev.days];
      while (days.length < newCount) days.push(createDefaultDay());
      return { ...prev, dayCount: newCount, days: days.slice(0, newCount) };
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

  function handleActivityTypeChange(dayIdx: number, activityType: string) {
    setDebugConfig(prev => {
      const days = prev.days.map((d, i) => i === dayIdx ? { ...d, activityType } : d);
      return { ...prev, days };
    });
  }

  function handlePushToggle(trigger: string) {
    setDebugConfig(prev => ({
      ...prev,
      pushConfig: { ...prev.pushConfig, [trigger]: !prev.pushConfig[trigger] },
    }));
  }

  async function handleCreateGame() {
    setIsLoading(true);
    setStatus('CREATING_GAME...');
    setGameId(null);
    setInviteCode(null);
    setTokens(null);

    await new Promise(r => setTimeout(r, 400));

    const config = mode === 'DEBUG_PECKING_ORDER' ? debugConfig : undefined;
    const result = await createGame(mode, config);
    setIsLoading(false);

    if (result.success) {
      setStatus(`GAME_CREATED: ${result.gameId}`);
      setGameId(result.gameId ?? null);
      setInviteCode(result.inviteCode ?? null);
    } else {
      setStatus(`ERROR: ${result.error}`);
    }
  }

  async function handleDebugStart() {
    setIsLoading(true);
    setStatus('INITIALIZING_PROTOCOL...');
    setGameId(null);
    setTokens(null);

    await new Promise(r => setTimeout(r, 800));

    const config = mode === 'DEBUG_PECKING_ORDER' ? debugConfig : undefined;
    const result = await startDebugGame(mode, config);
    setIsLoading(false);

    if (result.success) {
      setStatus(`LOBBY_CREATED: ${result.gameId}`);
      setGameId(result.gameId ?? null);
      if (result.clientHost) setClientHost(result.clientHost);
      if (result.tokens) setTokens(result.tokens);
    } else {
      setStatus(`ERROR: ${result.error}`);
    }
  }

  const isDebugMode = mode === 'DEBUG_PECKING_ORDER';

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
          {authEmail && (
            <div className="text-xs font-mono text-skin-dim/60">
              Logged in as {authEmail}
            </div>
          )}

          <h1 className="text-6xl md:text-7xl font-display font-black tracking-tighter text-skin-gold mb-2 text-glow">
            PECKING ORDER
          </h1>

          <p className="text-lg text-skin-dim font-light tracking-wide max-w-sm mx-auto">
            Social Deception. <span className="badge-skew">One Survivor.</span>
          </p>
        </header>

        {/* Main Interface Card */}
        <div className="bg-skin-panel/30 backdrop-blur-md border border-skin-base p-1 rounded-3xl shadow-card overflow-hidden">
          <div className="bg-skin-deep/60 rounded-[20px] p-8 border border-skin-base">

            <div className="space-y-8">
              {/* Active Games */}
              {activeGames.length > 0 && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display">
                    Your Games
                  </label>
                  <div className="space-y-2">
                    {activeGames.map(game => {
                      const isStarted = game.status === 'STARTED';
                      const href = isStarted
                        ? `${clientHost}/?gameId=${game.id}`
                        : `/game/${game.inviteCode}/waiting`;
                      return (
                        <a
                          key={game.id}
                          href={href}
                          className="flex items-center justify-between p-3 bg-skin-panel/30 hover:bg-skin-panel/50 text-skin-base rounded-lg transition-all border border-skin-base hover:border-skin-dim/30 group"
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                              isStarted
                                ? 'bg-skin-green/20 text-skin-green border border-skin-green/30'
                                : 'bg-skin-info/20 text-skin-info border border-skin-info/30'
                            }`}>
                              {game.status}
                            </span>
                            <span className="text-xs font-mono text-skin-dim/60">{game.mode}</span>
                            <span className="text-[10px] font-mono text-skin-dim/40">{game.playerCount}p</span>
                          </div>
                          <span className="text-skin-dim/40 group-hover:text-skin-gold group-hover:translate-x-1 transition-all text-sm">
                            {isStarted ? 'Jump In' : 'Waiting'} &rarr;
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

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
              {isDebugMode && !gameId && (
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
                        -
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

                        <div className="grid grid-cols-3 gap-2">
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
                          <div className="relative">
                            <label className="text-[10px] font-mono text-skin-dim/50 mb-1 block">Activity</label>
                            <select
                              value={day.activityType}
                              onChange={(e) => handleActivityTypeChange(idx, e.target.value)}
                              className="w-full appearance-none bg-skin-input text-skin-base border border-skin-base rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all font-mono text-xs hover:border-skin-dim/30"
                            >
                              {AVAILABLE_ACTIVITY_TYPES.map(at => (
                                <option key={at.value} value={at.value}>{at.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="text-[10px] font-mono text-skin-dim/40">
                          All timeline actions enabled
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Push Alerts Config (debug mode only) */}
              {isDebugMode && !gameId && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display">
                    Push Alerts
                  </label>
                  <div className="border border-skin-base rounded-lg bg-skin-input/40 p-3 space-y-1.5">
                    {PUSH_TRIGGER_LABELS.map(({ key, label }) => (
                      <label key={key} className="flex items-center justify-between cursor-pointer group">
                        <span className="text-xs font-mono text-skin-dim/60 group-hover:text-skin-dim transition-colors">
                          {label}
                        </span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={debugConfig.pushConfig[key] ?? true}
                            onChange={() => handlePushToggle(key)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-skin-input border border-skin-base rounded-full peer-checked:bg-skin-gold/30 peer-checked:border-skin-gold/50 transition-all" />
                          <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-skin-dim/60 rounded-full peer-checked:translate-x-4 peer-checked:bg-skin-gold transition-all" />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Skip Invites Toggle (debug mode only) */}
              {isDebugMode && !gameId && (
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={skipInvites}
                      onChange={(e) => setSkipInvites(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-skin-input border border-skin-base rounded-full peer-checked:bg-skin-gold/30 peer-checked:border-skin-gold/50 transition-all" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-skin-dim/60 rounded-full peer-checked:translate-x-4 peer-checked:bg-skin-gold transition-all" />
                  </div>
                  <span className="text-xs font-mono text-skin-dim/60 group-hover:text-skin-dim transition-colors">
                    Skip invites (hardcoded players, no auth)
                  </span>
                </label>
              )}

              {/* Action Buttons */}
              {!gameId && (
                <div className="space-y-3">
                  {/* Primary action: Create Game (invite flow) or Quick Start */}
                  {isDebugMode && skipInvites ? (
                    <button
                      onClick={handleDebugStart}
                      disabled={isLoading}
                      className={`group w-full py-5 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transform transition-all flex items-center justify-center gap-3 relative overflow-hidden
                        ${isLoading
                          ? 'bg-skin-input text-skin-dim/40 cursor-wait'
                          : 'bg-skin-pink text-skin-base shadow-btn btn-press hover:brightness-110 active:scale-[0.99]'
                        }`}
                    >
                      {isLoading ? (
                        <>
                          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></span>
                          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></span>
                        </>
                      ) : (
                        <>Quick Start</>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleCreateGame}
                      disabled={isLoading}
                      className={`group w-full py-5 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transform transition-all flex items-center justify-center gap-3 relative overflow-hidden
                        ${isLoading
                          ? 'bg-skin-input text-skin-dim/40 cursor-wait'
                          : 'bg-skin-pink text-skin-base shadow-btn btn-press hover:brightness-110 active:scale-[0.99]'
                        }`}
                    >
                      {isLoading ? (
                        <>
                          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></span>
                          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></span>
                        </>
                      ) : (
                        <>Create Game</>
                      )}
                    </button>
                  )}
                </div>
              )}

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

              {/* Invite Code Display (after createGame) */}
              {inviteCode && !tokens && (
                <div className="slide-up-in space-y-4">
                  <div className="text-center space-y-2">
                    <div className="text-xs font-display font-bold text-skin-dim uppercase tracking-widest">
                      Invite Code
                    </div>
                    <div className="text-4xl font-mono font-black text-skin-gold tracking-[0.3em] select-all">
                      {inviteCode}
                    </div>
                    <p className="text-xs text-skin-dim/60">Share this code with your players</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <a
                      href={`/join/${inviteCode}`}
                      className="flex items-center justify-between p-4 bg-skin-panel/30 hover:bg-skin-panel/50 text-skin-base rounded-lg transition-all border border-skin-base hover:border-skin-dim/30 group"
                    >
                      <span className="font-medium text-sm flex flex-col">
                        <span className="font-bold text-skin-base">Join as Host</span>
                        <span className="text-xs text-skin-dim/60">Pick your character</span>
                      </span>
                      <span className="text-skin-dim/40 group-hover:text-skin-gold group-hover:translate-x-1 transition-all">&rarr;</span>
                    </a>

                    {inviteCode && (
                      <a
                        href={`/game/${inviteCode}/waiting`}
                        className="flex items-center justify-between p-4 bg-skin-info/10 hover:bg-skin-info/20 text-skin-info rounded-lg transition-all border border-skin-info/20 hover:border-skin-info/40 group"
                      >
                        <span className="font-medium text-sm flex flex-col">
                          <span className="font-bold text-skin-info">Waiting Room</span>
                          <span className="text-xs text-skin-info/50">See who has joined</span>
                        </span>
                        <span className="text-skin-info/30 group-hover:text-skin-info group-hover:translate-x-1 transition-all">&rarr;</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Debug Start Success (after startDebugGame) */}
              {tokens && gameId && (
                <div className="grid grid-cols-1 gap-3 slide-up-in pt-2">
                  <a
                    href={`${clientHost}/?token=${tokens['p1']}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 bg-skin-panel/30 hover:bg-skin-panel/50 text-skin-base rounded-lg transition-all border border-skin-base hover:border-skin-dim/30 group"
                  >
                    <span className="font-medium text-sm flex flex-col">
                      <span className="font-bold text-skin-base">Enter Simulation</span>
                      <span className="text-xs text-skin-dim/60">Connect as Player 1</span>
                    </span>
                    <span className="text-skin-dim/40 group-hover:text-skin-gold group-hover:translate-x-1 transition-all">&rarr;</span>
                  </a>

                  {isDebugMode && (
                    <a
                      href={`/admin/game/${gameId}`}
                      className="flex items-center justify-between p-4 bg-skin-info/10 hover:bg-skin-info/20 text-skin-info rounded-lg transition-all border border-skin-info/20 hover:border-skin-info/40 group"
                    >
                      <span className="font-medium text-sm flex flex-col">
                        <span className="font-bold text-skin-info">Admin Console</span>
                        <span className="text-xs text-skin-info/50">God Mode Controls</span>
                      </span>
                      <span className="text-skin-info/30 group-hover:text-skin-info group-hover:translate-x-1 transition-all">&rarr;</span>
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
