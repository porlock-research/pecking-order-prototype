import { test as setup, expect } from '@playwright/test';
import path from 'path';

const PLAYER1_FILE = path.join(__dirname, '../.auth/player1.json');

setup('authenticate player 1', async ({ page }) => {
  // Wait for dev server to be healthy (OpenNext bridge can be slow after HMR)
  let healthy = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await page.goto('/login');
    if (res && res.status() === 200) {
      healthy = true;
      break;
    }
    // Server returned error — wait and retry
    await page.waitForTimeout(2000);
  }
  if (!healthy) throw new Error('Lobby dev server not healthy after 3 attempts');

  await expect(page.locator('h1')).toContainText('PECKING ORDER');

  // Enter email and submit
  await page.fill('#email', 'e2e-player1@test.local');
  await page.click('button[type="submit"]');

  // Dev mode: magic link is shown directly (no email sent)
  const signInLink = page.getByText('Click to Sign In');
  await expect(signInLink).toBeVisible({ timeout: 10_000 });

  // Click the magic link — sets session cookie, redirects to /
  await signInLink.click();
  // Wait for redirect to complete — may land on / or /login?error= if verify failed
  await page.waitForURL(url => !url.pathname.includes('/login/verify'), { timeout: 15_000 });

  // Verify we're authenticated (home page renders game creation form)
  await expect(page.locator('text=Create Game')).toBeVisible({ timeout: 10_000 });

  // Save auth state
  await page.context().storageState({ path: PLAYER1_FILE });
});
