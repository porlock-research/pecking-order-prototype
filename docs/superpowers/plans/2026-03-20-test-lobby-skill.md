# `/test-lobby` Skill Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/test-lobby` slash command that drives the lobby UI via Playwright with configurable parameters, validates manifest/data schema conformance, and outputs usable game info.

**Architecture:** A Claude Code slash command parses preset + overrides, sets environment variables, and runs Playwright tests. Tests read env vars via a config fixture to drive UI interactions. After key actions, tests fetch game-server state and validate against shared-types Zod schemas. Results include screenshots at each step + a JSON output file with game info.

**Tech Stack:** Playwright, Zod (shared-types schemas), Claude Code slash commands, env vars for parameterization.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `.claude/commands/test-lobby.md` | Slash command: parse args, build env vars, instruct to run Playwright |
| Create | `apps/lobby/e2e/fixtures/lobby-config.ts` | Read env vars, expose typed `LobbyTestConfig` to tests |
| Create | `apps/lobby/e2e/fixtures/schema-validation.ts` | Fetch game-server state, validate against Zod schemas, write output JSON |
| Create | `apps/lobby/e2e/tests/create-game.spec.ts` | Parameterized game creation (debug/static/dynamic) with schema checks |
| Modify | `apps/lobby/e2e/tests/join-qa.spec.ts` | Refactor to use config fixture (mode-aware game creation) |
| Modify | `apps/lobby/e2e/tests/login.spec.ts` | Add `@login` tag |
| Modify | `apps/lobby/e2e/playwright.config.ts` | Add `--headed` default via env, screenshot config |
| Modify | `apps/lobby/app/page.tsx` | Add `data-testid` attributes to key UI elements |
| Modify | `apps/lobby/app/components/DynamicRulesetBuilder.tsx` | Add `data-testid` attributes to sections, chips, radios |

---

## Chunk 1: Foundations

### Task 1: Add `data-testid` attributes to lobby UI

The lobby UI lacks stable test selectors. Add `data-testid` to key interactive elements so Playwright tests don't depend on CSS classes or fragile text matching.

**Files:**
- Modify: `apps/lobby/app/page.tsx`
- Modify: `apps/lobby/app/components/DynamicRulesetBuilder.tsx`

- [ ] **Step 1: Add data-testid to page.tsx elements**

Read `apps/lobby/app/page.tsx` and add these `data-testid` attributes:

| Element | Location | data-testid |
|---------|----------|-------------|
| Mode `<select>` | line ~618 | `game-mode-select` |
| Manifest kind toggle `<label>` (the clickable wrapper, NOT the sr-only input) | line ~645 | `manifest-kind-toggle` |
| "Create Game" button | line ~1161 | `create-game-btn` |
| "Quick Start" button | line ~1141 | `quick-start-btn` |
| Invite code display `<div>` with tracking class | line ~1203 | `invite-code` |
| Status output `<div>` (the `> GAME_CREATED: ...` text) | line ~1190 | `status-output` |

For the `<select>`:
```tsx
<select
  data-testid="game-mode-select"
  value={mode}
```

For the manifest kind toggle — add `data-testid` to the `<label>` wrapper (the clickable element), NOT the sr-only `<input>`:
```tsx
<label data-testid="manifest-kind-toggle" className="relative cursor-pointer">
  <input
    type="checkbox"
    checked={manifestKind === 'DYNAMIC'}
```

For the Create Game button:
```tsx
<button
  data-testid="create-game-btn"
  onClick={handleCreateGame}
```

For the invite code:
```tsx
<div data-testid="invite-code" className="text-4xl font-mono font-black text-skin-gold tracking-[0.3em] select-all">
  {inviteCode}
</div>
```

- [ ] **Step 2: Add data-testid to DynamicRulesetBuilder.tsx elements**

Read `apps/lobby/app/components/DynamicRulesetBuilder.tsx` and add these `data-testid` attributes:

For each `Section` component, add `data-testid` to the `<details>` element. Modify the `Section` component to accept an optional `testId` prop:

```tsx
function Section({
  title,
  badge,
  defaultOpen = false,
  testId,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <details data-testid={testId} open={defaultOpen} className="group border ...">
```

Then add `testId` to each Section usage:
- Vote Types: `testId="section-vote-types"`
- Games: `testId="section-games"`
- Activities: `testId="section-activities"`
- Social Rules: `testId="section-social"`
- Inactivity: `testId="section-inactivity"`
- Day Count: `testId="section-day-count"`
- Schedule: `testId="section-schedule"`
- Start Time: `testId="section-start-time"`

For each `ChipCheckbox`, add `data-testid` and `aria-pressed` using the value:

```tsx
function ChipCheckbox({ label, checked, onChange, sub, testId }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  sub?: string;
  testId?: string;
}) {
  return (
    <button type="button" data-testid={testId} aria-pressed={checked} onClick={() => onChange(!checked)} ...>
```

Then pass `testId={`chip-${vt.value}`}` for vote types, `testId={`chip-${gt.value}`}` for games, `testId={`chip-${at.value}`}` for activities.

For schedule preset radios, add `data-testid`:
```tsx
<input
  type="radio"
  data-testid={`preset-${sp.value}`}
  name="schedulePreset"
```

For the start time input:
```tsx
<input
  type="datetime-local"
  data-testid="start-time-input"
  value={config.startTime}
```

For the "Set to now + 2 min" button:
```tsx
<button
  type="button"
  data-testid="start-time-now-btn"
  onClick={() => {
```

For the DM invite toggle:
```tsx
<Toggle data-testid="dm-invite-toggle" checked={config.social.requireDmInvite} .../>
```

Note: The `Toggle` component needs a `data-testid` prop pass-through. Add it:
```tsx
function Toggle({ checked, onChange, size = 'sm', 'data-testid': testId }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: 'sm' | 'md';
  'data-testid'?: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} data-testid={testId} ...>
```

- [ ] **Step 3: Verify lobby builds**

Run: `cd apps/lobby && npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add apps/lobby/app/page.tsx apps/lobby/app/components/DynamicRulesetBuilder.tsx
git commit -m "chore(lobby): add data-testid attributes to game creation UI for e2e tests"
```

---

### Task 2: Config fixture and schema validation helpers

**Files:**
- Create: `apps/lobby/e2e/fixtures/lobby-config.ts`
- Create: `apps/lobby/e2e/fixtures/schema-validation.ts`

- [ ] **Step 1: Create config fixture**

Create `apps/lobby/e2e/fixtures/lobby-config.ts`:

```typescript
export interface LobbyTestConfig {
  mode: 'debug' | 'static' | 'dynamic';
  days: number;
  vote: string;
  game: string;
  activity: string;
  // Dynamic-specific
  schedulePreset: 'DEFAULT' | 'COMPACT' | 'SPEED_RUN';
  startTime: string;
  votePool: string[];
  gamePool: string[];
  activityPool: string[];
  maxPlayers: number;
  maxDays: number;
  // Social
  dmInvite: boolean;
  dmChars: number;
  dmSlots: number;
  dmCost: number;
  // Inactivity
  inactivityEnabled: boolean;
  // Display
  headed: boolean;
}

const ALL_VOTE_TYPES = ['MAJORITY', 'EXECUTIONER', 'BUBBLE', 'SECOND_TO_LAST', 'PODIUM_SACRIFICE', 'SHIELD', 'TRUST_PAIRS'];
const ALL_GAME_TYPES = ['TRIVIA', 'GAP_RUN', 'GRID_PUSH', 'SEQUENCE', 'REACTION_TIME', 'COLOR_MATCH', 'STACKER', 'QUICK_MATH', 'SIMON_SAYS', 'AIM_TRAINER', 'BET_BET_BET', 'BLIND_AUCTION', 'KINGS_RANSOM', 'THE_SPLIT', 'TOUCH_SCREEN', 'REALTIME_TRIVIA'];
const ALL_ACTIVITY_TYPES = ['PLAYER_PICK', 'PREDICTION', 'WOULD_YOU_RATHER', 'HOT_TAKE', 'CONFESSION', 'GUESS_WHO'];

function parseList(env: string | undefined, defaults: string[]): string[] {
  if (!env) return defaults;
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

export function getTestConfig(): LobbyTestConfig {
  return {
    mode: (process.env.LOBBY_TEST_MODE as LobbyTestConfig['mode']) || 'debug',
    days: parseInt(process.env.LOBBY_TEST_DAYS || '2', 10),
    vote: process.env.LOBBY_TEST_VOTE || 'MAJORITY',
    game: process.env.LOBBY_TEST_GAME || '',
    activity: process.env.LOBBY_TEST_ACTIVITY || '',
    schedulePreset: (process.env.LOBBY_TEST_PRESET as LobbyTestConfig['schedulePreset']) || 'COMPACT',
    startTime: process.env.LOBBY_TEST_START_TIME || '',
    votePool: parseList(process.env.LOBBY_TEST_VOTE_POOL, ALL_VOTE_TYPES),
    gamePool: parseList(process.env.LOBBY_TEST_GAME_POOL, ALL_GAME_TYPES),
    activityPool: parseList(process.env.LOBBY_TEST_ACTIVITY_POOL, ALL_ACTIVITY_TYPES),
    maxPlayers: parseInt(process.env.LOBBY_TEST_MAX_PLAYERS || '8', 10),
    maxDays: parseInt(process.env.LOBBY_TEST_MAX_DAYS || '7', 10),
    dmInvite: process.env.LOBBY_TEST_DM_INVITE === '1',
    dmChars: parseInt(process.env.LOBBY_TEST_DM_CHARS || '300', 10),
    dmSlots: parseInt(process.env.LOBBY_TEST_DM_SLOTS || '3', 10),
    dmCost: parseInt(process.env.LOBBY_TEST_DM_COST || '1', 10),
    inactivityEnabled: process.env.LOBBY_TEST_INACTIVITY !== '0',
    headed: process.env.LOBBY_TEST_HEADLESS !== '1',
  };
}
```

- [ ] **Step 2: Create schema validation helpers**

Create `apps/lobby/e2e/fixtures/schema-validation.ts`:

```typescript
import fs from 'fs';
import {
  DynamicManifestSchema,
  StaticManifestSchema,
  PeckingOrderRulesetSchema,
} from '@pecking-order/shared-types';

const GAME_SERVER = 'http://localhost:8787';

/**
 * Fetch game state from the game-server /state endpoint.
 */
export async function fetchGameState(gameId: string): Promise<any> {
  const res = await fetch(`${GAME_SERVER}/parties/game-server/${gameId}/state`);
  if (!res.ok) {
    throw new Error(`Failed to fetch game state: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Validate a dynamic manifest using the actual Zod schema from shared-types.
 * Returns an array of error strings (empty = valid).
 */
export function validateDynamicManifest(state: any): string[] {
  const errors: string[] = [];
  const manifest = state?.manifest || state;

  if (!manifest) {
    errors.push('No manifest found in game state');
    return errors;
  }

  // Validate full manifest shape via Zod
  const manifestResult = DynamicManifestSchema.safeParse(manifest);
  if (!manifestResult.success) {
    for (const issue of manifestResult.error.issues) {
      errors.push(`manifest.${issue.path.join('.')}: ${issue.message}`);
    }
  }

  // Additionally validate ruleset via Zod if present
  if (manifest.ruleset) {
    const rulesetResult = PeckingOrderRulesetSchema.safeParse(manifest.ruleset);
    if (!rulesetResult.success) {
      for (const issue of rulesetResult.error.issues) {
        errors.push(`ruleset.${issue.path.join('.')}: ${issue.message}`);
      }
    }
  }

  return errors;
}

/**
 * Validate a static manifest using the actual Zod schema from shared-types.
 */
export function validateStaticManifest(state: any, expectedDays?: number): string[] {
  const errors: string[] = [];
  const manifest = state?.manifest || state;

  if (!manifest) {
    errors.push('No manifest found');
    return errors;
  }

  const result = StaticManifestSchema.safeParse(manifest);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`manifest.${issue.path.join('.')}: ${issue.message}`);
    }
  }

  // Additional day count check
  if (expectedDays && manifest.days?.length !== expectedDays) {
    errors.push(`Expected ${expectedDays} days, got ${manifest.days?.length}`);
  }

  return errors;
}

/**
 * Write game output JSON to /tmp for consumption by other tools.
 */
export function writeGameOutput(data: {
  gameId: string;
  inviteCode: string;
  mode: string;
  schedulePreset?: string;
  state?: any;
  schemaErrors: string[];
}): void {
  const output = {
    gameId: data.gameId,
    inviteCode: data.inviteCode,
    mode: data.mode,
    schedulePreset: data.schedulePreset,
    joinUrl: `http://localhost:3000/join/${data.inviteCode}`,
    stateUrl: `http://localhost:8787/parties/game-server/${data.gameId}/state`,
    manifest: data.state?.manifest,
    schemaValidation: {
      errors: data.schemaErrors,
      status: data.schemaErrors.length === 0 ? 'pass' : 'fail',
    },
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync('/tmp/pecking-order-lobby-game.json', JSON.stringify(output, null, 2));
}
```

Note: `@pecking-order/shared-types` is already a dependency of the lobby app. The e2e tests run in the lobby workspace context so the import resolves. If needed, add it to `apps/lobby/package.json` devDependencies.

- [ ] **Step 3: Commit**

```bash
git add apps/lobby/e2e/fixtures/lobby-config.ts apps/lobby/e2e/fixtures/schema-validation.ts
git commit -m "feat(lobby-e2e): add config fixture and schema validation helpers"
```

---

## Chunk 2: Core Test Specs

### Task 3: Parameterized create-game spec

This is the main test. It reads config to determine which game creation mode to use, drives the lobby UI, captures the invite code and game ID, validates the manifest schema, writes the output JSON, and screenshots each step.

**Files:**
- Create: `apps/lobby/e2e/tests/create-game.spec.ts`

- [ ] **Step 1: Write the create-game spec**

Create `apps/lobby/e2e/tests/create-game.spec.ts`:

```typescript
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
  let inviteCode: string;
  let gameId: string;

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
        // Toggle to Dynamic — click the label, check the input
        const toggleLabel = page.locator('[data-testid="manifest-kind-toggle"]');
        const toggleInput = toggleLabel.locator('input[type="checkbox"]');
        if (!(await toggleInput.isChecked())) await toggleLabel.click();

        // ── Configure DynamicRulesetBuilder ──

        // Schedule preset
        const presetRadio = page.locator(`[data-testid="preset-${config.schedulePreset}"]`);
        await presetRadio.click({ force: true });

        // Start time
        if (config.startTime === 'now+2m' || config.startTime.startsWith('now+')) {
          const nowBtn = page.locator('[data-testid="start-time-now-btn"]');
          if (await nowBtn.isVisible()) {
            await nowBtn.click();
          } else {
            // For non-SPEED_RUN presets, set time manually
            const input = page.locator('[data-testid="start-time-input"]');
            const minutes = parseInt(config.startTime.replace('now+', '').replace('m', ''), 10) || 2;
            const soon = new Date(Date.now() + minutes * 60_000);
            const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
            await input.fill(local);
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

        // DM invite toggle (if requested)
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
    inviteCode = (await inviteCodeEl.textContent())!.trim();
    expect(inviteCode).toMatch(/^[A-Z0-9]{6}$/);

    await page.screenshot({ path: 'e2e/test-results/screenshots/create-complete.png' });

    // ── Extract game ID from status text ──
    const statusEl = page.locator('[data-testid="status-output"]');
    const statusText = await statusEl.textContent();
    // Strip trailing cursor character (_) from the animated span
    const match = statusText?.match(/GAME_CREATED:\s*([A-Za-z0-9_-]+)/);
    gameId = match?.[1] || '';
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

        // Write output JSON
        writeGameOutput({
          gameId,
          inviteCode,
          mode: config.mode,
          schedulePreset: config.mode === 'dynamic' ? config.schedulePreset : undefined,
          state,
          schemaErrors,
        });

        // Log validation results
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

    // Print output for the user
    console.log(`\nGame created: ${gameId}`);
    console.log(`Invite code: ${inviteCode}`);
    console.log(`Join URL: http://localhost:3000/join/${inviteCode}`);
    console.log(`State URL: http://localhost:8787/parties/game-server/${gameId}/state`);
    console.log(`Output: /tmp/pecking-order-lobby-game.json\n`);
  });
});
```

- [ ] **Step 2: Create screenshots directory**

```bash
mkdir -p apps/lobby/e2e/test-results/screenshots
```

- [ ] **Step 3: Commit**

```bash
git add apps/lobby/e2e/tests/create-game.spec.ts
git commit -m "feat(lobby-e2e): add parameterized create-game spec with schema validation"
```

---

### Task 4: Refactor join-qa.spec.ts to use config fixture

The existing `join-qa.spec.ts` hardcodes DEBUG mode. Refactor it to use the config fixture so it works with any game creation mode. Also extract the game creation into a dependency on `create-game.spec.ts` output.

**Files:**
- Modify: `apps/lobby/e2e/tests/join-qa.spec.ts`

- [ ] **Step 1: Rewrite join-qa.spec.ts**

Replace the entire file with a version that:
1. Reads the invite code from `/tmp/pecking-order-lobby-game.json` (written by create-game spec)
2. If no JSON exists, falls back to creating a game itself (using config)
3. Runs the 4-step join wizard
4. Uses `data-testid` selectors where available

```typescript
import fs from 'fs';
import { test, expect, authenticatePlayer } from '../fixtures/lobby-auth';
import { getTestConfig } from '../fixtures/lobby-config';

const config = getTestConfig();

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

    // Authenticate player 2 in a fresh context
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

    // Answer first 3 questions
    for (let i = 0; i < 3; i++) {
      const optionA = page.locator('button:has-text("A.")').first();
      await expect(optionA).toBeVisible({ timeout: 3_000 });
      await optionA.click();
      await page.waitForTimeout(500);
    }

    // Jump to last question and answer it
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/lobby/e2e/tests/join-qa.spec.ts
git commit -m "refactor(lobby-e2e): make join-qa config-driven, read invite code from output JSON"
```

---

## Chunk 3: Slash Command + Integration

### Task 5: Create the `/test-lobby` slash command

**Files:**
- Create: `.claude/commands/test-lobby.md`

- [ ] **Step 1: Create the slash command**

Create `.claude/commands/test-lobby.md`:

````markdown
Run lobby e2e tests with configurable game creation parameters. Drives the real lobby UI via Playwright, validates manifest schemas, and outputs usable game info.

## Usage

`/test-lobby [preset] [overrides...]`

### Presets

| Preset | What it does |
|--------|-------------|
| `smoke` (default) | Login only |
| `create-debug` | Create DEBUG game, validate manifest |
| `create-static` | Create CONFIGURABLE_CYCLE static game, validate manifest |
| `create-dynamic` | Create dynamic game (DynamicRulesetBuilder), validate ruleset |
| `join` | Create game + full join wizard (persona → bio → Q&A → confirm) |
| `full` | All creation modes + join |

### Overrides

General: `mode=debug|static|dynamic`, `days=N`, `vote=X`, `headed`, `headless`
Dynamic: `preset=DEFAULT|COMPACT|SPEED_RUN`, `start-time=now+Nm`, `vote-pool=X,Y`, `game-pool=X,Y`, `activity-pool=X,Y`, `dm-invite`, `max-players=N`, `max-days=N`, `dm-chars=N`, `dm-slots=N`, `dm-cost=N`

### Examples

```
/test-lobby create-dynamic preset=COMPACT
/test-lobby create-dynamic preset=SPEED_RUN start-time=now+2m dm-invite
/test-lobby join mode=dynamic preset=COMPACT
/test-lobby create-debug days=3 vote=BUBBLE
/test-lobby full headless
```

## Parameters: $ARGUMENTS

## Execution

Parse the preset and overrides from `$ARGUMENTS`, then run Playwright with the appropriate environment variables.

### Step 1: Parse arguments

Parse the first positional argument as the preset (default: `smoke`). Parse remaining `key=value` pairs and flags as overrides.

### Step 2: Determine scenarios and grep pattern

| Preset | Grep | Env: LOBBY_TEST_MODE |
|--------|------|---------------------|
| `smoke` | `@login` | (not set) |
| `create-debug` | `@create` | `debug` |
| `create-static` | `@create` | `static` |
| `create-dynamic` | `@create` | `dynamic` |
| `join` | `@create\|@join` | from `mode=` override or `debug` |
| `full` | (no grep — run all) | `debug` then `dynamic` |

### Step 3: Build environment variables

Map overrides to env vars:

| Override | Env var |
|----------|---------|
| `mode=X` | `LOBBY_TEST_MODE=X` |
| `days=N` | `LOBBY_TEST_DAYS=N` |
| `vote=X` | `LOBBY_TEST_VOTE=X` |
| `game=X` | `LOBBY_TEST_GAME=X` |
| `activity=X` | `LOBBY_TEST_ACTIVITY=X` |
| `preset=X` | `LOBBY_TEST_PRESET=X` |
| `start-time=X` | `LOBBY_TEST_START_TIME=X` |
| `vote-pool=X,Y` | `LOBBY_TEST_VOTE_POOL=X,Y` |
| `game-pool=X,Y` | `LOBBY_TEST_GAME_POOL=X,Y` |
| `activity-pool=X,Y` | `LOBBY_TEST_ACTIVITY_POOL=X,Y` |
| `dm-invite` | `LOBBY_TEST_DM_INVITE=1` |
| `max-players=N` | `LOBBY_TEST_MAX_PLAYERS=N` |
| `max-days=N` | `LOBBY_TEST_MAX_DAYS=N` |
| `dm-chars=N` | `LOBBY_TEST_DM_CHARS=N` |
| `dm-slots=N` | `LOBBY_TEST_DM_SLOTS=N` |
| `dm-cost=N` | `LOBBY_TEST_DM_COST=N` |
### Step 4: Run Playwright

```bash
cd apps/lobby && \
  LOBBY_TEST_MODE={mode} \
  LOBBY_TEST_PRESET={preset} \
  [... other env vars ...] \
  npx playwright test --config=e2e/playwright.config.ts \
  --grep "{grep_pattern}" \
  --headed
```

Omit `--headed` flag when `headless` override is set (for CI).

### Step 5: Report results

After Playwright completes:
1. Read `/tmp/pecking-order-lobby-game.json` if it exists
2. Report: invite code, join URL, schema validation results
3. Report: screenshot paths
4. Report: pass/fail summary

If Playwright fails, show the error output and suggest checking the HTML report at `apps/lobby/e2e/playwright-report/`.
````

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/test-lobby.md
git commit -m "feat: add /test-lobby slash command for parameterized lobby e2e tests"
```

---

### Task 6: Update Playwright config and existing tests

**Files:**
- Modify: `apps/lobby/e2e/playwright.config.ts`
- Modify: `apps/lobby/e2e/tests/login.spec.ts`

- [ ] **Step 1: Update playwright.config.ts — no config changes needed for headed mode**

The slash command will pass `--headed` flag on the CLI. Don't change the config default (stays headless for CI compatibility). The Playwright config only needs the screenshot directory setup — which is already handled by `outputDir: './test-results'`.

- [ ] **Step 2: Add @login tag to login.spec.ts**

Change `test.describe('Login Flow', () => {` to `test.describe('Login Flow @login', () => {`

- [ ] **Step 3: Run the full test suite to verify everything works**

Run: `cd apps/lobby && npx playwright test --config=e2e/playwright.config.ts --headed`

Expected: All tests pass (auth setup + login + create-game + join-qa).

- [ ] **Step 4: Commit**

```bash
git add apps/lobby/e2e/playwright.config.ts apps/lobby/e2e/tests/login.spec.ts
git commit -m "chore(lobby-e2e): add headed default, @login tag, screenshot config"
```

---

## Post-Implementation Notes

### Running the skill

```bash
/test-lobby create-dynamic preset=COMPACT    → create dynamic game, validate ruleset
/test-lobby join mode=dynamic                → create + join with Q&A
/test-lobby create-debug                     → simple debug game
/test-lobby smoke                            → login smoke test
```

### Output

After each game creation, check:
- `/tmp/pecking-order-lobby-game.json` — game info + schema validation results
- `apps/lobby/e2e/test-results/screenshots/` — step screenshots

### What's NOT in this plan (deferred)

- `admin.spec.ts` — admin page tests (need SUPER_ADMIN_IDS setup, separate task)
- `create-static` mode — the static CONFIGURABLE_CYCLE UI is complex (date pickers per event per day). Dynamic is the playtest priority.
- Pool chip toggling for games/activities — the create-game spec configures vote pool but leaves game/activity pools at UI defaults for now. Full pool override support is straightforward to add.
