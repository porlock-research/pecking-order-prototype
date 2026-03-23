Configure the showcase server for feature demos. Creates a persistent, shareable game at `/showcase` with no auth required.

## Usage

`/create-demo [feature] [overrides...]`

### Features

| Feature | What it enables | Default config |
|---------|----------------|----------------|
| `dilemma` (default) | Dilemma cartridge UI | All 3 types: SILVER_GAMBIT, SPOTLIGHT, GIFT_OR_GRIEF |

### Overrides

| Override | Format | Example |
|----------|--------|---------|
| `players=N` | 2-8 | `players=4` |
| `types=X,Y` | comma-separated | `types=SILVER_GAMBIT,SPOTLIGHT` |
| `env=X` | local/staging | `env=staging` (default: local) |

### Examples

```
/create-demo                                       # dilemma, all 3 types, 4 players, local
/create-demo dilemma types=SILVER_GAMBIT players=6  # Just Silver Gambit, 6 players
/create-demo dilemma env=staging                    # Configure staging showcase
```

## Parameters: $ARGUMENTS

## Execution

Run a **single** Node.js script from the **monorepo root** (`/Users/manu/Projects/pecking-order`). The script does everything in one shot.

### Environments

**`env=local` (default):**
- Game server: `http://localhost:8787`
- Client: `http://localhost:5173`
- Requires `npm run dev` running locally

**`env=staging`:**
- Game server: `https://staging-api.peckingorder.ca`
- Client: `https://staging-play.peckingorder.ca`
- Links are shareable — anyone with the link can open `/showcase`

### Script structure

```javascript
async function main() {
  // --- Parse arguments ---
  const args = 'ARGS_VALUE'.split(/\s+/).filter(Boolean);
  let feature = 'dilemma';
  const overrides = {};

  for (const arg of args) {
    if (arg.includes('=')) {
      const [k, v] = arg.split('=', 2);
      overrides[k] = v;
    } else if (['dilemma'].includes(arg)) {
      feature = arg;
    }
  }

  const ENV = overrides.env || 'local';
  const PLAYER_COUNT = parseInt(overrides.players || '4', 10);

  const ENVS = {
    local: { gs: 'http://localhost:8787', client: 'http://localhost:5173' },
    staging: { gs: 'https://staging-api.peckingorder.ca', client: 'https://staging-play.peckingorder.ca' },
  };
  const env = ENVS[ENV] || ENVS.local;

  // --- Build config ---
  const ALL_DILEMMA_TYPES = ['SILVER_GAMBIT', 'SPOTLIGHT', 'GIFT_OR_GRIEF'];
  const dilemmaTypes = overrides.types ? overrides.types.split(',') : ALL_DILEMMA_TYPES;

  const config = {
    features: [feature],
    players: PLAYER_COUNT,
  };

  if (feature === 'dilemma') {
    config.dilemma = { types: dilemmaTypes };
  }

  // --- POST to ShowcaseServer ---
  const url = env.gs + '/parties/showcase-server/SHOWCASE/configure';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!r.ok) throw new Error('Configure failed: ' + r.status + ' ' + await r.text());

  // --- Output ---
  const typeList = config.dilemma ? config.dilemma.types.join(', ') : feature;
  console.log('Showcase configured: ' + feature + ' (' + typeList + ')');
  console.log(PLAYER_COUNT + ' players, ' + ENV);
  console.log('');
  console.log('Open: ' + env.client + '/showcase');
  if (ENV === 'staging') {
    console.log('Link is shareable — send to anyone for testing.');
  }
}
main().catch(e => { console.error(e); process.exit(1); });
```

Replace `ARGS_VALUE` with the raw `$ARGUMENTS` string.

## Output

Present results cleanly:

```
Showcase configured: dilemma (SILVER_GAMBIT, SPOTLIGHT, GIFT_OR_GRIEF)
4 players, local

Open: http://localhost:5173/showcase
```

For staging:
```
Showcase configured: dilemma (SILVER_GAMBIT)
6 players, staging

Open: https://staging-play.peckingorder.ca/showcase
Link is shareable — send to anyone for testing.
```

If the script fails:
- `env=local`: suggest `npm run dev`
- `env=staging`: check if staging is deployed
