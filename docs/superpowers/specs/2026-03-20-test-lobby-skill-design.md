# `/test-lobby` Skill — Design Spec

## Purpose

A Claude Code slash command that drives the lobby UI via Playwright to create games with configurable parameters, validates that the resulting manifests and data conform to shared-types schemas, and outputs usable game info (invite code, links). Think of it as a UI-driven `/create-game` that also verifies the lobby produces architecturally correct output.

## Problem

The lobby UI has 3 distinct game creation paths (DEBUG, STATIC, DYNAMIC), each producing different manifest shapes. The Dynamic manifest path (DynamicRulesetBuilder) is the primary playtest path and is currently untested. There's no way to create a game through the real lobby UI and verify that what it sends to the game server conforms to shared-types schemas. The existing `/create-game` skill bypasses the lobby entirely (POSTs directly to the game server), so lobby UI bugs in manifest construction go undetected.

## Invocation

```
/test-lobby [preset] [overrides...]
```

## Presets

| Preset | Scenarios run | Game creation mode | Description |
|--------|--------------|-------------------|-------------|
| `smoke` (default) | login | n/a | Auth works, home page loads, no console errors |
| `create-debug` | login, create-game | DEBUG + STATIC | Simple game, verify basic manifest shape |
| `create-static` | login, create-game | CONFIGURABLE_CYCLE + STATIC | Day-by-day config with timestamps, verify scheduled manifest |
| `create-dynamic` | login, create-game | CONFIGURABLE_CYCLE + DYNAMIC | DynamicRulesetBuilder, verify ruleset + schedule preset |
| `join` | login, create-game, join-wizard | per `mode=` override (default: debug) | Full join flow: persona select → bio → Q&A → confirm → waiting room |
| `admin` | login, admin | n/a | Admin dashboard, game detail tabs, tools, personas pages load without errors |
| `full` | all | all 3 modes | Every scenario in sequence |

## Overrides

### General

| Override | Format | Default | Applies to | Examples |
|----------|--------|---------|-----------|----------|
| `mode=X` | `debug` / `static` / `dynamic` | per preset | create-*, join | `mode=dynamic` |
| `days=N` | 1-10 | 2 | create-debug, create-static | `days=3` |
| `vote=X` | any VoteType | MAJORITY | create-debug, create-static | `vote=BUBBLE` |
| `game=X` | any GameType | NONE | create-debug, create-static | `game=TRIVIA` |
| `activity=X` | any PromptType | NONE | create-debug, create-static | `activity=HOT_TAKE` |
| `headed` | flag | **on** (default) | all | show browser window |
| `headless` | flag | off | all | CI mode, no browser |
| `scenario=X,Y` | comma list | per preset | all | `scenario=login,admin` |

### Dynamic-specific

| Override | Format | Default | Examples |
|----------|--------|---------|----------|
| `preset=X` | DEFAULT / COMPACT / SPEED_RUN | COMPACT | `preset=SPEED_RUN` |
| `vote-pool=X,Y` | comma list of VoteTypes | UI defaults (all 7 types) | `vote-pool=BUBBLE,EXECUTIONER,TRUST_PAIRS,FINALS` |
| `game-pool=X,Y` | comma list of GameTypes | TRIVIA,SEQUENCE | `game-pool=TRIVIA,REALTIME_TRIVIA` |
| `activity-pool=X,Y` | comma list of PromptTypes | HOT_TAKE,CONFESSION | `activity-pool=HOT_TAKE,PREDICTION` |
| `dm-invite` | flag | off | enables requireDmInvite in ruleset |
| `max-players=N` | 2-8 | 8 | `max-players=6` |
| `max-days=N` | 2-14 | 7 | `max-days=5` |
| `start-time=X` | `now+Nm` or datetime-local | UI default (tomorrow 9am) | `start-time=now+2m` |
| `dm-chars=N` | 50-2000 | 300 | `dm-chars=600` |
| `dm-slots=N` | 1-10 | 3 | `dm-slots=5` |
| `dm-cost=N` | 0-20 | 1 | `dm-cost=0` |
| `inactivity` | flag | on | toggles auto-eliminate (off = disabled) |

## Examples

```
/test-lobby                                         → smoke (login only)
/test-lobby join                                    → join flow, DEBUG mode, 2 days
/test-lobby join mode=dynamic preset=COMPACT         → create dynamic game + join it
/test-lobby create-debug days=3 vote=BUBBLE         → DEBUG game, 3 days, BUBBLE voting
/test-lobby create-static days=7                    → CONFIGURABLE_CYCLE static, 7 days
/test-lobby create-dynamic preset=SPEED_RUN dm-invite → dynamic SPEED_RUN with DM invites
/test-lobby create-dynamic vote-pool=BUBBLE,EXECUTIONER,TRUST_PAIRS,FINALS
/test-lobby admin                                   → admin pages only
/test-lobby full                                    → everything
/test-lobby full headless                           → everything in CI mode
/test-lobby scenario=login,admin                    → custom combo
```

## Scenarios

### `login`

1. Navigate to `/login`
2. Enter test email, submit
3. Dev mode: magic link appears, click it
4. Verify redirect to `/`, "Create Game" visible
5. Screenshot: `login-complete.png`

Also tests unauthenticated redirect (fresh context → `/join/FAKE` → redirects to `/login`).

### `create-game`

Behavior depends on `mode=`:

**`debug` (DEBUG_PECKING_ORDER + STATIC manifest):**
1. Select DEBUG_PECKING_ORDER from mode dropdown
2. Ensure "Static" manifest kind is selected (toggle if needed)
3. Configure days, vote types, game types per day (from overrides)
3. Click "Create Game"
4. Capture invite code
5. **Schema validation**: Fetch game state from `/parties/game-server/{id}/state`, validate response structure
6. Screenshot: `create-debug-complete.png`

**`static` (CONFIGURABLE_CYCLE + STATIC manifest):**
1. Select CONFIGURABLE_CYCLE from mode dropdown
2. Ensure "Static" manifest kind is selected
3. Configure day count, vote/game/activity types (from overrides)
4. Click "Create Game"
5. Capture invite code
6. **Schema validation**: Fetch game state, validate manifest has `scheduling: 'PRE_SCHEDULED'`, correct day count, correct vote/game/activity per day
7. Screenshot: `create-static-complete.png`

**`dynamic` (CONFIGURABLE_CYCLE + DYNAMIC manifest):**
1. Select CONFIGURABLE_CYCLE from mode dropdown
2. Toggle to "Dynamic" manifest kind
3. Configure DynamicRulesetBuilder (all within collapsible `<details>` Sections):
   - **Schedule** (Section, default open): Select preset radio (Default / Compact / Speed Run). Verify timeline preview updates. The preset controls day pacing:
     - DEFAULT: full-day (9am-midnight, ~15hr/day)
     - COMPACT: compressed (9am-5:30pm, ~8.5hr/day)
     - SPEED_RUN: minutes apart (~23min/day, for testing)
   - **Start Time** (Section, default open): Set via `datetime-local` input. For SPEED_RUN, a "Set to now + 2 min" button appears.
   - **Vote Types** (Section, default open): ChipCheckbox grid — toggle individual vote types on/off. At least 1 required. FINALS is always auto-appended on last day. Each chip shows min player requirement.
   - **Games** (Section): ChipCheckbox grid by category (arcade/knowledge/social). Can deselect all to disable games entirely. "Select all" / "Clear all" toggle.
   - **Activities** (Section): ChipCheckbox grid. Can deselect all to disable activities.
   - **Social Rules** (Section): NumberSteppers for DM chars (50-2000, step 50), DM slots (1-10), silver per DM (0-20). Toggle for "Require DM invitations" — when on, shows DM conversations-per-player stepper (2-10).
   - **Day Count** (Section): MaxDays NumberStepper (2-14). Actual days = active players - 1, capped at max.
   - **Inactivity** (Section): Toggle for auto-eliminate + threshold days stepper (1-5).
4. Click "Create Game"
5. Capture invite code
6. **Schema validation**: Fetch game state, validate:
   - Manifest has `kind: 'DYNAMIC'`, `scheduling: 'PRE_SCHEDULED'`
   - `schedulePreset` matches selected value
   - `startTime` is a valid ISO timestamp
   - `ruleset` structure matches `PeckingOrderRuleset` shape: voting.allowed, games.allowed, activities.allowed, social config, dayCount, inactivity
   - `days: []` is empty (Game Master resolves at runtime)
7. Screenshot: `create-dynamic-complete.png`

### `join-wizard`

Requires a game to exist (runs `create-game` first if needed).

1. Authenticate player 2 in fresh browser context
2. Navigate to `/join/{inviteCode}`
3. **Step 1 — Persona Select**: Wait for carousel, verify thumbnails load, click "Lock In"
4. **Step 2 — Bio**: Verify pre-filled bio, click "Continue"
5. **Step 3 — Q&A**: Verify 10 questions, answer a few, click "Continue"
6. **Step 4 — Confirm**: Verify persona + bio displayed, click "Join Game"
7. Verify redirect to waiting room
8. **Schema validation**: Verify the Invites D1 record has valid `qa_answers` JSON (conforms to `QaEntrySchema[]`) by calling a lobby server action or API. Note: the game-server `/state` endpoint returns a summary roster that strips `qaAnswers`, so D1 is the validation source for Q&A data
9. Screenshots: `join-step1.png`, `join-step2.png`, `join-step3-qa.png`, `join-step4-confirm.png`, `join-waiting.png`

### `admin`

1. Navigate to `/admin` (requires super-admin session)
2. Verify games list loads
3. If games exist, click into a game detail page
4. Verify all tabs render without errors (Overview, Timeline, GM Chat, Journal, Inspector, Raw State)
5. Navigate to `/admin/tools`, `/admin/personas`, `/admin/inspector` — verify they load
6. Screenshots: `admin-games.png`, `admin-detail.png`, `admin-tools.png`, `admin-inspector.png`

Note: Admin requires `isSuperAdmin()` to pass. In dev mode, this checks the `SUPER_ADMIN_IDS` env var against the session's `userId`. Tests need the authenticated user's D1 user ID to be in that list, or admin tests will be skipped with a warning. The auth setup fixture should capture and expose the user ID for this purpose.

## Schema Validation

After key UI actions, the skill validates data correctness:

| Action | What to validate | Schema / shape |
|--------|-----------------|----------------|
| Create game (any mode) | Game state response | Manifest structure matches mode (STATIC/DYNAMIC) |
| Create game (dynamic) | Ruleset in manifest | Matches `PeckingOrderRuleset` shape from shared-types |
| Create game (static) | Day configs | Each day has valid voteType, gameType, activityType |
| Join game | Invite record | `qa_answers` is valid JSON matching `QaEntrySchema[]` |
| Join game | Roster in game state | Summary roster has player entry (note: `/state` strips `qaAnswers` — D1 invite record is the Q&A validation source) |

Validation is done by fetching the game-server state endpoint (`/parties/game-server/{id}/state`) after each action, using the dev auth secret. Schema checks are assertions within the Playwright tests — failures are test failures.

## Architecture

### Files

```
.claude/commands/test-lobby.md           — Slash command definition (parses args, runs tests)
apps/lobby/e2e/
├── playwright.config.ts                 — Already exists, may need minor updates
├── fixtures/
│   ├── lobby-auth.ts                    — Already exists (auth + console errors)
│   └── lobby-config.ts                  — NEW: reads env vars, exposes test config
├── tests/
│   ├── auth.setup.ts                    — Already exists
│   ├── login.spec.ts                    — Already exists, add @login tag
│   ├── create-game.spec.ts              — NEW: parameterized game creation (debug/static/dynamic)
│   ├── join-qa.spec.ts                  — Already exists, refactor to read config + add @join tag
│   ├── admin.spec.ts                    — NEW: admin page tests
│   └── schema-validation.ts             — NEW: shared helpers for fetching game state + Zod validation
```

### Data Flow

1. User invokes `/test-lobby join mode=dynamic preset=SMOKE_TEST`
2. Skill parses args into env vars: `LOBBY_TEST_SCENARIOS=login,create-game,join-wizard`, `LOBBY_TEST_MODE=dynamic`, `LOBBY_TEST_PRESET=SMOKE_TEST`, etc.
3. Skill runs: `cd apps/lobby && LOBBY_TEST_MODE=dynamic LOBBY_TEST_PRESET=SMOKE_TEST npx playwright test --config=e2e/playwright.config.ts --grep @login|@create|@join --headed`
4. `lobby-config.ts` fixture reads env vars, exposes typed config object to tests
5. Tests use config to drive UI interactions (which dropdown to select, which checkboxes to toggle)
6. After key actions, tests call schema validation helpers to fetch game state and run Zod checks
7. Screenshots captured at each step milestone

### Config Fixture (`lobby-config.ts`)

Reads environment variables set by the slash command and exposes a typed config:

```typescript
interface LobbyTestConfig {
  mode: 'debug' | 'static' | 'dynamic';
  days: number;
  vote: string;
  game: string;
  activity: string;
  // Dynamic-specific
  schedulePreset: 'DEFAULT' | 'COMPACT' | 'SPEED_RUN';
  startTime: string;        // 'now+2m' or datetime-local string
  votePool: string[];
  gamePool: string[];
  activityPool: string[];
  maxPlayers: number;
  maxDays: number;
  // Social config
  dmInvite: boolean;
  dmChars: number;
  dmSlots: number;
  dmCost: number;
  // Inactivity
  inactivityEnabled: boolean;
}
```

Tests import this config and use it to drive their UI interactions. When env vars aren't set (e.g., running Playwright directly), sensible defaults apply.

## Output

Every run that creates a game outputs usable game info:

1. **Console output** — invite code, game ID, mode, and player join link (`/join/{code}`)
2. **JSON file** → `/tmp/pecking-order-lobby-game.json` containing:
   ```json
   {
     "gameId": "...",
     "inviteCode": "XCJHJR",
     "mode": "dynamic",
     "schedulePreset": "COMPACT",
     "joinUrl": "http://localhost:3000/join/XCJHJR",
     "stateUrl": "http://localhost:8787/parties/game-server/{id}/state",
     "manifest": { ... },
     "schemaValidation": { "manifest": "pass", "ruleset": "pass" },
     "createdAt": "2026-03-20T..."
   }
   ```
3. **Screenshots** at key steps → `apps/lobby/e2e/test-results/screenshots/`

This means after `/test-lobby create-dynamic preset=SPEED_RUN`, you have a real game created through the lobby UI, validated against schemas, with a join link you can share.

## Artifacts

Every run also produces:
- **Schema validation report** → inline pass/fail per check in test output
- **Console error summary** → any non-ignored console errors cause test failure
- **Playwright HTML report** → `apps/lobby/e2e/playwright-report/` (on failure, for debugging)

## Prerequisites

- `npm run dev` running (lobby :3000 + game-server :8787), OR let Playwright webServer config start them
- D1 migration 0008 applied locally (`npx wrangler d1 migrations apply pecking-order-lobby-db-local --local`)
- For admin tests: `SUPER_ADMIN_IDS` env var includes the test user's D1 user ID

## Implementation Notes

- **Selectors**: The lobby UI currently lacks `data-testid` attributes. Implementation should add `data-testid` to key interactive elements (mode dropdown, manifest kind toggle, DynamicRulesetBuilder pool chips, schedule preset radios, create button, invite code display) to make tests resilient to CSS class changes. Text-based selectors are acceptable for labels that are semantically stable (e.g., "Create Game", "Lock In").
- **Game/activity defaults**: The `game=` and `activity=` overrides default to `NONE`, but the UI defaults for DEBUG mode are `TRIVIA` and `PLAYER_PICK`. When overrides aren't specified, tests should accept whatever the UI defaults produce rather than forcing NONE.

## Out of Scope

- Game client testing (separate `e2e/` suite)
- Game server logic testing (Vitest unit tests)
- Push notification testing
- Email delivery testing (Resend)
- Staging/production testing (local dev only for now)
- Mobile viewport testing (future)
