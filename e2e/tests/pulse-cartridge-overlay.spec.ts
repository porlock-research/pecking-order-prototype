import { test, expect, type Page } from '@playwright/test';
import {
  createTestGame,
  advanceGameState,
  injectTimelineEvent,
} from '../fixtures/game-setup';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

/**
 * Pulse-specific gotoGame: appends `?shell=pulse` so the shell loader picks the
 * Pulse shell instead of the default. Mirrors the fixture's gotoGame helper.
 */
async function gotoPulseGame(page: Page, inviteCode: string, token: string): Promise<void> {
  // Suppress the PWA install gate before navigation by setting localStorage early.
  await page.addInitScript(() => {
    try { localStorage.setItem('po-pwa-gate-dismissed', '1'); } catch {}
  });
  await page.goto(`${CLIENT_URL}/game/${inviteCode}?_t=${token}&shell=pulse`);
}

async function waitForPulseShell(page: Page): Promise<void> {
  await page.waitForSelector('.pulse-shell', { timeout: 15_000 });
}

test.describe('Pulse cartridge overlay', () => {
  test('tap active voting pill opens overlay with voting panel', async ({ browser }) => {
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
      await gotoPulseGame(page, game.inviteCode, game.players[0].token);
      await waitForPulseShell(page);

      // The voting pill should be visible in the Pulse bar
      const votingPill = page.locator('button').filter({ hasText: /majority|vote/i }).first();
      await votingPill.click();

      // Overlay appears with the voting panel
      await expect(page.getByTestId('cartridge-panel-voting')).toBeVisible({ timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });

  test('header close button closes the overlay', async ({ browser }) => {
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
      await gotoPulseGame(page, game.inviteCode, game.players[0].token);
      await waitForPulseShell(page);

      const votingPill = page.locator('button').filter({ hasText: /majority|vote/i }).first();
      await votingPill.click();
      await expect(page.getByTestId('cartridge-panel-voting')).toBeVisible({ timeout: 5_000 });

      await page.locator('button[aria-label="Close cartridge"]').click();
      await expect(page.getByTestId('cartridge-panel-voting')).not.toBeVisible({ timeout: 2_000 });
    } finally {
      await ctx.close();
    }
  });

  test('scrim tap (top 40px) closes the overlay', async ({ browser }) => {
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
      await gotoPulseGame(page, game.inviteCode, game.players[0].token);
      await waitForPulseShell(page);

      const votingPill = page.locator('button').filter({ hasText: /majority|vote/i }).first();
      await votingPill.click();
      await expect(page.getByTestId('cartridge-panel-voting')).toBeVisible({ timeout: 5_000 });

      // Scrim is the top 40px above the sheet — click into that strip
      await page.mouse.click(200, 20);
      await expect(page.getByTestId('cartridge-panel-voting')).not.toBeVisible({ timeout: 2_000 });
    } finally {
      await ctx.close();
    }
  });
});
