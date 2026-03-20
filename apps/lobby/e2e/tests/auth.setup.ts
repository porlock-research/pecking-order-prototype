import { test as setup, expect } from '@playwright/test';
import path from 'path';

const PLAYER1_FILE = path.join(__dirname, '../.auth/player1.json');

setup('authenticate player 1', async ({ page }) => {
  // Navigate to login
  await page.goto('/login');
  await expect(page.locator('h1')).toContainText('PECKING ORDER');

  // Enter email and submit
  await page.fill('#email', 'e2e-player1@test.local');
  await page.click('button[type="submit"]');

  // Dev mode: magic link is shown directly (no email sent)
  const signInLink = page.getByText('Click to Sign In');
  await expect(signInLink).toBeVisible({ timeout: 10_000 });

  // Click the magic link — sets session cookie, redirects to /
  await signInLink.click();
  await page.waitForURL('/');

  // Verify we're authenticated (home page renders game creation form)
  await expect(page.locator('text=Create Game')).toBeVisible({ timeout: 10_000 });

  // Save auth state
  await page.context().storageState({ path: PLAYER1_FILE });
});
