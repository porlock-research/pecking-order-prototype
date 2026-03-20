import { test as base, expect, type Page } from '@playwright/test';

/**
 * Collect console errors during a test.
 * Ignores known noisy warnings (React dev, HMR).
 */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore known noise
      if (text.includes('React DevTools')) return;
      if (text.includes('[HMR]')) return;
      if (text.includes('favicon.ico')) return;
      if (text.includes('Failed to load resource')) return;
      errors.push(text);
    }
  });
  return errors;
}

/**
 * Authenticate a fresh browser context via the dev magic link flow.
 * Returns the page, already at '/' and authenticated.
 */
async function authenticatePlayer(
  browser: base.Browser,
  email: string
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('/login');
  await page.fill('#email', email);
  await page.click('button[type="submit"]');
  const signInLink = page.getByText('Click to Sign In');
  await expect(signInLink).toBeVisible({ timeout: 10_000 });
  await signInLink.click();
  await page.waitForURL('/');
  return page;
}

// Extend base test with console error checking
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors = collectConsoleErrors(page);
    await use(errors);
  },
});

export { expect, authenticatePlayer };
