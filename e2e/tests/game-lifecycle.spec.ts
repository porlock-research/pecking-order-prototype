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

test.describe('Game Lifecycle — Full Multi-Day Game', () => {
  test('3-player game: Day 1 elimination, Day 2 finals, winner declared', async ({ browser }) => {
    test.setTimeout(90_000);

    // 3 players, 2 days (Day 1 = MAJORITY, Day 2 = FINALS)
    const game = await createTestGame(3, 2);

    // ── Day 0 → Day 1 ──
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    // Open group chat + voting for Day 1
    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));
    await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
    await new Promise(r => setTimeout(r, 500));

    // Connect 3 players
    const ctx0 = await browser.newContext();
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page0 = await ctx0.newPage();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      await gotoGame(page0, game.inviteCode, game.players[0].token);
      await gotoGame(page1, game.inviteCode, game.players[1].token);
      await gotoGame(page2, game.inviteCode, game.players[2].token);
      await waitForGameShell(page0);
      await waitForGameShell(page1);
      await waitForGameShell(page2);
      await dismissSplash(page0);
      await dismissSplash(page1);

      // ── Day 1: Vote to eliminate p3 (players[2]) ──
      const eliminationTarget = game.players[2].id; // p3

      // Navigate to Today tab and open the fullscreen takeover to access voting
      await switchToTodayTab(page0);
      await page0.getByText('Cast Your Vote').click();
      await page0.waitForTimeout(500);
      await expect(page0.locator('[data-testid="voting-panel"]')).toBeVisible({ timeout: 10_000 });

      await switchToTodayTab(page1);
      await page1.getByText('Cast Your Vote').click();
      await page1.waitForTimeout(500);

      // p1 and p2 vote for p3
      await page0.locator(`[data-testid="vote-btn-${eliminationTarget}"]`).click();
      await page0.locator('[data-testid="vote-confirm-btn"]').click();
      await page1.locator(`[data-testid="vote-btn-${eliminationTarget}"]`).click();
      await page1.locator('[data-testid="vote-confirm-btn"]').click();
      await expect(page0.locator('[data-testid="vote-confirmed"]')).toBeVisible();

      // Close voting + advance to nightSummary
      await injectTimelineEvent(game.gameId, 'CLOSE_VOTING');
      await new Promise(r => setTimeout(r, 500));
      await advanceGameState(game.gameId); // activeSession → nightSummary
      await new Promise(r => setTimeout(r, 1000));

      // Verify p3 eliminated in game state
      let state = await getGameState(game.gameId);
      expect(state.roster?.[eliminationTarget]?.status).toBe('ELIMINATED');

      // Close takeovers if still open, then dismiss elimination reveals on all pages
      for (const pg of [page0, page1, page2]) {
        const closeBtn = pg.getByRole('button', { name: 'Close' });
        if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await closeBtn.click();
          await pg.waitForTimeout(300);
        }
        await dismissReveal(pg);
      }

      // ── Transition to Day 2 (FINALS) ──
      await advanceGameState(game.gameId);
      await new Promise(r => setTimeout(r, 500));

      // Open group chat + voting for Day 2 (FINALS)
      await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
      await new Promise(r => setTimeout(r, 300));
      await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
      await new Promise(r => setTimeout(r, 500));

      // ── Day 2: FINALS vote ──
      // In FINALS, eliminated players (p3) vote for an alive candidate.
      // p3 should see the voting panel with vote buttons for alive players.
      await dismissSplash(page2);
      await switchToTodayTab(page2);
      await page2.getByText('Cast Your Vote').click();
      await page2.waitForTimeout(500);
      await expect(page2.locator('[data-testid="voting-panel"]')).toBeVisible({ timeout: 10_000 });
      const finalsTarget = game.players[0].id; // p1
      await page2.locator(`[data-testid="vote-btn-${finalsTarget}"]`).click();
      await page2.locator('[data-testid="vote-confirm-btn"]').click();
      await expect(page2.locator('[data-testid="vote-confirmed"]')).toBeVisible({ timeout: 5000 });

      // Close voting + end day
      await injectTimelineEvent(game.gameId, 'CLOSE_VOTING');
      await new Promise(r => setTimeout(r, 500));
      await advanceGameState(game.gameId);
      await new Promise(r => setTimeout(r, 1000));

      // Should be in gameSummary or gameOver
      state = await getGameState(game.gameId);
      const stateStr = JSON.stringify(state.state);
      const isEndGame = stateStr.includes('gameSummary') || stateStr.includes('gameOver');
      expect(isEndGame).toBe(true);

      // ── Advance to gameOver ──
      await advanceGameState(game.gameId);
      await new Promise(r => setTimeout(r, 500));

      state = await getGameState(game.gameId);
      expect(JSON.stringify(state.state)).toContain('gameOver');
    } finally {
      await ctx0.close();
      await ctx1.close();
      await ctx2.close();
    }
  });
});
