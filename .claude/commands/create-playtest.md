Create a real-flow playtest game on staging. Outputs `/invite/<token>` URLs that exercise the full lobby auth flow (scanner-defense, frictionless, persona pick) — for human playtesters or programmatic bots that walk the same path.

**Use this when:** you want invitees to experience what real users experience. Magic-link onboarding, persona pick, the lot.
**Use `/create-game` instead when:** you want pre-authed direct-play URLs for fast local iteration with synthetic players.

## Usage

`/create-playtest [preset] [overrides...]`

### Presets

| Preset | Players | Days | Schedule | Notes |
|--------|---------|------|----------|-------|
| `playtest` (default) | 8 | 7 | SMOKE_TEST | 5min/day, BUBBLE+EXECUTIONER rotation, game+activity pools |
| `smoketest` | 3 | 3 | SMOKE_TEST | Compact playtest variant |
| `speedrun` | 3 | 2 | SPEED_RUN | 23min/day, MAJORITY voting |

All presets are DYNAMIC + PRE_SCHEDULED — game starts at `startTime` via the alarm pipeline. **No host clicks "Start"**; alarms drive the lifecycle.

### Required overrides

| Override | Format | Notes |
|----------|--------|-------|
| `host=email` | email address | Recorded as `GameSessions.host_user_id`. Gets a Users row + InviteToken like everyone else. |
| `invitees=a,b,c` | comma-separated emails | Each gets a Users row + InviteToken. |

### Optional overrides

| Override | Format | Default | Notes |
|----------|--------|---------|-------|
| `env=X` | staging only | `staging` | `local` and `production` not supported. |
| `players=N` | number 3-8 | invitees.length + 1 | Must be ≥ invitees + 1. |
| `days=N` | number 1-10 | preset default | Overrides preset's day count. |
| `start=X` | `10m` or ISO timestamp | `10m` | When the game auto-starts. Past values clamp to "now + 30s" with a warning. |
| `email=X` | `none` or `resend` | `none` | `none` = print URLs only. `resend` = send invite emails via Resend (uses `RESEND_API_KEY` from `apps/game-server/.env.staging-secret-resend`). |

### Examples

```
/create-playtest host=porlock@porlock.co invitees=alice@example.com,bob@example.com
  → 8-player SMOKE_TEST, 7 days, 10min onboarding window, URLs printed (no email send)

/create-playtest smoketest host=porlock@porlock.co invitees=alice@x.com,bob@y.com,charlie@z.com
  → 3-player smoketest, fast end-to-end check on staging

/create-playtest host=porlock@porlock.co invitees=alice@x.com,bob@y.com start=20m
  → 20-minute onboarding window before alarms fire

/create-playtest host=porlock@porlock.co invitees=alice@x.com,bob@y.com email=resend
  → actually deliver invite emails via Resend
```

## Parameters: $ARGUMENTS

## Execution

Run a **single** Node.js script from the **monorepo root** (`/Users/manu/Projects/pecking-order`). The script does everything in one shot: lobby D1 inserts, game-server `/init`, optional Resend, then prints URLs.

**Place the script** at `scripts/tmp-create-playtest-<timestamp>.js` (inside the monorepo so workspace package resolution works), and run with `node scripts/tmp-create-playtest-<timestamp>.js` from the monorepo root.

### Environment

Only `staging` is supported. `local` is intentionally not — local dev should use `/create-game` (pre-auth, fast). `production` is never supported by this command.

- Lobby host: `https://staging-lobby.peckingorder.ca`
- Game server: `https://staging-api.peckingorder.ca`
- Lobby D1 (remote): `pecking-order-lobby-db-staging`
- Auth secret: read from `apps/game-server/.env.staging-secret` (single line). Fail loudly if missing — direct user to `echo 'YOUR_SECRET' > apps/game-server/.env.staging-secret`.
- Resend key (when `email=resend`): read from `apps/game-server/.env.staging-secret-resend` (single line). Fail with same instructions if missing.

### Critical: shell-safety pattern for `wrangler`

The script invokes `wrangler` to run D1 SQL against staging. **Always use `execFileSync` with array arguments**, never `exec` with a template-string. Inputs (emails, UUIDs, tokens) are quoted by SQL escaping, never by the shell.

```javascript
const { execFileSync } = require('child_process');

// CORRECT — argv array, no shell interpolation:
execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'pecking-order-lobby-db-staging',
   '--remote', '--env', 'staging', '--file', sqlFilePath],
  { cwd: lobbyDir, stdio: ['ignore', 'inherit', 'inherit'] },
);

// WRONG — shell interpolation, command-injection vector:
// execSync(`npx wrangler d1 execute ... --command "${userInput}"`)
```

Same principle for `Authorization: Bearer ${SECRET}` headers in `fetch()` — those are HTTP, no shell involved.

For SQL string values, escape via doubled single-quotes:

```javascript
const sq = (s) => "'" + String(s).replace(/'/g, "''") + "'";
```

### Lobby D1 writes

The script mirrors `apps/lobby/app/actions.ts` `createGame` + `sendEmailInvite` exactly. Two principles:

1. **Don't pre-create `Invites` slots.** DYNAMIC games create slots on-the-fly when invitees accept — see `acceptInvite` in `actions.ts:557-574`. Inserting empty slots upfront would diverge from the real lobby behavior.
2. **Lookup-or-create `Users` rows.** Host or invitee emails may already exist from prior magic-link logins; reuse those `Users.id`. Otherwise insert a new row with no `display_name` / `contact_handle` (those get set when the user accepts).

Single SQL file written by the script, run via `wrangler d1 execute --file=...`:

```sql
-- Lookup-or-insert Users (one statement per unique email — host + invitees)
INSERT OR IGNORE INTO Users (id, email, created_at) VALUES ('<userId1>', '<email1>', <now>);
INSERT OR IGNORE INTO Users (id, email, created_at) VALUES ('<userId2>', '<email2>', <now>);
-- … etc

-- Insert GameSessions (CONFIGURABLE_CYCLE = DYNAMIC mode)
INSERT INTO GameSessions
  (id, host_user_id, invite_code, mode, status, player_count, day_count, config_json, created_at)
VALUES
  ('<gameId>', '<hostUserId>', '<INVITE_CODE>', 'CONFIGURABLE_CYCLE', 'RECRUITING',
   <PLAYER_COUNT>, <DAY_COUNT>, NULL, <now>);

-- Insert one InviteTokens row per recipient (host + invitees).
-- expiry mirrors sendEmailInvite: (day_count*2 + 7) * 1d
INSERT INTO InviteTokens
  (token, email, game_id, invite_code, expires_at, used, sent_by, created_at)
VALUES
  ('<token1>', '<email1>', '<gameId>', '<INVITE_CODE>', <expiresAt>, 0, '<hostUserId>', <now>),
  ('<token2>', '<email2>', '<gameId>', '<INVITE_CODE>', <expiresAt>, 0, '<hostUserId>', <now>);
-- … etc
```

**Caveat on `INSERT OR IGNORE`:** `Users.id` is a UUID. If the email already exists, `INSERT OR IGNORE` skips the row and the script's preferred UUID is wasted. After the INSERT batch, run `SELECT id FROM Users WHERE email IN (...)` to recover the real `Users.id` per email. Use those for `GameSessions.host_user_id` + `InviteTokens.sent_by`.

The `SELECT` pattern via wrangler:

```javascript
const sql = "SELECT id, email FROM Users WHERE email IN (" + emails.map(sq).join(',') + ")";
const out = execFileSync('npx',
  ['wrangler', 'd1', 'execute', 'pecking-order-lobby-db-staging',
   '--remote', '--env', 'staging', '--json', '--command', sql],
  { cwd: lobbyDir, encoding: 'utf8' });
const parsed = JSON.parse(out);
const userIds = new Map(parsed[0].results.map(r => [r.email, r.id]));
```

### Game-server `/init`

After D1 writes succeed, POST to game-server `/init` with empty roster + DYNAMIC manifest. This mirrors `createGame`'s `dynamicManifestOverride` branch (`actions.ts:175-220`).

```javascript
const startTime = resolveStartTime(START_INPUT, now); // ISO string, future
const payload = {
  lobbyId: 'lobby-' + now,
  inviteCode: INVITE_CODE,
  roster: {},
  manifest: {
    kind: 'DYNAMIC',
    id: 'manifest-' + gameId,
    gameMode: 'CONFIGURABLE_CYCLE',
    scheduling: 'PRE_SCHEDULED',
    startTime,
    schedulePreset: SCHEDULE_PRESET, // 'SMOKE_TEST' or 'SPEED_RUN'
    minPlayers: 3,
    maxPlayers: PLAYER_COUNT,
    days: [],
    ruleset: RULESET, // see below
  },
};
const r = await fetch(GS + '/parties/game-server/' + gameId + '/init', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRET },
  body: JSON.stringify(payload),
});
if (!r.ok) throw new Error('/init failed: ' + r.status + ' ' + await r.text());
```

**Do not POST `/admin {type:'NEXT_STAGE'}` here.** DYNAMIC + PRE_SCHEDULED games auto-start when the `startTime` alarm fires — driving NEXT_STAGE manually short-circuits the alarm pipeline.

### Rulesets

Same shape as `/create-game`'s rulesets — lift them from `.claude/commands/create-game.md`. Per-preset:

- **playtest**: voting SEQUENCE `['BUBBLE','BUBBLE','EXECUTIONER','BUBBLE','BUBBLE','TRUST_PAIRS','FINALS']`, games POOL `['TRIVIA','SEQUENCE','REALTIME_TRIVIA']`, activities POOL `['HOT_TAKE','CONFESSION','PREDICTION','WOULD_YOU_RATHER']`, social DM 1200/3/cost-1/groupDM-on/no-invite/5-slots, dayCount FIXED.
- **smoketest**: voting SEQUENCE `['MAJORITY','FINALS']`, games POOL `['TRIVIA']`, activities POOL `['HOT_TAKE']`.
- **speedrun**: voting SEQUENCE `['MAJORITY','FINALS']`, games NONE, activities NONE.

### `start=` parsing

```javascript
function resolveStartTime(input, now) {
  if (!input) return new Date(now + 10 * 60_000).toISOString(); // default 10m
  const m = /^(\d+)(s|m|h)$/.exec(input);
  if (m) {
    const n = parseInt(m[1], 10);
    const ms = m[2] === 's' ? n * 1000 : m[2] === 'm' ? n * 60_000 : n * 3_600_000;
    return new Date(now + ms).toISOString();
  }
  const d = new Date(input);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid start=' + input + ' — expected like "10m", "2h", or ISO');
  }
  if (d.getTime() < now) {
    console.warn('start=' + input + ' is in the past; clamping to now + 30s');
    return new Date(now + 30_000).toISOString();
  }
  return d.toISOString();
}
```

### Optional Resend

When `email=resend`:

1. Read `apps/game-server/.env.staging-secret-resend` for the API key (separate from AUTH_SECRET).
2. For each invitee + host, call Resend's REST API with the invite email template. The lobby's `buildInviteEmail` lives at `apps/lobby/lib/email-templates.ts`. For phase 1, duplicate its key fields inline (subject + plain html with the `https://staging-lobby.peckingorder.ca/invite/<token>` link). If the template drifts, that's a known follow-up.
3. Track per-email send status in the output JSON (`emailSent: true | false`).

When `email=none` (default): skip Resend entirely. Print URLs to stdout. User forwards them however they want.

### Output

Write to `/tmp/pecking-order-playtest.json` (distinct from `/create-game`'s `/tmp/pecking-order-test-game.json` — different shape, different consumers):

```json
{
  "gameId": "game-1745...-123",
  "inviteCode": "ABC123",
  "env": "staging",
  "preset": "playtest",
  "schedulePreset": "SMOKE_TEST",
  "startTime": "2026-04-25T20:30:00Z",
  "playerCount": 8,
  "dayCount": 7,
  "host": {
    "email": "porlock@porlock.co",
    "userId": "uuid-here",
    "inviteToken": "64-hex",
    "inviteUrl": "https://staging-lobby.peckingorder.ca/invite/64-hex",
    "emailSent": false
  },
  "invitees": [
    {
      "email": "alice@example.com",
      "userId": "uuid-here",
      "inviteToken": "64-hex",
      "inviteUrl": "https://staging-lobby.peckingorder.ca/invite/64-hex",
      "emailSent": false
    }
  ],
  "shareUrl": "https://staging-lobby.peckingorder.ca/j/ABC123",
  "adminUrl": "https://staging-api.peckingorder.ca/parties/game-server/game-1745...-123/admin",
  "stateUrl": "https://staging-api.peckingorder.ca/parties/game-server/game-1745...-123/state",
  "secret": "<AUTH_SECRET>",
  "createdAt": "2026-04-25T20:20:00Z"
}
```

Console output:

```
Game created: game-1745…-123 (invite: ABC123)
Env: staging | Mode: DYNAMIC PRE_SCHEDULED (SMOKE_TEST)
8 players, 7 days
Start time: 2026-04-25T20:30:00Z (in 10 min)

Invite URLs (forward these to invitees, or use email=resend to deliver via Resend):

  Host    porlock@porlock.co
          https://staging-lobby.peckingorder.ca/invite/64hex…

  Invitee alice@example.com
          https://staging-lobby.peckingorder.ca/invite/64hex…

  Invitee bob@example.com
          https://staging-lobby.peckingorder.ca/invite/64hex…

Shareable URL (any new visitor → /j/CODE welcome flow):
  https://staging-lobby.peckingorder.ca/j/ABC123

Admin (game-server):
  https://staging-api.peckingorder.ca/parties/game-server/game-1745…-123/admin

State:
  https://staging-api.peckingorder.ca/parties/game-server/game-1745…-123/state

Wrote /tmp/pecking-order-playtest.json
```

### Critical details

- **Working directory:** Must run from monorepo root for `wrangler` to find its config and Node module resolution to find workspace packages.
- **Game ID:** `game-{Date.now()}-{Math.floor(Math.random()*1000)}` — matches `createGame`'s format.
- **Invite code:** 6 characters from the no-confusables alphabet `'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'` — matches `lib/auth.ts` `generateInviteCode`.
- **Invite token:** 32 random bytes hex-encoded (64 chars) — matches `lib/auth.ts` `generateToken`.
- **User UUIDs:** `crypto.randomUUID()` — matches `lib/auth.ts` `generateId`.
- **`Users.email` is the unique key.** `INSERT OR IGNORE` then `SELECT id WHERE email IN (...)` is the correct pattern.
- **DYNAMIC games never pre-create `Invites` slots.** Slots are created in `acceptInvite` when invitees claim. The skill's job ends at writing GameSessions + InviteTokens.
- **Don't INSERT `Sessions` rows for the host.** They click their own `/invite/<token>` URL like everyone else — exercises the same auth path.
- **DO NOT call `/admin {NEXT_STAGE}` after `/init`.** The alarm pipeline self-starts at `startTime`.

### What this command does NOT do

- Doesn't pre-create `Invites` slots (DYNAMIC creates them at accept time).
- Doesn't pre-claim personas (invitees pick their own).
- Doesn't insert `Sessions` rows (host clicks their invite URL like everyone else).
- Doesn't auto-call `/player-joined` (acceptInvite does this when invitees claim).
- Doesn't drive WebSocket — bots that want to programmatically connect should use a separate `claimInvite` helper (phase 2 follow-up: `scripts/lib/claimInvite.js` will walk an invite token through the full flow).

### Failure modes

- **Missing `.env.staging-secret`**: print clear instructions and exit non-zero.
- **`env=local` or `env=production`**: reject with explanation.
- **`players` < `invitees.length + 1`**: reject — clear user error.
- **`start=` in the past**: clamp to now + 30s, warn.
- **D1 write fails**: print the wrangler stderr and exit non-zero. Don't proceed to `/init`.
- **`/init` fails after D1 succeeded**: print error. The GameSessions row exists but the DO doesn't — manual cleanup needed (or re-attempt by calling `/init` directly with the same payload).

### Sanity check on first run

After the script prints URLs:

1. `curl -sI <host inviteUrl>` → expect `200` with `content-type: text/html` (the auto-submit confirm page from PR #128).
2. `curl -sI <shareUrl>` → expect `200` (the `/j/CODE` welcome form).
3. `curl -s <stateUrl> -H "Authorization: Bearer <secret>"` → expect JSON with the game's state.

If any of these fail, something diverged from the real lobby flow.
