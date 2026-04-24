import React, { lazy, Suspense, useState, useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { ShellLoader } from './shells/ShellLoader';
import { setActiveShellId, SHELL_REGISTRY } from './shells/registry';
import { decodeGameToken } from '@pecking-order/auth';
import { PushPrompt } from './components/PushPrompt';
import { initSentry, setSentryUser, setSentryPwaContext, setSentryAuthMethod } from './lib/sentry';

initSentry();

const GameDevHarness = lazy(() => import('./components/GameDevHarness'));
const DemoPage = lazy(() => import('./pages/DemoPage'));
const ShowcaseAdminPanel = lazy(() => import('./pages/ShowcaseAdminPanel'));

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
    } catch (err) {
      console.warn('[App] pruneExpiredTokens: invalid token, removing:', key, err);
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
  if (!('caches' in window)) {
    console.log('[App] syncCacheToLocalStorage: Cache API not available');
    return;
  }
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
      } catch (err) {
        console.warn('[App] syncCacheToLocalStorage: invalid cached token, removing:', tokenKey, err);
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
 * Replace the static <link rel="manifest"> with a data: URL manifest.
 * This avoids the browser fetching manifest.webmanifest from the server (which
 * intermittently returns 403 on Cloudflare Pages). Uses `start_url: '/'` so the
 * PWA always launches into the discovery/launcher flow.
 * All URLs must be absolute — data: URLs have no origin to resolve relative paths against.
 */
function updatePwaManifest() {
  const origin = window.location.origin;
  const manifest = {
    name: 'Pecking Order',
    short_name: 'Pecking Order',
    description: 'Keep your friends close...',
    theme_color: '#0f0a1a',
    background_color: '#0f0a1a',
    display: 'standalone',
    scope: `${origin}/`,
    start_url: `${origin}/`,
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
  if (!('caches' in window)) {
    console.log('[App] persistToCache: Cache API not available');
    return;
  }
  caches.open('po-tokens-v1').then(cache =>
    cache.put(
      new Request(`/po-token-cache/po_token_${gameCode}`),
      new Response(jwt),
    )
  ).catch((err) => console.warn('[App] persistToCache: Cache API write failed:', err));
}

/** Try to recover a token from the Cache API (iOS standalone PWA fallback).
 *  Uses caches.open() directly — no dependency on SW being registered or controlling. */
async function recoverFromCacheApi(gameCode: string): Promise<string | null> {
  if (!('caches' in window)) {
    console.log('[App] recoverFromCacheApi: Cache API not available');
    return null;
  }
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
async function refreshFromLobby(
  gameCode: string,
): Promise<{ token: string | null; reason?: string }> {
  try {
    const res = await fetch(`${LOBBY_HOST}/api/refresh-token/${gameCode}`, {
      credentials: 'include', // sends po_session cookie
    });
    if (!res.ok) {
      console.warn('[App] refreshFromLobby: lobby returned', res.status, 'for', gameCode);
      return { token: null, reason: `http_${res.status}` };
    }
    const { token, reason } = await res.json();
    if (token) return { token, reason };
    console.warn('[App] refreshFromLobby: lobby returned 200 but no token for', gameCode);
    return { token: null, reason: reason || 'no_token' };
  } catch (err) {
    console.warn('[App] Lobby token refresh failed:', err);
    return { token: null, reason: 'network_error' };
  }
}

/** Return the freshest locally-cached JWT to use as an identity hint for
 *  the lobby's /enter/CODE recovery endpoint. localStorage and cookie
 *  caches are unified into a single pool ranked by iat — a fresher token
 *  in cookies beats a stale one in localStorage and vice versa. Returns
 *  null if nothing is stored — caller should route to /j/CODE. */
function findAnyJwtHint(): string | null {
  let best: { jwt: string; iat: number } | null = null;
  const consider = (jwt: string | null | undefined) => {
    if (!jwt) return;
    try {
      const decoded = decodeGameToken(jwt);
      const iat = decoded.iat ?? 0;
      if (!best || iat > best.iat) best = { jwt, iat };
    } catch {
      // Malformed — skip.
    }
  };
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('po_token_')) continue;
    consider(localStorage.getItem(key));
  }
  for (const m of document.cookie.matchAll(/po_pwa_([^=]+)=([^;]+)/g)) {
    consider(m[2]);
  }
  return best ? (best as { jwt: string; iat: number }).jwt : null;
}

/** Ask the lobby which games the user is actively in.
 *  Returns the full game list + a Set of uppercased codes for fast lookup.
 *  Returns null if the lobby is unreachable, or if the lobby reports the
 *  visitor is unauthenticated. Both cases must skip downstream token
 *  purges — cached game tokens may still be valid even if the session
 *  cookie expired, and we don't want to evict them on a cold boot. */
async function fetchActiveGames(): Promise<{
  games: Array<{ gameCode: string; personaName: string }>;
  codes: Set<string>;
} | null> {
  try {
    const res = await fetch(`${LOBBY_HOST}/api/my-active-game`, {
      credentials: 'include',
    });
    if (!res.ok) {
      console.log('[App] fetchActiveGames: lobby returned', res.status);
      return null;
    }
    const data = await res.json();
    if (data.reason === 'unauthenticated') {
      // Lobby returned 200+empty for an unauth visitor — don't treat as an
      // authoritative "no games" signal; preserve cached game tokens.
      return null;
    }
    const games: Array<{ gameCode: string; personaName: string }> = data.games || [];
    return { games, codes: new Set(games.map(g => g.gameCode.toUpperCase())) };
  } catch (err) {
    console.warn('[App] fetchActiveGames: lobby unreachable:', err);
    return null;
  }
}

/**
 * Purge all cached auth artifacts (localStorage, cookies, Cache API) for games
 * that are NOT in the active set. Called on every app load when the lobby is reachable.
 */
function purgeInactiveTokens(activeCodes: Set<string>) {
  // localStorage: po_token_*
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('po_token_')) continue;
    const code = key.replace('po_token_', '').toUpperCase();
    if (!activeCodes.has(code)) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // Cookies: po_pwa_*
  const cookieMatches = document.cookie.matchAll(/po_pwa_([^=]+)=/g);
  for (const m of cookieMatches) {
    const code = m[1].toUpperCase();
    if (!activeCodes.has(code)) {
      document.cookie = `po_pwa_${m[1]}=; path=/; max-age=0`;
    }
  }

  // Cache API: po-tokens-v1
  if ('caches' in window) {
    caches.open('po-tokens-v1').then(async cache => {
      const keys = await cache.keys();
      for (const req of keys) {
        const path = new URL(req.url).pathname;
        const tokenKey = path.replace('/po-token-cache/', '').replace('/api/session-cache/', '');
        if (!tokenKey.startsWith('po_token_')) continue;
        const code = tokenKey.replace('po_token_', '').toUpperCase();
        if (!activeCodes.has(code)) cache.delete(req);
      }
    }).catch((err) => console.warn('[App] purgeInactiveTokens: Cache API cleanup failed:', err));
  }
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
  setSentryUser(decoded.playerId, decoded.gameId);

  // Persist in localStorage keyed by game code (survives PWA standalone launches)
  const key = gameCode || decoded.gameId;
  localStorage.setItem(`po_token_${key}`, jwt);

  // Also persist to Cache API for iOS standalone PWA cross-boundary sharing
  persistToCache(key, jwt);

  // Set game-specific cookie (iOS 17.2+ copies cookies from Safari to standalone PWA)
  setPwaAuthCookie(key, jwt);

  // Clean transient params from URL
  if (gameCode) {
    window.history.replaceState({}, '', `/game/${gameCode}`);
  }
}

export default function App() {
  // Capture path and hostname at mount time (before init can change it via replaceState)
  const [initialPath] = useState(() => window.location.pathname);
  const isDemo = initialPath === '/demo' || window.location.hostname.startsWith('demo');
  const [isShowcase] = useState(() => new URLSearchParams(window.location.search).has('showcase'));
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(true); // true until init completes
  const [lobbyGames, setLobbyGames] = useState<Array<{ gameCode: string; personaName: string }>>([]);
  const [archivedGameCode, setArchivedGameCode] = useState<string | null>(null);

  useEffect(() => {
    // Skip auth flow entirely for special pages
    if (isDemo || initialPath === '/dev/games') return;
    init();

    async function init() {
      // Replace <link rel="manifest"> with data: URL to avoid CF Pages 403
      updatePwaManifest();

      // Set PWA context for Sentry diagnostics
      const isStandalone = matchMedia('(display-mode: standalone)').matches || !!(navigator as any).standalone;
      console.log('[App] init: standalone=' + isStandalone + ', pushManager=' + ('PushManager' in window));
      setSentryPwaContext({
        isStandalone,
        hasPushManager: 'PushManager' in window,
        platform: navigator.userAgent,
      });

      // Sync Cache API → localStorage first (iOS standalone PWA needs this)
      await syncCacheToLocalStorage();
      pruneExpiredTokens();

      const params = new URLSearchParams(window.location.search);
      const gameCode = getGameCodeFromPath();
      const transientToken = params.get('_t');
      const rawToken = params.get('token');

      // ── GH-115: Skip cookie recovery after a 4003 rejection ──
      // useGameEngine redirects to /?noRecover=1 after an invalid-token close.
      // Without this, cookie recovery picks up the next stale game and loops.
      const noRecover = params.get('noRecover') === '1';
      if (noRecover) {
        window.history.replaceState({}, '', '/');
      }

      // ── Shell override from URL ──
      // Magic links include ?shell=vivid to force correct shell,
      // overriding any stale localStorage value from old sessions.
      const shellParam = params.get('shell');
      if (shellParam && SHELL_REGISTRY.some(s => s.id === shellParam)) {
        setActiveShellId(shellParam);
      }

      // ── Fast path: authoritative JWT in URL ──
      // Either `?_t=<jwt>` (lobby redirect) or `?token=<jwt>` (debug magic link)
      // — both are freshly minted and trusted. Short-circuits the
      // my-active-game archive check so a valid token isn't evicted by stale
      // lobby session state.
      const urlToken = transientToken || rawToken;
      if (gameCode && urlToken) {
        console.log('[App] init: URL token for', gameCode, transientToken ? '(transient)' : '(raw)');
        try {
          const decoded = decodeGameToken(urlToken);
          if (decoded.exp && decoded.exp < Date.now() / 1000) {
            console.warn('[App] init: URL token expired, redirecting to /');
            window.location.href = '/';
            return;
          }
          applyToken(urlToken, gameCode, setGameId, setPlayerId, setToken);
          setSentryAuthMethod(transientToken ? 'transient' : 'raw-token');
        } catch (err) {
          console.error('[App] init: URL token decode failed:', err);
          window.location.href = '/';
          return;
        }
        setRecovering(false);
        // Fire-and-forget: purge stale tokens for other games in background
        fetchActiveGames().then(result => {
          if (result) purgeInactiveTokens(result.codes);
        });
        return;
      }

      // ── All other paths: ask the lobby which games are active first ──
      // The server is the authority. null = lobby unreachable (offline, no session).
      const active = await fetchActiveGames();
      if (active) {
        purgeInactiveTokens(active.codes);
      }

      if (gameCode) {
        // Visiting /game/CODE without a transient token
        if (active && !active.codes.has(gameCode)) {
          // Server says this game is not active — don't attempt a WebSocket connection.
          console.log('[App] init: game', gameCode, 'not in active games list, showing archived');
          setArchivedGameCode(gameCode);
          if (active.games.length > 0) setLobbyGames(active.games);
          window.history.replaceState({}, '', '/');
          setRecovering(false);
          return;
        }

        // Game is active (or lobby was unreachable — give the cached token a chance)
        const cached = localStorage.getItem(`po_token_${gameCode}`);
        if (cached) {
          console.log('[App] init: found cached token for', gameCode);
          try {
            applyToken(cached, gameCode, setGameId, setPlayerId, setToken);
            setSentryAuthMethod('cached');
            setRecovering(false);
          } catch (err) {
            console.warn('[App] init: cached token invalid for', gameCode, '— starting recovery:', err);
            localStorage.removeItem(`po_token_${gameCode}`);
            await runAsyncRecovery(gameCode);
          }
        } else {
          console.log('[App] init: no cached token for', gameCode, '— starting recovery');
          await runAsyncRecovery(gameCode);
        }
      } else if (rawToken) {
        // Direct JWT entry: ?token=JWT (debug links from lobby)
        try {
          applyToken(rawToken, null, setGameId, setPlayerId, setToken);
          setSentryAuthMethod('raw-token');
        } catch (err) {
          console.error('[App] init: raw token decode failed:', err);
        }
        setRecovering(false);
      } else {
        // No game code in URL — launcher flow
        // Cookie auto-recovery: only navigate if the lobby confirms the game is active
        // Skip entirely if arriving from a 4003 rejection (GH-115)
        const fromCookie = noRecover ? null : recoverGameFromCookies();
        if (fromCookie) {
          const cookieCode = fromCookie.gameCode.toUpperCase();
          if (!active || active.codes.has(cookieCode)) {
            console.log('[App] init: recovering from cookie for', cookieCode);
            try {
              applyToken(fromCookie.jwt, fromCookie.gameCode, setGameId, setPlayerId, setToken);
              setSentryAuthMethod('cookie');
              setRecovering(false);
              return;
            } catch (err) {
              console.error('[App] init: cookie token apply failed for', cookieCode, ':', err);
            }
          } else {
            console.log('[App] init: cookie token for', cookieCode, 'is for an inactive game');
          }
          setArchivedGameCode(cookieCode);
        }

        // Show launcher with active games from lobby
        if (active && active.games.length === 1) {
          window.location.href = `/game/${active.games[0].gameCode}`;
          return;
        }
        if (active && active.games.length > 1) {
          setLobbyGames(active.games);
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
      console.log('[App] runAsyncRecovery: starting for', code);
      try {
        // Step 1: Cookie (iOS 17.2+ copies cookies from Safari to standalone PWA at install)
        const fromCookie = recoverFromCookie(code);
        if (fromCookie) {
          console.log('[App] recovery step 1: recovered from cookie for', code);
          applyToken(fromCookie, code, setGameId, setPlayerId, setToken);
          setSentryAuthMethod('cookie');
          return;
        }
        console.log('[App] recovery step 1: no cookie token for', code);

        // Step 2: Cache API (already synced to localStorage above, but try direct read as fallback)
        const fromCache = await recoverFromCacheApi(code);
        if (fromCache) {
          console.log('[App] recovery step 2: recovered from Cache API for', code);
          applyToken(fromCache, code, setGameId, setPlayerId, setToken);
          setSentryAuthMethod('cache-api');
          return;
        }
        console.log('[App] recovery step 2: no Cache API token for', code);

        // Step 3: Lobby API (mint fresh JWT via po_session cookie)
        const { token: fromLobby, reason: refreshReason } = await refreshFromLobby(code);
        if (fromLobby) {
          console.log('[App] recovery step 3: refreshed from lobby for', code);
          applyToken(fromLobby, code, setGameId, setPlayerId, setToken);
          setSentryAuthMethod('lobby-refresh');
          return;
        }
        console.log('[App] recovery step 3: lobby refresh failed for', code, refreshReason);

        // Step 4: Hand off to lobby's /enter/CODE with any JWT we can find
        // as an identity hint — lobby restores session from sub if the
        // signature is valid (even if expired). POSTed via form to keep
        // the JWT out of URL params, browser history, and access logs.
        // No hint → straight to /j/CODE welcome.
        const hint = findAnyJwtHint();
        console.log(
          '[App] recovery step 4: redirecting to /enter/',
          code,
          hint ? '(with JWT hint)' : '(no hint)',
        );
        setSentryAuthMethod('lobby-recover');
        if (hint) {
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = `${LOBBY_HOST}/enter/${code}`;
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = 'hint';
          input.value = hint;
          form.appendChild(input);
          document.body.appendChild(form);
          form.submit();
        } else {
          window.location.href = `${LOBBY_HOST}/j/${code}`;
        }
      } catch (err) {
        console.error('[App] runAsyncRecovery: unexpected error for', code, ':', err);
        window.location.href = `${LOBBY_HOST}/j/${code}`;
      } finally {
        setRecovering(false);
      }
    }
  }, []);

  if (isDemo) {
    return (
      <Suspense fallback={null}>
        <DemoPage />
      </Suspense>
    );
  }

  if (initialPath === '/dev/games') {
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
    return <div data-testid="launcher-screen"><LauncherScreen lobbyGames={lobbyGames} archivedGameCode={archivedGameCode} /></div>;
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
    <>
      <ShellLoader gameId={gameId} playerId={playerId} token={token} />
      {isShowcase && (
        <Suspense fallback={null}>
          <ShowcaseAdminPanel gameId={gameId} />
        </Suspense>
      )}
    </>
  );
}

/**
 * Launcher screen at `/` — shown when no gameId in URL.
 * Merges locally-cached tokens with lobby-discovered active games.
 */
function LauncherScreen({ lobbyGames, archivedGameCode }: {
  lobbyGames: Array<{ gameCode: string; personaName: string }>;
  archivedGameCode?: string | null;
}) {
  const [codeInput, setCodeInput] = React.useState('');

  // Build game list: lobby-discovered games are authoritative.
  // After purgeInactiveTokens, localStorage only contains active game tokens,
  // so they're safe to display as a fallback when lobby was unreachable.
  const gameMap = new Map<string, { code: string; personaName: string }>();

  // Lobby-discovered games (authoritative — these are confirmed STARTED)
  for (const g of lobbyGames) {
    gameMap.set(g.gameCode.toUpperCase(), { code: g.gameCode, personaName: g.personaName });
  }

  // Locally-cached tokens (only un-purged tokens remain — safe to show)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('po_token_')) {
      const token = localStorage.getItem(key);
      if (token) {
        try {
          const decoded = decodeGameToken(token);
          const code = key.replace('po_token_', '').toUpperCase();
          if (!gameMap.has(code)) {
            gameMap.set(code, { code, personaName: decoded.personaName });
          }
        } catch (err) {
          console.warn('[App] LauncherScreen: skipping unreadable token:', key, err);
        }
      }
    }
  }

  const cachedGames = Array.from(gameMap.values());

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

      {/* Archived game notice */}
      {archivedGameCode && (
        <div className="w-full max-w-sm px-4 py-3 rounded-xl border border-skin-gold/20 bg-skin-gold/5 text-center space-y-1">
          <p className="text-sm text-skin-base font-body">
            The game you were looking for has ended.
          </p>
          <p className="text-[10px] font-mono text-skin-dim/60 uppercase tracking-wider">
            {archivedGameCode}
          </p>
        </div>
      )}

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
            data-testid="game-code-input"
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
            data-testid="game-code-join"
            type="submit"
            disabled={!codeInput.trim()}
            className="px-5 py-3 rounded-xl border border-skin-gold/30 bg-glass text-xs font-mono font-bold text-skin-gold uppercase tracking-widest hover:border-skin-gold/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Join
          </button>
        </div>
      </form>

      {cachedGames.length === 0 && (
        <div className="w-full max-w-sm text-center space-y-2">
          <p className="text-xs text-skin-dim/60 font-body">Played before?</p>
          <a
            href={`${LOBBY_HOST}/login`}
            className="inline-block px-4 py-2 rounded-lg border border-skin-gold/30 bg-glass text-xs font-mono font-bold text-skin-gold uppercase tracking-widest hover:border-skin-gold/60 transition-all"
          >
            Sign in with email
          </a>
        </div>
      )}

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
