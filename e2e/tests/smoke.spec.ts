import { test, expect } from '@playwright/test';
import { createTestGame, advanceGameState, gotoGame, waitForGameShell } from '../fixtures/game-setup';

test.describe('Smoke — Connect & Verify Sync', () => {
  test('player connects, sees game shell and roster', async ({ page }) => {
    const game = await createTestGame(3, 2);

    // Advance past preGame into activeSession (morningBriefing auto-transitions)
    await advanceGameState(game.gameId);
    await page.waitForTimeout(500);

    // Navigate player 0 to the game
    await gotoGame(page, game.inviteCode, game.players[0].token);
    await waitForGameShell(page);

    // Game shell is rendered
    await expect(page.locator('[data-testid="game-shell"]')).toBeVisible();

    // Expand header to see phase + alive count
    await page.locator('header button').first().click();
    await expect(page.locator('[data-testid="phase-label"]')).toBeVisible();
    await expect(page.locator('[data-testid="alive-count"]')).toContainText('3/3 alive');
  });

  test('phase label shows valid phase name', async ({ page }) => {
    const game = await createTestGame(3, 2);
    await advanceGameState(game.gameId);
    await page.waitForTimeout(500);

    await gotoGame(page, game.inviteCode, game.players[0].token);
    await waitForGameShell(page);

    // Expand header
    await page.locator('header button').first().click();

    // Phase should be one of the known phase labels
    const phaseText = await page.locator('[data-testid="phase-label"]').textContent();
    expect(phaseText).toBeTruthy();
    // Should contain a day number and a phase name
    expect(phaseText).toMatch(/DAY \d+/i);
  });
});
