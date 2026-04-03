import { test, expect } from '@playwright/test';
import {
  createTestGame,
  advanceGameState,
  injectTimelineEvent,
  getGameState,
  gotoGame,
  waitForGameShell,
  dismissReveal,
  switchToTodayTab,
  dismissSplash,
} from '../fixtures/game-setup';

test.describe('Voting — Majority Vote & Elimination', () => {
  test('two players vote to eliminate a third player', async ({ browser }) => {
    const game = await createTestGame(3, 2);

    // Advance to activeSession
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    // Open group chat first (so players can see the timeline), then open voting
    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));
    await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
    await new Promise(r => setTimeout(r, 500));

    // Create 3 browser contexts
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const ctx3 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    const page3 = await ctx3.newPage();

    try {
      // All players join
      await gotoGame(page1, game.inviteCode, game.players[0].token);
      await gotoGame(page2, game.inviteCode, game.players[1].token);
      await gotoGame(page3, game.inviteCode, game.players[2].token);
      await waitForGameShell(page1);
      await waitForGameShell(page2);
      await waitForGameShell(page3);

      // Dismiss any phase splash overlays
      await dismissSplash(page1);
      await dismissSplash(page2);

      // Navigate to Today tab and open the fullscreen takeover to access voting
      await switchToTodayTab(page1);
      await page1.getByText('Cast Your Vote').click();
      await page1.waitForTimeout(500);

      await switchToTodayTab(page2);
      await page2.getByText('Cast Your Vote').click();
      await page2.waitForTimeout(500);

      // Both players should see the voting panel inside the takeover
      await expect(page1.locator('[data-testid="voting-panel"]')).toBeVisible({ timeout: 10_000 });
      await expect(page2.locator('[data-testid="voting-panel"]')).toBeVisible({ timeout: 10_000 });

      // Player 1 and Player 2 both vote for Player 3 (p3)
      const target = game.players[2].id; // p3
      await page1.locator(`[data-testid="vote-btn-${target}"]`).click();
      await page1.locator('[data-testid="vote-confirm-btn"]').click();
      await page2.locator(`[data-testid="vote-btn-${target}"]`).click();
      await page2.locator('[data-testid="vote-confirm-btn"]').click();

      // Both voters should see "Vote locked in" confirmation
      await expect(page1.locator('[data-testid="vote-confirmed"]')).toBeVisible({ timeout: 5000 });
      await expect(page2.locator('[data-testid="vote-confirmed"]')).toBeVisible({ timeout: 5000 });

      // Close voting + end day to trigger elimination
      await injectTimelineEvent(game.gameId, 'CLOSE_VOTING');
      await new Promise(r => setTimeout(r, 500));

      // Advance to nightSummary (processes elimination)
      await advanceGameState(game.gameId);
      await new Promise(r => setTimeout(r, 1000));

      // Check game state to verify elimination (p3 = players[2])
      const state = await getGameState(game.gameId);
      expect(state.roster?.[target]?.status).toBe('ELIMINATED');

      // Close takeover if still open, then dismiss elimination reveal
      const closeBtn = page1.getByRole('button', { name: 'Close' });
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click();
        await page1.waitForTimeout(300);
      }
      await dismissReveal(page1);

      // Expand header on player 1's page to check alive count
      await page1.locator('header button').first().click();
      // After elimination, alive count should drop to 2/3
      await expect(page1.locator('[data-testid="alive-count"]')).toContainText('2/3 alive', { timeout: 5000 });
    } finally {
      await ctx1.close();
      await ctx2.close();
      await ctx3.close();
    }
  });
});
