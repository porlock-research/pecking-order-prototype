# Lobby E2E Tests Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-app Playwright e2e tests to the lobby app (`apps/lobby`), covering login, game creation, and the full join wizard including the Q&A step.

**Architecture:** Tests live inside `apps/lobby/e2e/` following turborepo best practice (tests belong to the app that owns them). Auth is handled via the real dev-mode magic link flow — no mocks, no backdoors. A Playwright `setup` project authenticates and saves `storageState` so all tests reuse the same session. Game creation is tested through the lobby UI itself. A second browser context authenticates a second player to test the join flow.

**Tech Stack:** Playwright, Next.js 15 (lobby on :3000), D1/SQLite (local), Turborepo.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `apps/lobby/e2e/playwright.config.ts` | Playwright config: lobby at :3000, setup project for auth |
| Create | `apps/lobby/e2e/fixtures/lobby-auth.ts` | Shared fixtures: authenticated page, console error collector, game creation helpers |
| Create | `apps/lobby/e2e/tests/login.spec.ts` | Login flow: magic link → redirect → authenticated |
| Create | `apps/lobby/e2e/tests/join-qa.spec.ts` | Full join wizard: persona select → bio → Q&A → confirm → waiting room |
| Create | `apps/lobby/e2e/.auth/` | Directory for saved auth state (gitignored) |
| Modify | `apps/lobby/package.json` | Add `test:e2e` and `test:e2e:ui` scripts |
| Create | `apps/lobby/turbo.json` | Package-specific turbo config extending root |
| Modify | `package.json` (root) | Add lobby to workspaces (already there), update root test:e2e scripts |
| Modify | `.gitignore` | Ignore auth state directory |

---

## Chunk 1: Infrastructure

### Task 1: Install Playwright and configure per-app test structure

**Files:**
- Modify: `apps/lobby/package.json`
- Create: `apps/lobby/turbo.json`
- Create: `apps/lobby/e2e/playwright.config.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Add Playwright devDependency to lobby**

```bash
cd apps/lobby && npm install -D @playwright/test
```

- [ ] **Step 2: Add test:e2e scripts to lobby package.json**

Add to `apps/lobby/package.json` scripts:

```json
"test:e2e": "playwright test --config=e2e/playwright.config.ts",
"test:e2e:ui": "playwright test --config=e2e/playwright.config.ts --ui"
```

- [ ] **Step 3: Create package-specific turbo.json**

Create `apps/lobby/turbo.json`:

```json
{
  "extends": ["//"],
  "tasks": {
    "test:e2e": {
      "dependsOn": ["^build"],
      "cache": false,
      "outputs": ["e2e/playwright-report/**", "e2e/test-results/**"]
    },
    "test:e2e:ui": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 4: Create Playwright config**

Create `apps/lobby/e2e/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['html', { open: 'never', outputFolder: './playwright-report' }]],
  outputDir: './test-results',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npx turbo run dev --filter=game-server',
      cwd: '../../..',
      port: 8787,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npx turbo run dev --filter=lobby-service',
      cwd: '../../..',
      port: 3000,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/player1.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

- [ ] **Step 5: Add auth state directory to gitignore**

Append to `.gitignore`:

```
# Playwright auth state
**/e2e/.auth/
```

- [ ] **Step 6: Create e2e directory structure**

```bash
mkdir -p apps/lobby/e2e/tests apps/lobby/e2e/fixtures apps/lobby/e2e/.auth
```

- [ ] **Step 7: Commit**

```bash
git add apps/lobby/package.json apps/lobby/turbo.json apps/lobby/e2e/playwright.config.ts .gitignore
git commit -m "chore(lobby): add Playwright e2e test infrastructure"
```

---

### Task 2: Auth setup fixture and console error collector

**Files:**
- Create: `apps/lobby/e2e/tests/auth.setup.ts`
- Create: `apps/lobby/e2e/fixtures/lobby-auth.ts`

- [ ] **Step 1: Create the auth setup project**

This runs once before all tests, authenticating via magic link and saving storageState.

Create `apps/lobby/e2e/tests/auth.setup.ts`:

```typescript
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
```

- [ ] **Step 2: Create shared test fixtures**

Create `apps/lobby/e2e/fixtures/lobby-auth.ts`:

```typescript
import { test as base, expect, type Page } from '@playwright/test';
import path from 'path';

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
```

- [ ] **Step 3: Commit**

```bash
git add apps/lobby/e2e/tests/auth.setup.ts apps/lobby/e2e/fixtures/lobby-auth.ts
git commit -m "feat(lobby): add auth setup fixture and console error collector"
```

---

## Chunk 2: Test Specs

### Task 3: Login smoke test

**Files:**
- Create: `apps/lobby/e2e/tests/login.spec.ts`

- [ ] **Step 1: Write login smoke test**

Create `apps/lobby/e2e/tests/login.spec.ts`:

```typescript
import { test, expect } from '../fixtures/lobby-auth';

test.describe('Login Flow', () => {
  test('home page loads when authenticated', async ({ page, consoleErrors }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('PECKING ORDER');

    // Should see game creation UI (proves auth worked)
    await expect(page.locator('text=Create Game')).toBeVisible();

    // No console errors
    expect(consoleErrors).toEqual([]);
  });

  test('unauthenticated redirect to login', async ({ browser }) => {
    // Fresh context with no auth state
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('/join/FAKECODE');
    await page.waitForURL(/\/login/);
    await expect(page.locator('h1')).toContainText('PECKING ORDER');
    await expect(page.locator('text=Sign in to continue')).toBeVisible();

    await context.close();
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd apps/lobby && npm run test:e2e`

Expected: 2 tests pass (requires lobby dev server running on :3000).

- [ ] **Step 3: Commit**

```bash
git add apps/lobby/e2e/tests/login.spec.ts
git commit -m "test(lobby): add login smoke tests"
```

---

### Task 4: Join wizard + Q&A integration test

**Files:**
- Create: `apps/lobby/e2e/tests/join-qa.spec.ts`

This is the main test. It creates a game via the lobby UI, then a second player joins through the full 4-step wizard (persona select → bio → Q&A → confirm).

- [ ] **Step 1: Write the join wizard test**

Create `apps/lobby/e2e/tests/join-qa.spec.ts`:

```typescript
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

  test('player 2 joins via full wizard with Q&A', async ({ browser, consoleErrors }) => {
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
    // Wait for persona carousel to load (skeleton disappears, persona name appears)
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
      // Click the first answer option (A.)
      const optionA = player2Page.locator('button:has-text("A.")').first();
      await expect(optionA).toBeVisible({ timeout: 3_000 });
      await optionA.click();
      // Wait for auto-advance animation
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

    // "Continue" button should now be visible (at least 1 answer exists + on last question)
    const continueBtn = player2Page.locator('button:has-text("Continue")');
    await expect(continueBtn).toBeVisible({ timeout: 3_000 });
    await continueBtn.click();

    // ── Step 4: Confirm & Join ──
    await expect(player2Page.locator('text=Confirm Your Identity')).toBeVisible({ timeout: 5_000 });

    // Bio should be visible in the confirmation card
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
```

- [ ] **Step 2: Run tests to verify**

Run: `cd apps/lobby && npm run test:e2e`

Expected: All tests pass. Playwright auto-starts lobby :3000 + game-server :8787 via webServer config (or reuses if already running).

Note: The game creation test uses DEBUG_PECKING_ORDER mode with "Skip invites" which creates the game and auto-initializes the game server DO. The join test creates a real session for player 2 via magic link, then walks through all 4 wizard steps.

- [ ] **Step 3: Commit**

```bash
git add apps/lobby/e2e/tests/join-qa.spec.ts
git commit -m "test(lobby): add join wizard + Q&A integration test"
```

---

## Chunk 3: Integration

### Task 5: Update root scripts and verify full pipeline

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Update root package.json test:e2e to include lobby**

The existing root scripts filter only `@pecking-order/e2e`. Update to run both:

```json
"test:e2e": "turbo run test:e2e",
"test:e2e:ui": "turbo run test:e2e:ui"
```

This removes the `--filter` so turbo runs `test:e2e` in all packages that define it (both `e2e/` and `apps/lobby/`).

- [ ] **Step 2: Run the lobby tests via turbo**

Run from monorepo root: `npm run test:e2e -- --filter=lobby-service`

Expected: Turbo runs `test:e2e` in lobby-service, Playwright executes all tests.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: update root test:e2e to include all packages"
```

---

## Post-Implementation Notes

### Running the tests

```bash
# Lobby tests only (requires lobby + game-server running, or let Playwright start them)
cd apps/lobby && npm run test:e2e

# Via turbo from root
npm run test:e2e -- --filter=lobby-service

# With Playwright UI
cd apps/lobby && npm run test:e2e:ui

# All e2e tests (lobby + game client)
npm run test:e2e
```

### What the tests cover
- **Login**: magic link flow, auth redirect for unauthenticated routes
- **Game creation**: DEBUG mode + skip invites → invite code generated
- **Join wizard**: 4-step flow (persona → bio → Q&A → confirm → waiting room)
- **Console errors**: every test asserts zero console errors

### What's NOT covered (future work)
- Admin dashboard pages
- Email invite flow (needs Resend mock or staging)
- Game client e2e (already has separate tests in `e2e/`)
- CONFIGURABLE_CYCLE game creation (complex form, covers separately)
- Mobile viewport / responsive behavior

### Future: client app migration
The existing `e2e/` root directory should eventually move to `apps/client/e2e/` following the same per-app pattern. That migration would:
1. Move `e2e/tests/`, `e2e/fixtures/`, `e2e/playwright.config.ts` → `apps/client/e2e/`
2. Add `test:e2e` script to `apps/client/package.json`
3. Add `apps/client/turbo.json` with test:e2e task config
4. Remove root `e2e/` from workspaces
