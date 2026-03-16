Create a test game and return magic links for each player. Works against local dev servers or staging.

## Usage

`/create-game [preset] [overrides...]`

### Presets

| Preset | Players | Days | Mode | Schedule | Notes |
|--------|---------|------|------|----------|-------|
| `quick` (default) | 3 | 2 | ADMIN | manual inject | MAJORITY+FINALS, chat+DMs open |
| `speedrun` | 3 | 2 | PRE_SCHEDULED | SPEED_RUN | Full alarm pipeline, 23min/day, auto-advances |
| `big` | 6 | 3 | ADMIN | manual inject | MAJORITY x2 + FINALS |
| `invite` | 3 | 2 | ADMIN | manual inject | DM invite mode enabled |

### Overrides (append after preset)

| Override | Format | Examples |
|----------|--------|----------|
| `players=N` | number 2-8 | `players=4`, `players=6` |
| `days=N` | number 1-5 | `days=3` |
| `shell=X` | vivid/classic/immersive | `shell=classic` |
| `vote=X` | any VoteType | `vote=BUBBLE`, `vote=PODIUM_SACRIFICE` |
| `dm-invite` | flag (no value) | enables requireDmInvite |
| `env=X` | local/staging | `env=staging` (default: local) |
| `game=X` | any GameType | `game=TRIVIA`, `game=SEQUENCE` |
| `activity=X` | any PromptType | `activity=HOT_TAKE`, `activity=CONFESSION` |

### Examples

```
/create-game                          → 3 players, 2 days, vivid, MAJORITY+FINALS (local)
/create-game speedrun                 → speedrun with alarm pipeline (local)
/create-game speedrun players=5       → 5-player speedrun
/create-game big shell=classic        → 6 players, 3 days, classic shell
/create-game quick players=4 dm-invite → 4 players with DM invite mode
/create-game quick vote=BUBBLE        → BUBBLE voting instead of MAJORITY
/create-game speedrun env=staging     → create on staging, shareable links
/create-game big env=staging          → 6-player game on staging
```

## Parameters: $ARGUMENTS

## Execution

Run a **single** Node.js script from the **monorepo root** (`/Users/manu/Projects/pecking-order`). The script does everything in one shot.

### Environments

**`env=local` (default):**
- Game server: `http://localhost:8787`
- Client: `http://localhost:5173`
- Auth secret: `dev-secret-change-me`
- Requires `npm run dev` running locally

**`env=staging`:**
- Game server: `https://staging-api.peckingorder.ca`
- Client: `https://staging-play.peckingorder.ca`
- Auth secret: Read from `apps/game-server/.env.staging-secret` (single line, the AUTH_SECRET value). If file missing, prompt user to create it: `echo 'YOUR_STAGING_SECRET' > apps/game-server/.env.staging-secret`
- Links are shareable — anyone with the link can join
- `.env.staging-secret` MUST be gitignored (check before creating)

### Two scheduling modes

**ADMIN mode** (presets: `quick`, `big`, `invite`):
- Static manifest with `scheduling: 'ADMIN'`, empty `timeline` per day
- After creating + advancing to activeSession, inject `OPEN_GROUP_CHAT` + `OPEN_DMS`
- Days don't auto-advance — use NEXT_STAGE via admin API or `/test` skill

**SPEED_RUN mode** (preset: `speedrun`):
- Dynamic manifest with `scheduling: 'PRE_SCHEDULED'`, `schedulePreset: 'SPEED_RUN'`
- `startTime` = 30 seconds from now (gives time to open the link)
- `ruleset` includes voting sequence, social config, dayCount based on player count
- The alarm pipeline handles everything — days auto-advance on schedule
- Do NOT inject timeline events manually — the scheduler does it
- 23min/day, 3min gap between days

### Critical details

- **Working directory**: Must run from monorepo root for `@pecking-order/auth` to resolve
- **Auth**: `Authorization: Bearer {SECRET}` (secret depends on env)
- **Game ID**: `test-{timestamp}` — internal, used in API URLs
- **Invite code**: random alphanumeric 6 chars uppercase — used in client URL (client regex: `[A-Za-z0-9]+`, no dashes)
- **Client URL**: `{CLIENT_BASE}/game/{INVITE_CODE}?_t={TOKEN}&shell={SHELL}`
- **dayIndex is 1-indexed** (first day = 1)
- **Roster**: must have `isAlive: true` or players default to ELIMINATED
- **Token signing**: `signGameToken({ sub: 'u{i}', gameId, playerId: 'p{i}', personaName }, SECRET)`
- **Last day is always FINALS** when days > 1 (unless vote= override applies to all days)
- **Game types**: When `game=X` override provided, set `gameType` on all non-FINALS days
- **Activity types**: When `activity=X` override provided, set `activityType` on all non-FINALS days

### Real personas

Use real personas with staging avatar URLs. Shuffle randomly each game. Avatar URL: `https://staging-assets.peckingorder.ca/personas/{personaId}/headshot.png`

```javascript
const PERSONA_POOL = [
  { personaId: 'persona-01', name: 'Bella Rossi', stereotype: 'The Influencer', bio: 'Lives for the likes, dies for lack of Wi-Fi. Filters everything, including her personality.' },
  { personaId: 'persona-02', name: 'Chad Brock', stereotype: 'The Showmance', bio: 'Here to find love and maybe a protein shake. His shirt is allergic to his body.' },
  { personaId: 'persona-03', name: 'Sheila Bear', stereotype: 'The Momager', bio: "She didn't come to make friends; she came to make her daughter a star. Beware the clipboard." },
  { personaId: 'persona-04', name: 'Silas Vane', stereotype: 'The Backstabber', bio: 'Whispers lies into ears and smiles for the cameras. He has a knife for every back.' },
  { personaId: 'persona-05', name: 'Brick Thompson', stereotype: 'The Jock', bio: 'Winning is the only thing that matters. Losing makes him cry, but in a manly way.' },
  { personaId: 'persona-06', name: 'Kevin King', stereotype: 'The Conspiracy Theorist', bio: 'Believes the producers are lizards and the voting is rigged by ghosts. Wears a lot of tin foil.' },
  { personaId: 'persona-07', name: 'Penelope Pout', stereotype: 'The Crying Mess', bio: 'Everything is a tragedy. She can produce tears on command, and she usually does.' },
  { personaId: 'persona-08', name: 'Big Z', stereotype: 'The Zen Master', bio: 'Meditates through the screaming matches. He is one with the universe and the prize money.' },
  { personaId: 'persona-09', name: 'Brenda Burns', stereotype: 'The Villain', bio: "Needs to know everyone's secret. Knowledge is power, and she is a nuclear plant." },
  { personaId: 'persona-10', name: 'Arthur Penske', stereotype: 'The Superfan', bio: 'Has watched every episode twice. Knows your stats better than you do. Scary levels of prepared.' },
  { personaId: 'persona-11', name: 'Gary Grumble', stereotype: 'The Retired General', bio: 'Thinks this is a combat mission. Expects push-ups at 4 AM and total discipline.' },
  { personaId: 'persona-12', name: 'Luna Star', stereotype: 'The Quirky Artist', bio: 'Painted a mural on the bedroom wall with fruit juice. Just wants to express her soul.' },
  { personaId: 'persona-13', name: 'Jax Cash', stereotype: 'The Tech Bro', bio: 'Disrupting the game with algorithms. Thinks he is the smartest person in any room.' },
  { personaId: 'persona-14', name: 'Daisy Miller', stereotype: 'The Small Town Girl', bio: "Never left her county before this. Everything is amazing, even the betrayal." },
  { personaId: 'persona-15', name: 'Spike Spade', stereotype: 'The Professional Poker Player', bio: "Can't read his face, but can read your soul. Always has a hidden card." },
  { personaId: 'persona-16', name: 'Max Gainz', stereotype: 'The Gym Rat', bio: "If it's not a leg day, it's a bad day. His veins have veins." },
  { personaId: 'persona-17', name: 'Tiffany Jewel', stereotype: 'The Pageant Queen', bio: 'World peace is great, but a crown is better. Perfect hair, even in a hurricane.' },
  { personaId: 'persona-18', name: 'Evelyn Wise', stereotype: 'The Older Wisdom Figure', bio: 'Gives advice like a fortune cookie. Probably the most dangerous person here.' },
  { personaId: 'persona-19', name: 'Skyler Blue', stereotype: 'The Party Animal', bio: 'Started the party before the plane landed. Will probably get kicked off by episode three.' },
  { personaId: 'persona-20', name: 'Chet Baker', stereotype: 'The Over-Competitive Dad', bio: 'Treating the alliance like a PTA meeting. Nobody grills better than him.' },
  { personaId: 'persona-21', name: 'Baron Rich', stereotype: 'The Undercover Billionaire', bio: 'Pretending to be a janitor. Actually owns the network. Terrible at acting poor.' },
  { personaId: 'persona-22', name: 'Raven Thorne', stereotype: 'The Goth Rebel', bio: 'Hates everyone and everything. Only here to pay off her art school loans.' },
  { personaId: 'persona-23', name: 'Dirk Danger', stereotype: 'The Reality TV Legend', bio: 'Was on three other shows. Knows exactly where the cameras are at all times.' },
  { personaId: 'persona-24', name: 'Wally Wander', stereotype: 'The Clueless Tourist', bio: 'Has no idea what show he is on. Just happy to be included.' },
];
```

### Script structure

```javascript
const { signGameToken } = require('@pecking-order/auth');
const fs = require('fs');
const path = require('path');

// Environment config
const ENV = 'ENV_VALUE'; // 'local' or 'staging'
const ENVS = {
  local: {
    gs: 'http://localhost:8787',
    client: 'http://localhost:5173',
    secret: 'dev-secret-change-me',
  },
  staging: {
    gs: 'https://staging-api.peckingorder.ca',
    client: 'https://staging-play.peckingorder.ca',
    secret: (() => {
      try {
        return fs.readFileSync(path.join(__dirname, 'apps/game-server/.env.staging-secret'), 'utf8').trim();
      } catch {
        throw new Error('Missing apps/game-server/.env.staging-secret — create it with your staging AUTH_SECRET');
      }
    })(),
  },
};
const env = ENVS[ENV] || ENVS.local;
const GS = env.gs;
const SECRET = env.secret;
const CLIENT = env.client;
const HEADERS = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + SECRET };
const ASSETS = 'https://staging-assets.peckingorder.ca';

// PERSONA_POOL here

function shuffle(a) { for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

async function main() {
  const gameId = 'test-' + Date.now();
  const inviteCode = Math.random().toString(36).slice(2,8).toUpperCase();
  const personas = shuffle([...PERSONA_POOL]).slice(0, PLAYER_COUNT);

  // Build roster
  const roster = {};
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const p = personas[i];
    roster['p'+i] = {
      realUserId:'u'+i, personaName:p.name,
      avatarUrl: ASSETS+'/personas/'+p.personaId+'/headshot.png',
      bio:p.bio, isAlive:true, isSpectator:false, silver:50, gold:0, destinyId:''
    };
  }

  // ----- ADMIN mode -----
  if (IS_ADMIN) {
    const days = [];
    for (let d = 1; d <= DAY_COUNT; d++) {
      const isLast = d === DAY_COUNT;
      const day = { dayIndex: d, theme:'Day '+d, gameType: isLast ? 'NONE' : GAME_TYPE, activityType: isLast ? 'NONE' : ACTIVITY_TYPE, timeline:[] };
      day.voteType = (isLast && DAY_COUNT > 1) ? 'FINALS' : VOTE_TYPE;
      if (DM_INVITE) { day.requireDmInvite = true; day.dmSlotsPerPlayer = 3; }
      days.push(day);
    }
    const manifest = { kind:'STATIC', id:gameId, gameMode:'CONFIGURABLE_CYCLE', scheduling:'ADMIN', days };

    await post('/init', { roster, manifest, inviteCode });
    await post('/admin', { type:'NEXT_STAGE' }); // → activeSession
    await post('/admin', { type:'INJECT_TIMELINE_EVENT', action:'OPEN_GROUP_CHAT' });
    await post('/admin', { type:'INJECT_TIMELINE_EVENT', action:'OPEN_DMS' });
  }

  // ----- SPEED_RUN mode -----
  if (IS_SPEEDRUN) {
    const startTime = new Date(Date.now() + 30_000).toISOString(); // 30s from now
    const manifest = {
      kind: 'DYNAMIC',
      id: gameId,
      gameMode: 'CONFIGURABLE_CYCLE',
      scheduling: 'PRE_SCHEDULED',
      startTime,
      schedulePreset: 'SPEED_RUN',
      maxPlayers: PLAYER_COUNT,
      days: [], // Game Master resolves
      ruleset: {
        kind: 'PECKING_ORDER',
        voting: { mode: 'SEQUENCE', sequence: [VOTE_TYPE, 'FINALS'] },
        games: { mode: 'NONE', avoidRepeat: false },
        activities: { mode: 'NONE', avoidRepeat: false },
        social: {
          dmChars: { mode: 'FIXED', base: 1200 },
          dmPartners: { mode: 'FIXED', base: 3 },
          dmCost: 1,
          groupDmEnabled: true,
          requireDmInvite: DM_INVITE,
          dmSlotsPerPlayer: 5,
        },
        inactivity: { enabled: false, thresholdDays: 2, action: 'ELIMINATE' },
        dayCount: { mode: 'FIXED', value: DAY_COUNT },
      },
    };

    await post('/init', { roster, manifest, inviteCode });
    await post('/admin', { type:'NEXT_STAGE' }); // → activeSession, alarms scheduled
    // DO NOT inject events — alarm pipeline handles it
  }

  // Sign tokens + build output
  const players = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const p = personas[i];
    const tok = await signGameToken({sub:'u'+i,gameId,playerId:'p'+i,personaName:p.name},SECRET);
    const url = CLIENT + '/game/' + inviteCode + '?_t=' + tok + '&shell=' + SHELL;
    players.push({ id:'p'+i, name:p.name, stereotype:p.stereotype, bio:p.bio, token:tok, url });
  }

  // Write machine-readable JSON for Playwright / test skill consumption
  const testGame = {
    gameId, inviteCode, env: ENV, shell: SHELL,
    mode: IS_SPEEDRUN ? 'SPEED_RUN' : 'ADMIN',
    adminUrl: GS + '/parties/game-server/' + gameId + '/admin',
    stateUrl: GS + '/parties/game-server/' + gameId + '/state',
    secret: SECRET,
    players,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync('/tmp/pecking-order-test-game.json', JSON.stringify(testGame, null, 2));

  // Console output
  console.log('GAME_ID=' + gameId);
  console.log('INVITE_CODE=' + inviteCode);
  console.log('ENV=' + ENV);
  console.log('MODE=' + (IS_SPEEDRUN ? 'SPEED_RUN (auto-advancing, 23min/day)' : 'ADMIN (manual inject)'));
  console.log('---');
  for (const p of players) {
    console.log(p.name + ' (' + p.id + ') [' + p.stereotype + ']');
    console.log('  ' + p.url);
  }
  console.log('---');
  console.log('Wrote /tmp/pecking-order-test-game.json (for Playwright/test skill)');

  async function post(path, body) {
    const url = GS+'/parties/game-server/'+gameId+path;
    const r = await fetch(url, { method:'POST', headers:HEADERS, body:JSON.stringify(body) });
    if (!r.ok) throw new Error(path+' failed: '+r.status+' '+await r.text());
  }
}
main().catch(e => { console.error(e); process.exit(1); });
```

Replace the capitalized placeholders (PLAYER_COUNT, DAY_COUNT, VOTE_TYPE, GAME_TYPE, ACTIVITY_TYPE, DM_INVITE, SHELL, IS_ADMIN, IS_SPEEDRUN, ENV_VALUE) with parsed values from the preset + overrides. GAME_TYPE and ACTIVITY_TYPE default to `'NONE'`.

## Output

Present results cleanly:

```
Game created: test-{id} (invite: {CODE})
Env: local | Mode: ADMIN (manual inject)
3 players, 2 days, vivid shell

| Player | Persona | Link |
|--------|---------|------|
| p0 | Skyler Blue — The Party Animal | {CLIENT}/game/... |
| p1 | Bella Rossi — The Influencer | {CLIENT}/game/... |
| p2 | Chad Brock — The Showmance | {CLIENT}/game/... |
```

For speedrun mode, add a note:
```
Day 1 starts in ~30s. Timeline: chat opens at +0m, DMs at +2m, voting at +17m, day ends at +23m.
```

For staging, add:
```
Links are shareable — send to anyone for testing.
Admin API: https://staging-api.peckingorder.ca/parties/game-server/{GAME_ID}/admin
```

### Playwright integration

After game creation, `/tmp/pecking-order-test-game.json` contains all player tokens and URLs. To use with Playwright MCP:

```
1. Read /tmp/pecking-order-test-game.json
2. For each player: browser_navigate to their `url` field
3. Auth is handled automatically via the ?_t= token in the URL
```

The `/test` skill reads this file automatically — run `/create-game` first, then `/test` to use Playwright with the created game.

If the script fails:
- `env=local`: suggest `npm run dev`
- `env=staging`: check if `.env.staging-secret` exists and the secret is correct
