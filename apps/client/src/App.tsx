import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { useGameEngine } from './hooks/useGameEngine';
import { ChatRoom } from './components/ChatRoom';
import { DirectMessages } from './components/DirectMessages';
import { NewsTicker } from './components/NewsTicker';
import VotingPanel from './cartridges/voting/Voting';
import GamePanel from './cartridges/games/GamePanel';
import GameHistory from './cartridges/games/GameHistory';
import PromptPanel from './cartridges/prompts/PromptPanel';
import PerkPanel from './components/PerkPanel';

const GameDevHarness = lazy(() => import('./components/GameDevHarness'));
import { formatState, formatPhase } from './utils/formatState';
import { Coins, MessageCircle, Mail, Users } from 'lucide-react';
import { decodeGameToken } from '@pecking-order/auth';
import { PushPrompt } from './components/PushPrompt';

/**
 * Extracts a game code from the URL path (e.g. /game/X7K2MP → X7K2MP)
 */
function getGameCodeFromPath(): string | null {
  const match = window.location.pathname.match(/^\/game\/([A-Za-z0-9]+)\/?$/);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Applies a JWT token: decodes it, sets state, and stores in sessionStorage.
 * If a gameCode is provided, keys the storage by that code and cleans the URL.
 */
function applyToken(
  jwt: string,
  gameCode: string | null,
  setGameId: (id: string) => void,
  setPlayerId: (id: string) => void,
  setToken: (t: string) => void,
) {
  const decoded = decodeGameToken(jwt);
  setGameId(decoded.gameId);
  setPlayerId(decoded.playerId);
  setToken(jwt);
  useGameStore.getState().setPlayerId(decoded.playerId);

  // Persist in sessionStorage keyed by game code (for refresh resilience)
  const key = gameCode || decoded.gameId;
  sessionStorage.setItem(`po_token_${key}`, jwt);

  // Clean transient params from URL
  if (gameCode) {
    window.history.replaceState({}, '', `/game/${gameCode}`);
  }
}

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const { dayIndex, roster, serverState } = useGameStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gameCode = getGameCodeFromPath();
    const transientToken = params.get('_t');
    const rawToken = params.get('token');

    if (gameCode && transientToken) {
      // Arrived via lobby redirect: /game/CODE?_t=JWT
      // Store token, clean URL
      try {
        applyToken(transientToken, gameCode, setGameId, setPlayerId, setToken);
      } catch {
        console.error('Invalid token from redirect');
      }
    } else if (gameCode) {
      // Clean URL visit: /game/CODE — check sessionStorage
      const cached = sessionStorage.getItem(`po_token_${gameCode}`);
      if (cached) {
        try {
          applyToken(cached, gameCode, setGameId, setPlayerId, setToken);
        } catch {
          sessionStorage.removeItem(`po_token_${gameCode}`);
          console.error('Cached token invalid');
        }
      }
      // If no cached token, the "awaiting signal" screen shows —
      // user needs to visit via lobby /play/CODE to get authenticated
    } else if (rawToken) {
      // Direct JWT entry: ?token=JWT (debug links from lobby)
      try {
        applyToken(rawToken, null, setGameId, setPlayerId, setToken);
      } catch {
        console.error('Invalid token');
      }
    } else {
      // Legacy: plain query param entry (backward compat for debug)
      const gid = params.get('gameId');
      const pid = params.get('playerId') || 'p1';
      setGameId(gid);
      setPlayerId(pid);
      if (pid) {
        useGameStore.getState().setPlayerId(pid);
      }
    }
  }, []);

  if (window.location.pathname === '/dev/games') {
    return (
      <Suspense fallback={null}>
        <GameDevHarness />
      </Suspense>
    );
  }

  if (!gameId) {
    return <LauncherScreen />;
  }

  if (!playerId) return (
    <div className="min-h-screen bg-gradient-velvet flex flex-col items-center justify-center gap-3">
      <span className="w-6 h-6 border-2 border-skin-gold border-t-transparent rounded-full spin-slow" />
      <span className="text-skin-gold font-mono animate-shimmer uppercase tracking-widest text-sm">
        ESTABLISHING_UPLINK...
      </span>
    </div>
  );

  return (
    <GameShell gameId={gameId} playerId={playerId} token={token} />
  );
}

/**
 * Launcher screen at `/` — shown when no gameId in URL.
 * Scans sessionStorage for cached game tokens and lists them.
 */
function LauncherScreen() {
  const cachedGames: Array<{ code: string; personaName: string; gameId: string }> = [];

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith('po_token_')) {
      const token = sessionStorage.getItem(key);
      if (token) {
        try {
          const decoded = decodeGameToken(token);
          const code = key.replace('po_token_', '');
          cachedGames.push({ code, personaName: decoded.personaName, gameId: decoded.gameId });
        } catch {
          // Invalid token — skip
        }
      }
    }
  }

  const lobbyHost = import.meta.env.VITE_LOBBY_HOST || 'http://localhost:3000';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-velvet text-skin-base p-8 text-center space-y-8 overflow-hidden">
      {/* Title */}
      <div className="space-y-4">
        <h1
          className="text-6xl sm:text-8xl font-black uppercase tracking-tighter font-display leading-none"
          style={{
            color: 'var(--po-gold)',
            textShadow: '0 0 30px rgba(251, 191, 36, 0.4), 0 0 60px rgba(251, 191, 36, 0.15)',
            animation: 'title-glow 4s ease-in-out infinite',
          }}
        >
          Pecking<br />Order
        </h1>
        <p className="text-lg sm:text-xl text-skin-dim/80 italic font-body tracking-wide">
          keep your friends close...
        </p>
      </div>

      {/* Push prompt — subscribes early using any cached JWT */}
      <PushPrompt />

      {/* Game list or empty state */}
      {cachedGames.length > 0 ? (
        <div className="w-full max-w-sm space-y-3">
          <p className="text-xs font-mono text-skin-dim/60 uppercase tracking-widest">
            Your Games
          </p>
          {cachedGames.map((g) => (
            <a
              key={g.code}
              href={`/game/${g.code}`}
              className="flex items-center justify-between p-4 rounded-xl border border-white/[0.06] bg-glass hover:border-skin-gold/30 transition-all group"
            >
              <div className="flex flex-col items-start gap-1">
                <span className="text-sm font-bold text-skin-base group-hover:text-skin-gold transition-colors">
                  {g.personaName}
                </span>
                <span className="text-[10px] font-mono text-skin-dim uppercase tracking-wider">
                  {g.code}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-skin-gold/60 group-hover:text-skin-gold uppercase tracking-widest transition-colors">
                Enter
              </span>
            </a>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full border border-skin-gold/20 glow-breathe" />
            <div className="absolute inset-3 rounded-full border border-skin-gold/10" style={{ animation: 'pulse-live 3s ease-in-out infinite 0.5s' }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-3xl text-skin-gold/60">//</span>
            </div>
          </div>
          <p className="text-sm font-mono text-skin-dim/50 uppercase tracking-widest">
            No active games
          </p>
          <a
            href={lobbyHost}
            className="inline-block text-xs font-mono text-skin-gold/70 hover:text-skin-gold underline underline-offset-4 uppercase tracking-widest transition-colors"
          >
            Join from the lobby
          </a>
        </div>
      )}
    </div>
  );
}

function RosterRow({ player, playerId }: { player: any; playerId: string }) {
  const isMe = player.id === playerId;
  const isOnline = useGameStore((s) => s.onlinePlayers.includes(player.id));
  return (
    <li
      className={`flex items-center justify-between p-3 rounded-xl border transition-all
        ${isMe
          ? 'bg-skin-gold/10 border-skin-gold/30'
          : 'bg-glass border-white/[0.06] hover:border-white/20'
        }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-skin-panel flex items-center justify-center text-sm font-bold font-mono text-skin-gold avatar-ring">
            {player.personaName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-skin-fill ${isOnline ? 'bg-skin-green' : 'bg-skin-dim/40'}`} />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm">
            {player.personaName}
            {isMe && <span className="ml-2 badge-skew text-[9px]">YOU</span>}
          </span>
          <span className="text-[10px] font-mono text-skin-dim uppercase tracking-wider">{player.status}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 font-mono text-sm text-skin-gold font-bold">
        <Coins size={12} className="text-gray-300" />
        {player.silver}
      </div>
    </li>
  );
}

function GameShell({ gameId, playerId, token }: { gameId: string, playerId: string, token: string | null }) {
  const { dayIndex, roster, serverState } = useGameStore();
  const engine = useGameEngine(gameId, playerId, token);
  const [activeTab, setActiveTab] = useState<'chat' | 'dms' | 'roster'>('chat');
  const hasDms = useGameStore(s => s.chatLog.some(m => m.channel === 'DM'));

  const me = roster[playerId];
  const aliveCount = Object.values(roster).filter((p: any) => p.status === 'ALIVE').length;
  const onlineCount = useGameStore((s) => s.onlinePlayers.length);

  return (
    <div className="fixed inset-0 flex flex-col bg-skin-fill text-skin-base font-body overflow-hidden bg-grid-pattern selection:bg-skin-gold selection:text-skin-inverted">

      {/* Header */}
      <header className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-b border-white/[0.06] px-4 py-2.5 flex items-center justify-between shadow-card z-50">
        {/* Left: Title + Phase */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black font-display tracking-tighter text-skin-gold italic text-glow leading-none">
            PECKING ORDER
          </h1>
          <span className="badge-skew text-[9px] py-0.5 px-2">
            {formatPhase(serverState)}
          </span>
        </div>

        {/* Right: Push + Online pill + Silver */}
        <div className="flex items-center gap-3">
          <PushPrompt token={token} />
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-pill bg-skin-green/10 border border-skin-green/20">
            <span className="w-1.5 h-1.5 rounded-full bg-skin-green animate-pulse-live" />
            <span className="text-[9px] font-mono text-skin-green uppercase tracking-widest font-bold">{onlineCount} Online</span>
          </div>
          {me && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-skin-gold/10 border border-skin-gold/20">
              <Coins size={12} className="text-gray-300" />
              <span className="font-mono font-bold text-skin-gold text-sm">{me.silver}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Region */}
      <main className="flex-1 overflow-hidden relative bg-skin-fill flex flex-col">

        {/* Two-panel desktop layout */}
        <div className="flex-1 overflow-hidden flex">

          {/* Desktop Sidebar: THE CAST */}
          <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 border-r border-white/[0.06] bg-skin-panel/20">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <h2 className="text-xs font-black text-skin-base uppercase tracking-widest font-display">The Cast</h2>
              <span className="text-[10px] font-mono bg-skin-gold/10 border border-skin-gold/30 rounded-pill px-2 py-0.5 text-skin-gold">
                {aliveCount}
              </span>
            </div>
            <ul className="flex-1 overflow-y-auto p-3 space-y-2">
              {Object.values(roster).map((p: any) => (
                <RosterRow key={p.id} player={p} playerId={playerId} />
              ))}
            </ul>
          </aside>

          {/* Main content column */}
          <div className="flex-1 overflow-hidden flex flex-col">

            {/* Desktop content switcher (replaces footer nav on lg+) */}
            <div className="hidden lg:flex border-b border-white/[0.06] bg-skin-panel/30">
              {([
                { key: 'chat' as const, label: 'Green Room' },
                { key: 'dms' as const, label: 'DMs' },
              ]).map(tab => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors relative
                      ${isActive
                        ? 'text-skin-gold'
                        : 'text-skin-dim opacity-50 hover:opacity-70'
                      }`}
                  >
                    {tab.label}
                    {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-skin-gold shadow-glow" />}
                  </button>
                );
              })}
            </div>

            {/* Voting, Game, Activity & Perk panels (inline with content) */}
            <VotingPanel engine={engine} />
            <GamePanel engine={engine} />
            <GameHistory />
            <PromptPanel engine={engine} />
            <PerkPanel engine={engine} />

            {/* Content area */}
            <div className="flex-1 overflow-hidden relative">
              {activeTab === 'chat' && <ChatRoom engine={engine} />}
              {activeTab === 'dms' && <DirectMessages engine={engine} />}
              {activeTab === 'roster' && (
                <div className="absolute inset-0 overflow-y-auto p-4 scroll-smooth lg:hidden">
                  <div className="space-y-4 max-w-md mx-auto animate-fade-in">
                    <h2 className="text-xl font-black text-skin-base tracking-tighter border-b border-white/10 pb-2 mb-4 font-display">
                      THE CAST
                    </h2>
                    <ul className="space-y-2">
                      {Object.values(roster).map((p: any) => (
                        <RosterRow key={p.id} player={p} playerId={playerId} />
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </main>

      {/* Footer Nav (mobile only) */}
      <footer className="shrink-0 bg-skin-panel/90 backdrop-blur-md border-t border-white/[0.06] pb-safe lg:hidden">
        <nav className="flex items-stretch h-14">
          {([
            { key: 'chat' as const, label: 'Comms', Icon: MessageCircle, accent: 'text-skin-gold', bar: 'bg-skin-gold' },
            { key: 'dms' as const, label: 'DMs', Icon: Mail, accent: 'text-skin-pink', bar: 'bg-skin-pink' },
            { key: 'roster' as const, label: 'Roster', Icon: Users, accent: 'text-skin-gold', bar: 'bg-skin-gold' },
          ]).map(tab => {
            const isActive = activeTab === tab.key;
            const hasBadge = tab.key === 'dms' && !isActive && hasDms;
            return (
              <button
                key={tab.key}
                className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative
                  ${isActive ? tab.accent : 'text-skin-dim opacity-50 hover:opacity-70'}
                `}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="relative">
                  <tab.Icon size={isActive ? 20 : 18} />
                  {hasBadge && <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-skin-pink" />}
                </span>
                <span className={`text-[10px] uppercase tracking-widest ${isActive ? 'font-bold' : ''}`}>{tab.label}</span>
                {isActive && <span className={`absolute top-0 left-0 right-0 h-0.5 ${tab.bar} shadow-glow animate-fade-in`} />}
              </button>
            );
          })}
        </nav>
      </footer>

      {/* News Ticker */}
      <NewsTicker />

      {/* Admin Link (Bottom Right Floating) — links to lobby admin panel */}
      <div className="fixed bottom-24 right-4 z-50">
        <a
          href={`${import.meta.env.VITE_LOBBY_HOST || 'http://localhost:3000'}/admin/game/${gameId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-12 w-12 rounded-full bg-skin-danger text-skin-inverted shadow-glow glow-breathe flex items-center justify-center hover:scale-110 active:scale-95 transition-transform border-2 border-white/20 font-mono font-bold text-lg"
          title="Lobby Admin Panel"
        >
          {'⚙'}
        </a>
      </div>

    </div>
  );
}
