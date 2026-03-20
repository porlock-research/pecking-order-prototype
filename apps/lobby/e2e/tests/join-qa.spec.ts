import fs from 'fs';
import { test, expect, authenticatePlayer } from '../fixtures/lobby-auth';

function getInviteCode(): string | null {
  try {
    const data = JSON.parse(fs.readFileSync('/tmp/pecking-order-lobby-game.json', 'utf8'));
    return data.inviteCode || null;
  } catch {
    return null;
  }
}

test.describe('Join Wizard + Q&A @join', () => {
  test('player joins via full wizard with Q&A', async ({ browser }) => {
    const inviteCode = getInviteCode();
    test.skip(!inviteCode, 'No invite code — run create-game first (or /test-lobby join)');

    const page = await authenticatePlayer(browser, 'e2e-player2@test.local');
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('React DevTools') && !text.includes('[HMR]') && !text.includes('favicon.ico') && !text.includes('Failed to load resource')) {
          errors.push(text);
        }
      }
    });

    await page.goto(`/join/${inviteCode}`);

    // ── Step 1: Persona Select ──
    await expect(page.locator('text=Choose Your Persona')).toBeVisible({ timeout: 15_000 });
    const thumbnails = page.locator('button:has(img)');
    await expect(thumbnails.first()).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/test-results/screenshots/join-step1-persona.png' });
    await page.click('text=Lock In');

    // ── Step 2: Bio ──
    await expect(page.locator('text=Write Your Catfish Bio')).toBeVisible({ timeout: 5_000 });
    const bioTextarea = page.locator('textarea');
    const bioValue = await bioTextarea.inputValue();
    expect(bioValue.length).toBeGreaterThan(0);
    await page.screenshot({ path: 'e2e/test-results/screenshots/join-step2-bio.png' });
    await page.click('text=Continue');

    // ── Step 3: Q&A ──
    await expect(page.locator('text=Get Into Character')).toBeVisible({ timeout: 5_000 });
    const progressDots = page.locator('.flex.justify-center.gap-1\\.5 button');
    await expect(progressDots).toHaveCount(10);

    for (let i = 0; i < 3; i++) {
      const optionA = page.locator('button:has-text("A.")').first();
      await expect(optionA).toBeVisible({ timeout: 3_000 });
      await optionA.click();
      await page.waitForTimeout(500);
    }

    await progressDots.last().click();
    await page.waitForTimeout(300);
    const optionB = page.locator('button:has-text("B.")').first();
    await expect(optionB).toBeVisible({ timeout: 3_000 });
    await optionB.click();

    await page.screenshot({ path: 'e2e/test-results/screenshots/join-step3-qa.png' });

    const continueBtn = page.locator('button:has-text("Continue")');
    await expect(continueBtn).toBeVisible({ timeout: 3_000 });
    await continueBtn.click();

    // ── Step 4: Confirm & Join ──
    await expect(page.locator('text=Confirm Your Identity')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=Your Bio')).toBeVisible();
    await page.screenshot({ path: 'e2e/test-results/screenshots/join-step4-confirm.png' });
    await page.click('text=Join Game');

    // ── Waiting Room ──
    await page.waitForURL(/\/game\/.*\/waiting/, { timeout: 15_000 });
    await expect(page.getByText('Waiting for Players')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: 'e2e/test-results/screenshots/join-waiting.png' });

    expect(errors).toEqual([]);
    await page.context().close();
  });
});
