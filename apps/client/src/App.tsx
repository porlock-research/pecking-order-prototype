import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { ShellLoader } from './shells/ShellLoader';
import { decodeGameToken } from '@pecking-order/auth';
import { PushPrompt } from './components/PushPrompt';

const GameDevHarness = lazy(() => import('./components/GameDevHarness'));

/** Remove expired po_token_* entries from localStorage on startup. */
function pruneExpiredTokens() {
  const now = Math.floor(Date.now() / 1000);
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('po_token_')) continue;
    try {
      const decoded = decodeGameToken(localStorage.getItem(key)!);
      if (decoded.exp && decoded.exp < now) keysToRemove.push(key);
    } catch {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

/**
 * Extracts a game code from the URL path (e.g. /game/X7K2MP → X7K2MP)
 */
function getGameCodeFromPath(): string | null {
  const match = window.location.pathname.match(/^\/game\/([A-Za-z0-9]+)\/?$/);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Applies a JWT token: decodes it, sets state, and stores in localStorage.
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

  // Persist in localStorage keyed by game code (survives PWA standalone launches)
  const key = gameCode || decoded.gameId;
  localStorage.setItem(`po_token_${key}`, jwt);

  // Clean transient params from URL
  if (gameCode) {
    window.history.replaceState({}, '', `/game/${gameCode}`);
  }
}

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    pruneExpiredTokens();
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
      // Clean URL visit: /game/CODE — check localStorage
      const cached = localStorage.getItem(`po_token_${gameCode}`);
      if (cached) {
        try {
          applyToken(cached, gameCode, setGameId, setPlayerId, setToken);
        } catch {
          localStorage.removeItem(`po_token_${gameCode}`);
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
    <ShellLoader gameId={gameId} playerId={playerId} token={token} />
  );
}

/**
 * Launcher screen at `/` — shown when no gameId in URL.
 * Scans localStorage for cached game tokens and lists them.
 */
function LauncherScreen() {
  const cachedGames: Array<{ code: string; personaName: string; gameId: string }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('po_token_')) {
      const token = localStorage.getItem(key);
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
