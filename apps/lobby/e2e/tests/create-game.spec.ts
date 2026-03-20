import { test, expect } from '../fixtures/lobby-auth';
import { getTestConfig } from '../fixtures/lobby-config';
import {
  fetchGameState,
  validateDynamicManifest,
  validateStaticManifest,
  writeGameOutput,
} from '../fixtures/schema-validation';

const config = getTestConfig();

test.describe('Create Game @create', () => {
  test(`create game (mode=${config.mode})`, async ({ page, consoleErrors }) => {
    await page.goto('/');

    // ── Select game mode ──
    if (config.mode === 'debug') {
      await page.locator('[data-testid="game-mode-select"]').selectOption('DEBUG_PECKING_ORDER');
      // Ensure Static manifest — toggle is on <label>, check the inner input
      const toggleLabel = page.locator('[data-testid="manifest-kind-toggle"]');
      const toggleInput = toggleLabel.locator('input[type="checkbox"]');
      if (await toggleInput.isChecked()) await toggleLabel.click();
    } else {
      await page.locator('[data-testid="game-mode-select"]').selectOption('CONFIGURABLE_CYCLE');

      if (config.mode === 'dynamic') {
        // Toggle to Dynamic
        const toggleLabel = page.locator('[data-testid="manifest-kind-toggle"]');
        const toggleInput = toggleLabel.locator('input[type="checkbox"]');
        if (!(await toggleInput.isChecked())) await toggleLabel.click();

        // ── Configure DynamicRulesetBuilder ──

        // Schedule preset — click the parent <label> of the sr-only radio
        const presetRadio = page.locator(`[data-testid="preset-${config.schedulePreset}"]`);
        await presetRadio.locator('..').click();

        // Start time
        if (config.startTime.startsWith('now+') || config.startTime === '') {
          // For SPEED_RUN, use the "now + 2 min" button if available
          const nowBtn = page.locator('[data-testid="start-time-now-btn"]');
          if (await nowBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await nowBtn.click();
          } else if (config.startTime) {
            const minutes = parseInt(config.startTime.replace('now+', '').replace('m', ''), 10) || 2;
            const soon = new Date(Date.now() + minutes * 60_000);
            const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
            await page.locator('[data-testid="start-time-input"]').fill(local);
          }
        } else if (config.startTime) {
          await page.locator('[data-testid="start-time-input"]').fill(config.startTime);
        }

        // Vote pool — open section, toggle chips to match config
        const voteSection = page.locator('[data-testid="section-vote-types"]');
        if (await voteSection.getAttribute('open') === null) {
          await voteSection.locator('summary').click();
        }
        const allVoteTypes = ['MAJORITY', 'EXECUTIONER', 'BUBBLE', 'SECOND_TO_LAST', 'PODIUM_SACRIFICE', 'SHIELD', 'TRUST_PAIRS'];
        for (const vt of allVoteTypes) {
          const chip = page.locator(`[data-testid="chip-${vt}"]`);
          const isChecked = (await chip.getAttribute('aria-pressed')) === 'true';
          const shouldBeChecked = config.votePool.includes(vt);
          if (isChecked !== shouldBeChecked) {
            await chip.click();
          }
        }

        // DM invite toggle
        if (config.dmInvite) {
          const dmToggle = page.locator('[data-testid="dm-invite-toggle"]');
          if (await dmToggle.getAttribute('aria-checked') !== 'true') {
            await dmToggle.click();
          }
        }
      } else {
        // Static mode — ensure Static manifest
        const toggleLabel = page.locator('[data-testid="manifest-kind-toggle"]');
        const toggleInput = toggleLabel.locator('input[type="checkbox"]');
        if (await toggleInput.isChecked()) await toggleLabel.click();
      }
    }

    await page.screenshot({ path: 'e2e/test-results/screenshots/create-config.png' });

    // ── Create Game ──
    await page.locator('[data-testid="create-game-btn"]').click();

    // Wait for invite code
    const inviteCodeEl = page.locator('[data-testid="invite-code"]');
    await expect(inviteCodeEl).toBeVisible({ timeout: 15_000 });
    const inviteCode = (await inviteCodeEl.textContent())!.trim();
    expect(inviteCode).toMatch(/^[A-Z0-9]{6}$/);

    await page.screenshot({ path: 'e2e/test-results/screenshots/create-complete.png' });

    // ── Extract game ID from status text ──
    const statusEl = page.locator('[data-testid="status-output"]');
    const statusText = await statusEl.textContent();
    const match = statusText?.match(/GAME_CREATED:\s*([A-Za-z0-9_-]+)/);
    const gameId = match?.[1] || '';
    expect(gameId).toBeTruthy();

    // ── Schema Validation ──
    let schemaErrors: string[] = [];
    if (gameId) {
      try {
        const state = await fetchGameState(gameId);

        if (config.mode === 'dynamic') {
          schemaErrors = validateDynamicManifest(state);
        } else {
          schemaErrors = validateStaticManifest(state, config.mode === 'debug' ? config.days : undefined);
        }

        writeGameOutput({
          gameId,
          inviteCode,
          mode: config.mode,
          schedulePreset: config.mode === 'dynamic' ? config.schedulePreset : undefined,
          state,
          schemaErrors,
        });

        if (schemaErrors.length > 0) {
          console.log('Schema validation FAILED:');
          schemaErrors.forEach(e => console.log(`  - ${e}`));
        } else {
          console.log('Schema validation PASSED');
        }
      } catch (err) {
        schemaErrors = [`Failed to fetch/validate game state: ${err}`];
      }
    }

    expect(schemaErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    console.log(`\nGame created: ${gameId}`);
    console.log(`Invite code: ${inviteCode}`);
    console.log(`Join URL: http://localhost:3000/join/${inviteCode}`);
    console.log(`Output: /tmp/pecking-order-lobby-game.json\n`);
  });
});
