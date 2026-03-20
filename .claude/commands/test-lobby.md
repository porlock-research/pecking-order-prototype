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
