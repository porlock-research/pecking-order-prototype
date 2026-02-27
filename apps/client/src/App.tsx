import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { ShellLoader } from './shells/ShellLoader';
import { decodeGameToken } from '@pecking-order/auth';
import { PushPrompt } from './components/PushPrompt';

const GameDevHarness = lazy(() => import('./components/GameDevHarness'));

const LOBBY_HOST = import.meta.env.VITE_LOBBY_HOST || 'http://localhost:3000';

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

/** Sync tokens from Cache API into localStorage.
 *  On older iOS, Cache API may be shared between Safari and standalone PWA.
 *  On modern iOS (17+), storage is fully partitioned — this only helps within
 *  the same browsing context (e.g. recovering from a cleared localStorage). */
async function syncCacheToLocalStorage(): Promise<void> {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open('po-tokens-v1');
    const keys = await cache.keys();
    const now = Math.floor(Date.now() / 1000);
    for (const req of keys) {
      const path = new URL(req.url).pathname;
      // Support both old prefix (/api/session-cache/) and new (/po-token-cache/)
      const tokenKey = path.replace('/po-token-cache/', '').replace('/api/session-cache/', '');
      if (!tokenKey.startsWith('po_token_')) continue;
      // Skip if already in localStorage
      if (localStorage.getItem(tokenKey)) continue;
      const res = await cache.match(req);
      if (!res) continue;
      const jwt = await res.text();
      try {
        const decoded = decodeGameToken(jwt);
        if (decoded.exp && decoded.exp > now) {
          localStorage.setItem(tokenKey, jwt);
        } else {
          // Expired — clean up from cache too
          cache.delete(req);
        }
      } catch {
        cache.delete(req);
      }
    }
  } catch (err) {
    console.warn('[App] Cache-to-localStorage sync failed:', err);
  }
}

/**
 * Extracts a game code from the URL path (e.g. /game/X7K2MP → X7K2MP)
 */
function getGameCodeFromPath(): string | null {
  const match = window.location.pathname.match(/^\/game\/([A-Za-z0-9]+)\/?$/);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Dynamically update the <link rel="manifest"> with a start_url that embeds the JWT.
 * When the user taps "Add to Home Screen" on iOS, the manifest is read at that instant —
 * so the standalone PWA will launch pre-authenticated at /game/CODE?_t=JWT.
 * Uses a data: URL (not blob:) because iOS reliably reads data URLs during install.
 * All URLs must be absolute — data: URLs have no origin to resolve relative paths against.
 */
function updatePwaManifest(gameCode: string, jwt: string) {
  const origin = window.location.origin;
  const manifest = {
    name: 'Pecking Order',
    short_name: 'Pecking Order',
    description: 'Keep your friends close...',
    theme_color: '#0f0a1a',
    background_color: '#0f0a1a',
    display: 'standalone',
    scope: `${origin}/`,
    start_url: `${origin}/game/${gameCode}?_t=${jwt}`,
    icons: [
      { src: `${origin}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${origin}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${origin}/icons/icon-512-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  const encoded = encodeURIComponent(JSON.stringify(manifest));
  const href = `data:application/json;charset=utf-8,${encoded}`;
  let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (link) {
    link.setAttribute('href', href);
  } else {
    link = document.createElement('link');
    link.rel = 'manifest';
    link.href = href;
    document.head.appendChild(link);
  }
}

/**
 * Set a game-specific auth cookie. iOS 17.2+ copies cookies from Safari to standalone
 * PWA at install time (one-time copy), providing a secondary auth recovery path.
 */
function setPwaAuthCookie(gameCode: string, jwt: string) {
  const decoded = decodeGameToken(jwt);
  const maxAge = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 30 * 24 * 60 * 60;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `po_pwa_${gameCode}=${jwt}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

/** Try to recover a token from a game-specific cookie (iOS 17.2+ Safari→PWA cookie copy). */
function recoverFromCookie(gameCode: string): string | null {
  const match = document.cookie.match(new RegExp(`po_pwa_${gameCode}=([^;]+)`));
  if (!match) return null;
  try {
    const jwt = match[1];
    const decoded = decodeGameToken(jwt);
    if (decoded.exp && decoded.exp > Date.now() / 1000) return jwt;
  } catch (err) {
    console.warn('[App] Cookie token decode failed:', err);
  }
  return null;
}

/** Scan all po_pwa_* cookies for a valid game token. Used at `/` (no game code in URL)
 *  to auto-navigate into a game when the cookie bridge carried a token from Safari. */
function recoverGameFromCookies(): { gameCode: string; jwt: string } | null {
  const matches = document.cookie.matchAll(/po_pwa_([^=]+)=([^;]+)/g);
  const now = Date.now() / 1000;
  for (const m of matches) {
    try {
      const jwt = m[2];
      const decoded = decodeGameToken(jwt);
      if (decoded.exp && decoded.exp > now) {
        return { gameCode: m[1], jwt };
      }
    } catch (err) {
      console.warn('[App] Cookie scan token decode failed:', err);
    }
  }
  return null;
}

/** Persist a token to Cache API (shared between Safari and standalone PWA on iOS).
 *  Uses caches.open() directly — no dependency on SW being registered or controlling. */
function persistToCache(gameCode: string, jwt: string) {
  if (!('caches' in window)) return;
  caches.open('po-tokens-v1').then(cache =>
    cache.put(
      new Request(`/po-token-cache/po_token_${gameCode}`),
      new Response(jwt),
    )
  ).catch(() => {}); // fire-and-forget
}

/** Try to recover a token from the Cache API (iOS standalone PWA fallback).
 *  Uses caches.open() directly — no dependency on SW being registered or controlling. */
async function recoverFromCacheApi(gameCode: string): Promise<string | null> {
  if (!('caches' in window)) return null;
  try {
    const cache = await caches.open('po-tokens-v1');
    const res = await cache.match(new Request(`/po-token-cache/po_token_${gameCode}`));
    if (!res) return null;
    const jwt = await res.text();
    if (jwt) {
      const decoded = decodeGameToken(jwt);
      if (decoded.exp && decoded.exp > Date.now() / 1000) {
        localStorage.setItem(`po_token_${gameCode}`, jwt); // restore to localStorage
        return jwt;
      }
    }
  } catch (err) {
    console.warn('[App] Cache API token recovery failed:', err);
  }
  return null;
}

/** Try to mint a fresh JWT via the lobby's refresh-token API (requires po_session cookie). */
async function refreshFromLobby(gameCode: string): Promise<string | null> {
  try {
    const res = await fetch(`${LOBBY_HOST}/api/refresh-token/${gameCode}`, {
      credentials: 'include', // sends po_session cookie
    });
    if (!res.ok) return null;
    const { token } = await res.json();
    if (token) return token;
  } catch (err) {
    console.warn('[App] Lobby token refresh failed:', err);
  }
  return null;
}

/**
 * Applies a JWT token: decodes it, sets state, stores in localStorage + Cache API.
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

  // Also persist to Cache API for iOS standalone PWA cross-boundary sharing
  persistToCache(key, jwt);

  // Update manifest start_url so "Add to Home Screen" installs a pre-authenticated PWA
  updatePwaManifest(key, jwt);

  // Set game-specific cookie (iOS 17.2+ copies cookies from Safari to standalone PWA)
  setPwaAuthCookie(key, jwt);

  // Clean transient params from URL
  if (gameCode) {
    window.history.replaceState({}, '', `/game/${gameCode}`);
  }
}

export default function App() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(true); // true until init completes

  useEffect(() => {
    init();

    async function init() {
      // Sync Cache API → localStorage first (iOS standalone PWA needs this)
      await syncCacheToLocalStorage();
      pruneExpiredTokens();

      const params = new URLSearchParams(window.location.search);
      const gameCode = getGameCodeFromPath();
      const transientToken = params.get('_t');
      const rawToken = params.get('token');

      if (gameCode && transientToken) {
        // Arrived via lobby redirect or PWA start_url: /game/CODE?_t=JWT
        try {
          const decoded = decodeGameToken(transientToken);
          if (decoded.exp && decoded.exp < Date.now() / 1000) {
            // Expired start_url token (PWA installed for an old game) — show launcher
          } else {
            applyToken(transientToken, gameCode, setGameId, setPlayerId, setToken);
          }
        } catch {
          console.error('Invalid token from redirect');
        }
        setRecovering(false);
      } else if (gameCode) {
        // Clean URL visit: /game/CODE — walk the recovery chain
        const cached = localStorage.getItem(`po_token_${gameCode}`);
        if (cached) {
          // Step 1: localStorage hit (may include tokens synced from Cache API above)
          try {
            applyToken(cached, gameCode, setGameId, setPlayerId, setToken);
            setRecovering(false);
          } catch {
            localStorage.removeItem(`po_token_${gameCode}`);
            console.error('Cached token invalid');
            await runAsyncRecovery(gameCode);
          }
        } else {
          // Steps 2-4: async recovery chain
          await runAsyncRecovery(gameCode);
        }
      } else if (rawToken) {
        // Direct JWT entry: ?token=JWT (debug links from lobby)
        try {
          applyToken(rawToken, null, setGameId, setPlayerId, setToken);
        } catch {
          console.error('Invalid token');
        }
        setRecovering(false);
      } else {
        // No game code in URL — check cookies for a token carried from Safari (PWA install)
        const fromCookie = recoverGameFromCookies();
        if (fromCookie) {
          applyToken(fromCookie.jwt, fromCookie.gameCode, setGameId, setPlayerId, setToken);
          setRecovering(false);
          return;
        }

        // Legacy: plain query param entry (backward compat for debug)
        const gid = params.get('gameId');
        const pid = params.get('playerId') || 'p1';
        setGameId(gid);
        setPlayerId(pid);
        if (pid) {
          useGameStore.getState().setPlayerId(pid);
        }
        setRecovering(false);
      }
    }

    async function runAsyncRecovery(code: string) {
      try {
        // Step 2: Cookie (iOS 17.2+ copies cookies from Safari to standalone PWA at install)
        const fromCookie = recoverFromCookie(code);
        if (fromCookie) {
          applyToken(fromCookie, code, setGameId, setPlayerId, setToken);
          return;
        }

        // Step 3: Cache API (already synced to localStorage above, but try direct read as fallback)
        const fromCache = await recoverFromCacheApi(code);
        if (fromCache) {
          applyToken(fromCache, code, setGameId, setPlayerId, setToken);
          return;
        }

        // Step 4: Lobby API (mint fresh JWT via po_session cookie — browser only, not standalone)
        const fromLobby = await refreshFromLobby(code);
        if (fromLobby) {
          applyToken(fromLobby, code, setGameId, setPlayerId, setToken);
          return;
        }

        // Step 5: Redirect to lobby (last resort — user may need to log in)
        window.location.href = `${LOBBY_HOST}/play/${code}`;
      } catch {
        window.location.href = `${LOBBY_HOST}/play/${code}`;
      } finally {
        setRecovering(false);
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
    if (recovering) {
      return (
        <div className="min-h-screen bg-gradient-velvet flex flex-col items-center justify-center gap-3">
          <span className="w-6 h-6 border-2 border-skin-gold border-t-transparent rounded-full spin-slow" />
          <span className="text-skin-gold font-mono animate-shimmer uppercase tracking-widest text-sm">
            RESTORING_SESSION...
          </span>
        </div>
      );
    }
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
  const [codeInput, setCodeInput] = React.useState('');
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

  function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (code) {
      window.location.href = `/game/${code}`;
    }
  }

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

      {/* Game list */}
      {cachedGames.length > 0 && (
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
      )}

      {/* Game code entry — primary recovery path for iOS standalone PWA where
          localStorage and Cache API are sandboxed from Safari */}
      <form onSubmit={handleJoinByCode} className="w-full max-w-sm space-y-3">
        {cachedGames.length === 0 && (
          <p className="text-sm font-mono text-skin-dim/50 uppercase tracking-widest">
            No active games
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Game code"
            className="flex-1 px-4 py-3 rounded-xl border border-white/[0.06] bg-glass text-skin-base font-mono text-sm uppercase tracking-wider placeholder:text-skin-dim/30 focus:outline-none focus:border-skin-gold/40 transition-colors"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={!codeInput.trim()}
            className="px-5 py-3 rounded-xl border border-skin-gold/30 bg-glass text-xs font-mono font-bold text-skin-gold uppercase tracking-widest hover:border-skin-gold/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Join
          </button>
        </div>
      </form>

      {/* Lobby link */}
      <a
        href={LOBBY_HOST}
        className="inline-block text-xs font-mono text-skin-gold/70 hover:text-skin-gold underline underline-offset-4 uppercase tracking-widest transition-colors"
      >
        Join from the lobby
      </a>
    </div>
  );
}
