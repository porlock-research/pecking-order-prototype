import { test, expect } from '@playwright/test';
import {
  createTestGame,
  advanceGameState,
  injectTimelineEvent,
  gotoGame,
  waitForGameShell,
  dismissReveal,
  switchToTodayTab,
  dismissSplash,
} from '../fixtures/game-setup';

test.describe('Today Tab', () => {
  test('Today tab shows tab with correct label', async ({ browser }) => {
    const game = await createTestGame(3, 2);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      await expect(page.getByRole('button', { name: 'Today' })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: 'Schedule' })).not.toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('Today tab shows empty state when no cartridges active', async ({ browser }) => {
    const game = await createTestGame(3, 2);
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

      await expect(page.getByText(/Day 1.*Today/)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('0 activities')).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('Live voting renders inline on Today tab', async ({ browser }) => {
    const game = await createTestGame(3, 2);
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

      // Section header shows LIVE badge
      await expect(page.getByText('Live')).toBeVisible({ timeout: 5000 });

      // VotingPanel renders inline — vote buttons are visible directly (no takeover needed)
      await expect(page.locator('[data-testid^="vote-btn-"]').first()).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('Vote can be cast inline on Today tab', async ({ browser }) => {
    const game = await createTestGame(3, 2);
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

      // Vote for player 3 (p3) directly in the inline panel
      const target = game.players[2].id;
      await page.locator(`[data-testid="vote-btn-${target}"]`).click();
      await page.locator('[data-testid="vote-confirm-btn"]').click();
      await page.waitForTimeout(500);

      // Confirmation shows inline
      await expect(page.locator('[data-testid="vote-confirmed"]')).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('Result hold — completed voting shows results inline', async ({ browser }) => {
    const game = await createTestGame(3, 2);
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

      // Both vote for player 3 inline
      await switchToTodayTab(page1);
      await switchToTodayTab(page2);

      const target = game.players[2].id;

      await page1.locator(`[data-testid="vote-btn-${target}"]`).click();
      await page1.locator('[data-testid="vote-confirm-btn"]').click();
      await page1.waitForTimeout(300);

      await page2.locator(`[data-testid="vote-btn-${target}"]`).click();
      await page2.locator('[data-testid="vote-confirm-btn"]').click();
      await page2.waitForTimeout(300);

      // Close voting
      await injectTimelineEvent(game.gameId, 'CLOSE_VOTING');
      await new Promise(r => setTimeout(r, 1500));

      await dismissSplash(page1);

      // Vote results should be visible inline (REVEAL phase renders immediately)
      await expect(page1.getByText('VOTE RESULTS')).toBeVisible({ timeout: 10_000 });

      // ELIMINATED badge visible directly on Today tab
      await expect(page1.getByText('ELIMINATED')).toBeVisible({ timeout: 5000 });

      // Section header shows "Done" badge
      await expect(page1.getByText('Done')).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });

  test('BroadcastBar shows live pill during voting', async ({ browser }) => {
    const game = await createTestGame(3, 2);
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

      await expect(page.getByText('Voting').first()).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('System messages appear in chat for cartridge events', async ({ browser }) => {
    const game = await createTestGame(3, 2);
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

      await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
      await page.waitForTimeout(1000);
      await dismissSplash(page);

      await page.getByRole('button', { name: 'Chat' }).click();
      await page.waitForTimeout(300);
      await expect(page.getByText('Voting has started')).toBeVisible({ timeout: 10_000 });

      await injectTimelineEvent(game.gameId, 'CLOSE_VOTING');
      await page.waitForTimeout(1000);
      await dismissSplash(page);

      await expect(page.getByText(/Voting complete/)).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });
});
