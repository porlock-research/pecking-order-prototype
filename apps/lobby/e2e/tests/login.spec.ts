import { test, expect } from '../fixtures/lobby-auth';

test.describe('Login Flow @login', () => {
  test('home page loads when authenticated', async ({ page, consoleErrors }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('PECKING ORDER');

    // Should see game creation UI (proves auth worked)
    await expect(page.locator('text=Create Game')).toBeVisible();

    // No console errors
    expect(consoleErrors).toEqual([]);
  });

  test('unauthenticated redirect to login', async ({ browser }) => {
    // Fresh context with explicitly empty auth state (project config injects storageState by default)
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    await page.goto('/join/FAKECODE');
    await page.waitForURL(/\/login/);
    await expect(page.locator('h1')).toContainText('PECKING ORDER');
    await expect(page.locator('text=Sign in to continue')).toBeVisible();

    await context.close();
  });
});
