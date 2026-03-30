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

test.describe('Today Tab', () => {
  test('Today tab shows tab with correct label', async ({ browser }) => {
    const game = await createTestGame(3, 1);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      // Tab bar should have "Today" button, not "Schedule"
      await expect(page.getByRole('button', { name: 'Today' })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: 'Schedule' })).not.toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('Today tab shows empty state when no cartridges active', async ({ browser }) => {
    const game = await createTestGame(3, 1);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      await switchToTodayTab(page);

      // Verify day header is present
      await expect(page.getByText(/Day 1.*Today/)).toBeVisible({ timeout: 5000 });

      // Verify empty or zero activities text
      await expect(
        page.getByText(/0 activit|No activit/)
      ).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('Live voting card appears on Today tab', async ({ browser }) => {
    const game = await createTestGame(3, 1);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));
    await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
    await new Promise(r => setTimeout(r, 500));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      await switchToTodayTab(page);

      // Should see "LIVE" badge on the card
      await expect(page.getByText('LIVE')).toBeVisible({ timeout: 5000 });

      // Should see "Cast Your Vote" CTA button
      await expect(page.getByText('Cast Your Vote')).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('Fullscreen takeover opens from live card CTA', async ({ browser }) => {
    const game = await createTestGame(3, 1);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));
    await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
    await new Promise(r => setTimeout(r, 500));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      await switchToTodayTab(page);

      // Click the CTA
      await page.getByText('Cast Your Vote').click();
      await page.waitForTimeout(500);

      // Fullscreen takeover should open with Close button and voting UI
      await expect(page.getByRole('button', { name: 'Close' })).toBeVisible({ timeout: 5000 });
      await expect(page.locator('[data-testid="voting-panel"]')).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('Vote can be cast inside fullscreen takeover', async ({ browser }) => {
    const game = await createTestGame(3, 1);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));
    await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
    await new Promise(r => setTimeout(r, 500));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      await switchToTodayTab(page);
      await page.getByText('Cast Your Vote').click();
      await page.waitForTimeout(500);

      // Vote for player 3 (p3 — players[2])
      const target = game.players[2].id;
      await page.locator(`[data-testid="vote-btn-${target}"]`).click();

      // Confirm the vote (click the confirm button in AvatarPicker)
      await page.locator('[data-testid="vote-confirm-btn"]').click();
      await page.waitForTimeout(500);

      // Should see "Vote locked in" confirmation
      await expect(page.locator('[data-testid="vote-confirmed"]')).toBeVisible({ timeout: 5000 });

      // Close the takeover
      await page.getByRole('button', { name: 'Close' }).click();
      await page.waitForTimeout(500);

      // Today tab should still show the live card
      await expect(page.getByText('LIVE')).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('Result hold -- completed voting card persists after CLOSE_VOTING', async ({ browser }) => {
    const game = await createTestGame(3, 1);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));
    await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
    await new Promise(r => setTimeout(r, 500));

    // Two players vote for player 3 (p3 — players[2])
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      await gotoGame(page1, game.inviteCode, game.players[0].token);
      await gotoGame(page2, game.inviteCode, game.players[1].token);
      await waitForGameShell(page1);
      await waitForGameShell(page2);
      await dismissSplash(page1);
      await dismissSplash(page2);

      // Both players navigate to Today tab and open takeover
      await switchToTodayTab(page1);
      await page1.getByText('Cast Your Vote').click();
      await page1.waitForTimeout(500);

      await switchToTodayTab(page2);
      await page2.getByText('Cast Your Vote').click();
      await page2.waitForTimeout(500);

      // Both vote for player 3 (p3)
      const target = game.players[2].id;
      await page1.locator(`[data-testid="vote-btn-${target}"]`).click();
      await page1.locator('[data-testid="vote-confirm-btn"]').click();
      await page1.waitForTimeout(300);

      await page2.locator(`[data-testid="vote-btn-${target}"]`).click();
      await page2.locator('[data-testid="vote-confirm-btn"]').click();
      await page2.waitForTimeout(300);

      // Confirm votes registered
      await expect(page1.locator('[data-testid="vote-confirmed"]')).toBeVisible({ timeout: 5000 });
      await expect(page2.locator('[data-testid="vote-confirmed"]')).toBeVisible({ timeout: 5000 });

      // Close takeover on page1 so we can see the Today tab
      await page1.getByRole('button', { name: 'Close' }).click();
      await page1.waitForTimeout(300);

      // Close voting via admin API
      await injectTimelineEvent(game.gameId, 'CLOSE_VOTING');
      await new Promise(r => setTimeout(r, 1000));

      // Page1 should now show a completed card on Today tab (not empty)
      // The "Done" badge appears on completed cards
      await expect(page1.getByText('Done')).toBeVisible({ timeout: 10_000 });

      // Summary should mention elimination
      await expect(
        page1.getByText(/eliminated/i)
      ).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });

  test('Fullscreen takeover shows vote results for completed card', async ({ browser }) => {
    const game = await createTestGame(3, 1);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));
    await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
    await new Promise(r => setTimeout(r, 500));

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      await gotoGame(page1, game.inviteCode, game.players[0].token);
      await gotoGame(page2, game.inviteCode, game.players[1].token);
      await waitForGameShell(page1);
      await waitForGameShell(page2);
      await dismissSplash(page1);
      await dismissSplash(page2);

      // Both vote for player 3 (p3) via takeover
      await switchToTodayTab(page1);
      await page1.getByText('Cast Your Vote').click();
      await page1.waitForTimeout(500);
      const target = game.players[2].id;
      await page1.locator(`[data-testid="vote-btn-${target}"]`).click();
      await page1.locator('[data-testid="vote-confirm-btn"]').click();
      await page1.waitForTimeout(300);
      await page1.getByRole('button', { name: 'Close' }).click();
      await page1.waitForTimeout(300);

      await switchToTodayTab(page2);
      await page2.getByText('Cast Your Vote').click();
      await page2.waitForTimeout(500);
      await page2.locator(`[data-testid="vote-btn-${target}"]`).click();
      await page2.locator('[data-testid="vote-confirm-btn"]').click();
      await page2.waitForTimeout(300);
      await page2.getByRole('button', { name: 'Close' }).click();
      await page2.waitForTimeout(300);

      // Close voting
      await injectTimelineEvent(game.gameId, 'CLOSE_VOTING');
      await new Promise(r => setTimeout(r, 1000));

      // Wait for completed card to appear on page1
      await expect(page1.getByText('Done')).toBeVisible({ timeout: 10_000 });

      // Tap the completed card to open takeover with results
      await page1.getByText(/eliminated/i).click();
      await page1.waitForTimeout(500);

      // Should see vote results heading
      await expect(page1.getByText('VOTE RESULTS')).toBeVisible({ timeout: 5000 });

      // Player 3 (p3) should show 2 votes in the tally
      await expect(page1.getByText('2')).toBeVisible({ timeout: 5000 });

      // "ELIMINATED" badge should be visible
      await expect(page1.getByText('ELIMINATED')).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });

  test('BroadcastBar shows live pill during voting', async ({ browser }) => {
    const game = await createTestGame(3, 1);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));
    await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
    await new Promise(r => setTimeout(r, 500));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      // The BroadcastBar at the top should contain a "Voting" live pill
      await expect(page.getByText('Voting')).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('System messages appear in chat for cartridge events', async ({ browser }) => {
    const game = await createTestGame(3, 1);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      // Inject voting while the player is connected (so useTimeline detects the transition)
      await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
      await page.waitForTimeout(1000);

      // Chat tab should show "Voting has started" system message
      // Make sure we're on chat tab (default)
      await page.getByRole('button', { name: 'Chat' }).click();
      await page.waitForTimeout(300);
      await expect(page.getByText('Voting has started')).toBeVisible({ timeout: 10_000 });

      // Close voting
      await injectTimelineEvent(game.gameId, 'CLOSE_VOTING');
      await page.waitForTimeout(1000);

      // Chat should now contain "Voting complete" system message
      await expect(page.getByText(/Voting complete/)).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });
});
