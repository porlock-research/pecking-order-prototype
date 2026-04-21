import { test, expect } from '@playwright/test';

/**
 * Narrow E2E covering what's testable without a pre-seeded game:
 * - /j/[code] route is reachable without authentication (no /login redirect)
 * - not-found page renders for unknown codes
 *
 * The happy-path test (welcome form → claimSeat → persona wizard) requires
 * a real GameSessions row with status=RECRUITING and is covered by the
 * manual smoke checklist in the plan. When the e2e fixtures gain a
 * direct-D1 seed helper, add that test here.
 */

test.describe('Frictionless invite flow (/j/CODE)', () => {
  test('unknown code renders not-found without auth redirect', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/j/BOGUS1');

    // Must not bounce to /login — /j/* is unauth-safe by design (not in middleware matcher)
    expect(page.url()).not.toContain('/login');
    expect(page.url()).toContain('/j/BOGUS1');

    await expect(page.getByText(/Invite not found/i)).toBeVisible();
  });

  test('/j/[code] not in middleware matcher', async ({ page, context }) => {
    // Double-assert the same invariant via a second code to catch pattern matching bugs.
    await context.clearCookies();
    const response = await page.goto('/j/ABCDE1');
    // Should render a page (200 or the not-found page), NOT redirect to /login.
    expect(response?.status()).toBeLessThan(400);
    expect(page.url()).not.toContain('/login');
  });
});
