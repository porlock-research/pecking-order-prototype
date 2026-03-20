import { test, expect, authenticatePlayer } from '../fixtures/lobby-auth';

test.describe.serial('Join Wizard + Q&A', () => {
  let inviteCode: string;

  test('create game and get invite code', async ({ page, consoleErrors }) => {
    await page.goto('/');

    // Switch to DEBUG mode (simpler config, no date scheduling)
    await page.selectOption('select', 'DEBUG_PECKING_ORDER');

    // Click Create Game (do NOT enable "Skip invites" — we need the invite code)
    await page.click('text=Create Game');

    // Wait for invite code to appear
    const inviteCodeEl = page.locator('.tracking-\\[0\\.3em\\]');
    await expect(inviteCodeEl).toBeVisible({ timeout: 15_000 });
    inviteCode = (await inviteCodeEl.textContent())!.trim();
    expect(inviteCode).toMatch(/^[A-Z0-9]{6}$/);

    expect(consoleErrors).toEqual([]);
  });

  test('player 2 joins via full wizard with Q&A', async ({ browser }) => {
    test.skip(!inviteCode, 'No invite code from previous test');

    // Authenticate player 2 in a fresh context
    const player2Page = await authenticatePlayer(browser, 'e2e-player2@test.local');
    const p2Errors: string[] = [];
    player2Page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('React DevTools') && !text.includes('[HMR]') && !text.includes('favicon.ico')) {
          p2Errors.push(text);
        }
      }
    });

    // Navigate to join page
    await player2Page.goto(`/join/${inviteCode}`);

    // ── Step 1: Persona Select ──
    await expect(player2Page.locator('text=Choose Your Persona')).toBeVisible({ timeout: 15_000 });

    // Wait for personas to load (thumbnails appear)
    const thumbnails = player2Page.locator('button:has(img)');
    await expect(thumbnails.first()).toBeVisible({ timeout: 10_000 });

    // Click "Lock In" to select the current persona
    await player2Page.click('text=Lock In');

    // ── Step 2: Bio Authoring ──
    await expect(player2Page.locator('text=Write Your Catfish Bio')).toBeVisible({ timeout: 5_000 });

    // Bio should be pre-filled with persona description
    const bioTextarea = player2Page.locator('textarea');
    const bioValue = await bioTextarea.inputValue();
    expect(bioValue.length).toBeGreaterThan(0);

    // Click Continue → should generate questions and go to step 3
    await player2Page.click('text=Continue');

    // ── Step 3: Q&A ──
    await expect(player2Page.locator('text=Get Into Character')).toBeVisible({ timeout: 5_000 });

    // Verify 10 progress dots
    const progressDots = player2Page.locator('.flex.justify-center.gap-1\\.5 button');
    await expect(progressDots).toHaveCount(10);

    // Verify question text is displayed
    const questionCounter = player2Page.locator('text=/1\\/10/');
    await expect(questionCounter).toBeVisible();

    // Answer first 3 questions by clicking option A each time
    for (let i = 0; i < 3; i++) {
      const optionA = player2Page.locator('button:has-text("A.")').first();
      await expect(optionA).toBeVisible({ timeout: 3_000 });
      await optionA.click();
      await player2Page.waitForTimeout(500);
    }

    // Skip to last question via progress dot and answer it to trigger "Continue"
    const lastDot = progressDots.last();
    await lastDot.click();
    await player2Page.waitForTimeout(300);

    // Answer the last question
    const optionB = player2Page.locator('button:has-text("B.")').first();
    await expect(optionB).toBeVisible({ timeout: 3_000 });
    await optionB.click();

    // "Continue" button should now be visible
    const continueBtn = player2Page.locator('button:has-text("Continue")');
    await expect(continueBtn).toBeVisible({ timeout: 3_000 });
    await continueBtn.click();

    // ── Step 4: Confirm & Join ──
    await expect(player2Page.locator('text=Confirm Your Identity')).toBeVisible({ timeout: 5_000 });
    await expect(player2Page.locator('text=Your Bio')).toBeVisible();

    // Click "Join Game"
    await player2Page.click('text=Join Game');

    // Should redirect to waiting room
    await player2Page.waitForURL(/\/game\/.*\/waiting/, { timeout: 15_000 });
    await expect(player2Page.locator('text=/waiting|joined/i')).toBeVisible({ timeout: 10_000 });

    // No console errors
    expect(p2Errors).toEqual([]);

    await player2Page.context().close();
  });
});
