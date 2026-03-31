import { type BrowserContext, type Page } from '@playwright/test';
import { signGameToken } from '@pecking-order/auth';

// ── Constants ────────────────────────────────────────────────────────────

const GAME_SERVER = process.env.GAME_SERVER || 'http://localhost:8787';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';

const PERSONA_NAMES = ['Viper', 'Phoenix', 'Shadow', 'Ember', 'Raven', 'Storm', 'Nyx', 'Blaze'];

// ── Types ────────────────────────────────────────────────────────────────

interface TestPlayer {
  id: string;        // "p1", "p2", etc. (1-indexed, matches lobby convention)
  token: string;     // signed JWT
  personaName: string;
  realUserId: string;
}

interface TestGame {
  gameId: string;
  inviteCode: string;
  players: TestPlayer[];
}

// ── Helpers ──────────────────────────────────────────────────────────────

function makeGameId(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeInviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Build a minimal manifest for E2E testing.
 * Uses MAJORITY voting (simplest path) and NONE for games.
 * Timeline events are empty — we advance via admin API.
 */
function buildManifest(gameId: string, dayCount: number) {
  const days = [];
  for (let i = 0; i < dayCount; i++) {
    const isLast = i === dayCount - 1;
    days.push({
      dayIndex: i + 1,
      theme: `Day ${i + 1}`,
      voteType: isLast ? 'FINALS' : 'MAJORITY',
      gameType: 'NONE',
      timeline: [], // no scheduled events — we drive everything via NEXT_STAGE
    });
  }
  return {
    kind: 'STATIC' as const,
    id: gameId,
    gameMode: 'CONFIGURABLE_CYCLE' as const, // legacy compat
    scheduling: 'ADMIN' as const, // admin-driven, no timeline events
    days,
  };
}

/**
 * Build a roster of N players.
 * Uses 1-indexed IDs (p1, p2, ...) to match lobby convention.
 */
function buildRoster(playerCount: number) {
  const roster: Record<string, any> = {};
  for (let i = 0; i < playerCount; i++) {
    const id = `p${i + 1}`;
    roster[id] = {
      realUserId: `e2e-user-${id}`,
      personaName: PERSONA_NAMES[i] || `Player${i + 1}`,
      avatarUrl: '',
      bio: `E2E test player ${i + 1}`,
      isAlive: true,
      isSpectator: false,
      silver: 50,
      gold: 0,
      destinyId: '',
    };
  }
  return roster;
}

// ── API Functions ────────────────────────────────────────────────────────

/**
 * Create a test game by POSTing directly to the game server.
 * Returns game info + signed JWT tokens for each player.
 */
export async function createTestGame(playerCount = 3, dayCount = 2): Promise<TestGame> {
  const gameId = makeGameId();
  const inviteCode = makeInviteCode();
  const roster = buildRoster(playerCount);
  const manifest = buildManifest(gameId, dayCount);

  // POST /init to create the game
  const res = await fetch(`${GAME_SERVER}/parties/game-server/${gameId}/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_SECRET}`,
    },
    body: JSON.stringify({ roster, manifest, inviteCode }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create test game: ${res.status} ${text}`);
  }

  // Sign JWTs for each player (1-indexed to match lobby convention)
  const players: TestPlayer[] = [];
  for (let i = 0; i < playerCount; i++) {
    const id = `p${i + 1}`;
    const token = await signGameToken(
      {
        sub: `e2e-user-${id}`,
        gameId,
        playerId: id,
        personaName: roster[id].personaName,
      },
      AUTH_SECRET,
    );
    players.push({
      id,
      token,
      personaName: roster[id].personaName,
      realUserId: `e2e-user-${id}`,
    });
  }

  return { gameId, inviteCode, players };
}

/**
 * Advance game state by sending NEXT_STAGE to the admin API.
 */
export async function advanceGameState(gameId: string): Promise<void> {
  const res = await fetch(`${GAME_SERVER}/parties/game-server/${gameId}/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_SECRET}`,
    },
    body: JSON.stringify({ type: 'NEXT_STAGE' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NEXT_STAGE failed: ${res.status} ${text}`);
  }
}

/**
 * Inject a timeline event via admin API.
 */
export async function injectTimelineEvent(
  gameId: string,
  action: string,
  payload?: Record<string, any>,
): Promise<void> {
  const res = await fetch(`${GAME_SERVER}/parties/game-server/${gameId}/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_SECRET}`,
    },
    body: JSON.stringify({ type: 'INJECT_TIMELINE_EVENT', action, payload }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`INJECT_TIMELINE_EVENT failed: ${res.status} ${text}`);
  }
}

/**
 * Get current game state from the game server.
 */
export async function getGameState(gameId: string): Promise<any> {
  const res = await fetch(`${GAME_SERVER}/parties/game-server/${gameId}/state`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET /state failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Clean up a game's D1 data and DO storage.
 */
export async function cleanupGame(gameId: string): Promise<void> {
  const res = await fetch(`${GAME_SERVER}/parties/game-server/${gameId}/cleanup`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${AUTH_SECRET}` },
  });
  // Ignore errors — cleanup is best-effort
  if (!res.ok) {
    console.warn(`Cleanup failed for ${gameId}: ${res.status}`);
  }
}

// ── Page Helpers ─────────────────────────────────────────────────────────

/**
 * Suppress the PwaGate overlay (push notification / install prompt) that
 * blocks pointer events in headless browsers. Must be called before goto().
 */
export async function suppressPwaGate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.setItem('po_gate_deferred', '1');
  });
}

/**
 * Navigate a page to the game client with a player's JWT token.
 * Automatically suppresses the PwaGate overlay.
 */
export async function gotoGame(page: Page, inviteCode: string, token: string): Promise<void> {
  await suppressPwaGate(page);
  await page.goto(`${CLIENT_URL}/game/${inviteCode}?_t=${token}`);
}

/**
 * Raw game URL (use gotoGame instead for most cases).
 */
export function gameUrl(inviteCode: string, token: string): string {
  return `${CLIENT_URL}/game/${inviteCode}?_t=${token}`;
}

/**
 * Wait for the game shell to render (WebSocket connected + initial SYNC received).
 */
export async function waitForGameShell(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForSelector('[data-testid="game-shell"]', { timeout });
}

/**
 * Dismiss any DramaticReveal overlay (elimination / winner) if present.
 */
export async function dismissReveal(page: Page): Promise<void> {
  const reveal = page.getByText('Tap to dismiss');
  if (await reveal.isVisible({ timeout: 2000 }).catch(() => false)) {
    await reveal.click();
    // Wait for the overlay to animate out
    await page.waitForTimeout(500);
  }
}

/**
 * Wait for a specific phase label to appear in the header.
 */
export async function waitForPhase(page: Page, phaseText: string, timeout = 15_000): Promise<void> {
  await page.waitForSelector(`[data-testid="phase-label"]:has-text("${phaseText}")`, { timeout });
}

/**
 * Click the Today tab and wait for it to settle.
 */
export async function switchToTodayTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Today' }).click();
  await page.waitForTimeout(300);
}

/**
 * Dismiss any phase transition splash overlay if present.
 */
export async function dismissSplash(page: Page): Promise<void> {
  const splash = page.getByText('Tap anywhere to continue');
  if (await splash.isVisible({ timeout: 2000 }).catch(() => false)) {
    await splash.click();
    await page.waitForTimeout(500);
  }
}
