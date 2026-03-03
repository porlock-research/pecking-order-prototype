import { test, expect } from '@playwright/test';
import { signGameToken } from '@pecking-order/auth';
import { suppressPwaGate } from '../fixtures/game-setup';

const CLIENT_URL = 'http://localhost:5173';
const AUTH_SECRET = 'dev-secret-change-me';

test.describe('Stale Game — Redirect to Launcher', () => {
  test('navigating to a game code with no token shows launcher', async ({ page }) => {
    await suppressPwaGate(page);
    await page.goto(`${CLIENT_URL}/`);

    await expect(page.locator('[data-testid="launcher-screen"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="game-code-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-code-join"]')).toBeVisible();
  });

  test('game code input works', async ({ page }) => {
    await suppressPwaGate(page);
    await page.goto(CLIENT_URL);

    await expect(page.locator('[data-testid="game-code-input"]')).toBeVisible({ timeout: 10_000 });

    await page.locator('[data-testid="game-code-input"]').fill('TESTCODE');
    await expect(page.locator('[data-testid="game-code-join"]')).toBeEnabled();
  });

  test('stale game token redirects to launcher without infinite loop', async ({ page }) => {
    // Mint a valid (non-expired) JWT for a game that doesn't exist on the server.
    // This simulates visiting a game that was completed and archived — the token
    // in localStorage/cookie is still valid but the DO is empty.
    const gameCode = 'STALE1';
    const fakeGameId = 'nonexistent-game-id';
    const jwt = await signGameToken(
      { sub: 'e2e-stale-user', gameId: fakeGameId, playerId: 'p0', personaName: 'Ghost' },
      AUTH_SECRET,
    );

    await suppressPwaGate(page);

    // Pre-seed localStorage and cookie with the stale token
    await page.addInitScript(({ code, token }) => {
      localStorage.setItem(`po_token_${code}`, token);
      document.cookie = `po_pwa_${code}=${token}; path=/`;
    }, { code: gameCode, token: jwt });

    // Visit the stale game URL.
    // In E2E, the lobby is unreachable (no po_session) so fetchActiveGames() returns null.
    // The client falls through to trying the cached token → 4001 → redirect to launcher.
    // In production, the lobby IS reachable and purges the token before connection.
    await page.goto(`${CLIENT_URL}/game/${gameCode}`);

    // Should land on the launcher — NOT infinite loop
    await expect(page.locator('[data-testid="launcher-screen"]')).toBeVisible({ timeout: 15_000 });
  });
});
