import { test, expect } from '@playwright/test';
import {
  createTestGame,
  advanceGameState,
  injectTimelineEvent,
  getGameState,
  gotoGame,
  waitForGameShell,
  dismissReveal,
} from '../fixtures/game-setup';

test.describe('Game Lifecycle — Full Multi-Day Game', () => {
  // This test drives a full 2-day game — give it extra time
  test('3-player game: Day 1 elimination, Day 2 finals, winner declared', async ({ browser }) => {
    test.setTimeout(90_000);

    // 3 players, 2 days (Day 1 = MAJORITY, Day 2 = FINALS)
    const game = await createTestGame(3, 2);

    // ── Day 0 → Day 1 ──
    // Advance from preGame to dayLoop (morningBriefing → activeSession)
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

      // ── Day 1: Vote to eliminate p2 ──
      await expect(page0.locator('[data-testid="voting-panel"]')).toBeVisible({ timeout: 10_000 });

      // p0 and p1 vote for p2
      await page0.locator('[data-testid="vote-btn-p2"]').click();
      await page1.locator('[data-testid="vote-btn-p2"]').click();
      await expect(page0.locator('[data-testid="vote-confirmed"]')).toBeVisible();

      // Close voting + advance to nightSummary
      await injectTimelineEvent(game.gameId, 'CLOSE_VOTING');
      await new Promise(r => setTimeout(r, 500));
      await advanceGameState(game.gameId); // activeSession → nightSummary
      await new Promise(r => setTimeout(r, 1000));

      // Verify p2 eliminated in game state
      let state = await getGameState(game.gameId);
      expect(state.roster?.p2?.status).toBe('ELIMINATED');

      // Dismiss elimination reveals on all pages before continuing
      await dismissReveal(page0);
      await dismissReveal(page1);
      await dismissReveal(page2);

      // ── Transition to Day 2 (FINALS) ──
      await advanceGameState(game.gameId); // nightSummary → morningBriefing → activeSession
      await new Promise(r => setTimeout(r, 500));

      // Open group chat + voting for Day 2 (FINALS)
      await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
      await new Promise(r => setTimeout(r, 300));
      await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
      await new Promise(r => setTimeout(r, 500));

      // ── Day 2: FINALS vote ──
      // In FINALS, eliminated players (p2) vote for an alive candidate
      // p2 votes for p0 as the winner
      await expect(page2.locator('[data-testid="voting-panel"]')).toBeVisible({ timeout: 10_000 });
      await page2.locator('[data-testid="vote-btn-p0"]').click();

      // Close voting + end day
      await injectTimelineEvent(game.gameId, 'CLOSE_VOTING');
      await new Promise(r => setTimeout(r, 500));
      await advanceGameState(game.gameId); // activeSession → nightSummary
      await new Promise(r => setTimeout(r, 1000));

      // nightSummary should auto-transition to gameSummary since FINALS sets winner
      state = await getGameState(game.gameId);
      // The game should be in gameSummary or gameOver
      const stateStr = JSON.stringify(state.state);
      const isEndGame = stateStr.includes('gameSummary') || stateStr.includes('gameOver');
      expect(isEndGame).toBe(true);

      // ── Advance to gameOver ──
      await advanceGameState(game.gameId); // gameSummary → gameOver
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
