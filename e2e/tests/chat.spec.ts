import { test, expect } from '@playwright/test';
import {
  createTestGame,
  advanceGameState,
  injectTimelineEvent,
  gotoGame,
  suppressPwaGate,
  waitForGameShell,
} from '../fixtures/game-setup';

test.describe('Chat — Send & Receive Messages', () => {
  test('player sends a message and sees it in their own timeline', async ({ page }) => {
    const game = await createTestGame(2, 2);

    // Advance to activeSession
    await advanceGameState(game.gameId);
    await page.waitForTimeout(500);

    // Open group chat so players can type
    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await page.waitForTimeout(300);

    // Player 0 joins
    await gotoGame(page, game.inviteCode, game.players[0].token);
    await waitForGameShell(page);

    // Type and send a message
    const input = page.locator('[data-testid="chat-input"]');
    const send = page.locator('[data-testid="chat-send"]');

    await input.fill('hello from e2e');
    await send.click();

    // Should see the message in the timeline (optimistic or confirmed)
    await expect(page.locator('[data-testid="chat-message"]').filter({ hasText: 'hello from e2e' })).toBeVisible({ timeout: 5000 });
  });

  test('two players can exchange messages in real-time', async ({ browser }) => {
    const game = await createTestGame(2, 2);

    // Advance and open group chat
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));
    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));

    // Create two separate browser contexts (simulates two players)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Both players join
      await gotoGame(page1, game.inviteCode, game.players[0].token);
      await gotoGame(page2, game.inviteCode, game.players[1].token);
      await waitForGameShell(page1);
      await waitForGameShell(page2);

      // Player 1 sends a message
      await page1.locator('[data-testid="chat-input"]').fill('hello from Viper');
      await page1.locator('[data-testid="chat-send"]').click();

      // Player 2 should see it
      await expect(
        page2.locator('[data-testid="chat-message"]').filter({ hasText: 'hello from Viper' })
      ).toBeVisible({ timeout: 5000 });

      // Player 2 sends a reply
      await page2.locator('[data-testid="chat-input"]').fill('hey Viper, Phoenix here');
      await page2.locator('[data-testid="chat-send"]').click();

      // Player 1 should see the reply
      await expect(
        page1.locator('[data-testid="chat-message"]').filter({ hasText: 'hey Viper, Phoenix here' })
      ).toBeVisible({ timeout: 5000 });
    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
