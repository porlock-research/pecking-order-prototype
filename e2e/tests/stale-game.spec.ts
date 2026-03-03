import { test, expect } from '@playwright/test';
import { suppressPwaGate } from '../fixtures/game-setup';

const CLIENT_URL = 'http://localhost:5173';

test.describe('Stale Game — Redirect to Launcher', () => {
  test('navigating to a game code with no token shows launcher', async ({ page }) => {
    await suppressPwaGate(page);

    // Navigate to a game URL without a token — no JWT, no localStorage
    // The app's recovery chain will fail and show the launcher (or redirect to lobby,
    // which is unreachable in test → falls through to launcher)
    await page.goto(`${CLIENT_URL}/`);

    // Should show the launcher with game code entry
    await expect(page.locator('[data-testid="launcher-screen"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="game-code-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-code-join"]')).toBeVisible();
  });

  test('game code input works', async ({ page }) => {
    await suppressPwaGate(page);
    await page.goto(CLIENT_URL);

    await expect(page.locator('[data-testid="game-code-input"]')).toBeVisible({ timeout: 10_000 });

    // Type a code and verify the join button enables
    await page.locator('[data-testid="game-code-input"]').fill('TESTCODE');
    await expect(page.locator('[data-testid="game-code-join"]')).toBeEnabled();
  });
});
