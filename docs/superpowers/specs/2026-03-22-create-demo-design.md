# Create Demo — Showcase Server Design Spec

**Date**: 2026-03-22
**Status**: Approved
**Goal**: A publicly shareable, unauthenticated game sandbox for demonstrating client features to game designers and testers before playtests.

## Problem

Currently, demoing new client features (dilemmas, voting UI, mini-games) to game designers requires either:
- Running through the full lobby join flow and game lifecycle, or
- Using the existing `/demo` which only supports chat

We need a way to say "open this link, see the dilemma UI" with zero friction.

## Design

### Three Components

1. **`/create-demo` command** — Claude Code command that configures the showcase
2. **`ShowcaseServer` DO** — new Durable Object that hosts the sandbox
3. **`/showcase` client route** — renders vivid shell + admin panel overlay

### Persistent Singleton

One showcase game exists at all times. `/create-demo` reconfigures it in place. The URL never changes:
- Local: `http://localhost:5173/showcase`
- Staging: `https://staging-play.peckingorder.ca/showcase`

No new links to share when config changes — designer bookmarks once.

---

## Future Work: Typed SYNC Payload

All sync builders (`buildSyncPayload`, `buildDemoSyncPayload`, and the new showcase builder) return `any`. A shared `SyncPayload` type in `shared-types` would catch shape divergence at compile time. Deferred to post-playtest — for now the showcase sync builder follows `buildDemoSyncPayload()` directly.

---

## 1. `/create-demo` Command

**File**: `.claude/commands/create-demo.md`

### Usage

```
/create-demo <feature> [overrides...]
```

### Feature Presets

| Feature | What it enables | Default config |
|---------|----------------|----------------|
| `dilemma` | Dilemma cartridge UI | All 3 types: SILVER_GAMBIT, SPOTLIGHT, GIFT_OR_GRIEF |

Future features (not in v1): `voting`, `game`, `activity`, `chat`, `elimination`.

### Overrides

| Override | Format | Example |
|----------|--------|---------|
| `players=N` | 2-8 | `players=4` |
| `types=X,Y` | comma-separated | `types=SILVER_GAMBIT,SPOTLIGHT` |
| `env=X` | local/staging | `env=staging` (default: local) |

### Examples

```
/create-demo dilemma                              # All 3 dilemma types, 4 players, local
/create-demo dilemma types=SILVER_GAMBIT players=6 # Just Silver Gambit, 6 players
/create-demo dilemma env=staging                   # Configure staging showcase
```

### Script Behavior

1. Build config payload from feature + overrides
2. POST to `ShowcaseServer` at `/parties/showcase-server/SHOWCASE/configure`
3. DO resets state and re-initializes with new config
4. Connected clients receive updated config via WebSocket (live reload)
5. Print the showcase URL and config summary

### Output

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

### Config Payload

```typescript
interface ShowcaseConfig {
  features: string[];           // e.g. ['dilemma']
  players: number;              // roster size (default 4)
  dilemma?: {
    types: DilemmaType[];       // which dilemma types are available
  };
  // Future feature configs added here
}
```

---

## 2. ShowcaseServer DO

**Directory**: `apps/game-server/src/showcase/`

### Files

| File | Purpose |
|------|---------|
| `showcase-server.ts` | DO class (Server<Env>), HTTP + WebSocket handlers |
| `showcase-machine.ts` | Lightweight XState machine for showcase state |
| `showcase-seed.ts` | Roster builder — selects `config.players` personas from the same `PERSONA_POOL` used in `/create-game`, all `status: 'ALIVE'` |
| `showcase-sync.ts` | Builds SYNC payload for connected clients |

### Key Properties

- **Singleton**: Always uses ID `"SHOWCASE"`
- **No auth**: CORS open, no tokens required
- **No alarms/timeline**: Features triggered manually via admin panel
- **Config persistence**: Config is persisted to DO SQLite storage (not just in-memory) so it survives hibernation. On `onStart()`, restore config from SQLite and re-initialize the showcase machine. Pattern: `INSERT OR REPLACE INTO showcase_config (key, value) VALUES ('config', ?)`

### Round-Robin Player Assignment

Fixes the DemoServer bug where all connections get the same player:

```
nextSlot counter starts at 0
onConnect:
  playerId = `p${nextSlot % playerCount}`
  nextSlot++
  ws.setState({ playerId })
```

Each new WebSocket connection gets the next available player. Multiple connections can share a player if `nextSlot` wraps around (when more connections than players).

### HTTP Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST /configure` | Update showcase config, reset state | Called by `/create-demo` |
| `GET /config` | Return current config | Called by client on load |
| `POST /admin` | Trigger admin actions (start dilemma, force end, simulate player) | Called by client admin panel |

### WebSocket Protocol

- `onConnect`: Auto-assign player via round-robin, send initial SYNC
- `onMessage`: Forward allowed events to the showcase machine (dilemma submissions, chat if enabled)
- Broadcast: SYNC on every state change (same pattern as DemoServer)

### Admin Actions

Admin actions come via HTTP POST to `/admin` (from the client admin panel):

```typescript
// Start a dilemma
{ type: 'ADMIN.START_DILEMMA', dilemmaType: 'SILVER_GAMBIT' }

// Simulate a player's action
{ type: 'ADMIN.SIMULATE', playerId: 'p2', event: { type: 'DILEMMA.SILVER_GAMBIT.SUBMIT', action: 'DONATE' } }

// Force end current cartridge (translated to Events.Internal.END_DILEMMA for dilemma child)
{ type: 'ADMIN.FORCE_END' }

// Reset to idle (clear active cartridge)
{ type: 'ADMIN.RESET' }
```

### Showcase Machine

Lightweight XState machine — NOT the L2 orchestrator. Just enough to host cartridge actors:

```
States: idle → running → results → idle
```

- **idle**: Waiting for admin to trigger a feature
- **running**: A cartridge actor is spawned and active (e.g., dilemma machine collecting decisions)
- **results**: Cartridge completed, showing output. Admin can reset or start another.

The machine spawns real cartridge machines (e.g., `dilemma-machine.ts`) using the same input/output contracts as the real game. The client can't tell the difference.

#### XState v5 Requirements

1. **Register cartridge machines in `setup()`**: All dilemma machines must be registered in `setup({ actors: { ... } })` using the same keys as `DILEMMA_REGISTRY`. Required for snapshot restore (per CLAUDE.md: "Must register machine in setup... or snapshot restore fails").

2. **Handle `xstate.done.actor.activeDilemmaCartridge`**: When a cartridge reaches its final state, the parent receives `xstate.done.actor.{childId}` with the output. The child actor ID **must be `'activeDilemmaCartridge'`** (matching the real game's `l3-dilemma.ts`). The showcase machine handles this to transition from `running` → `results` and capture the output.

3. **Accept `Events.Fact.RECORD`**: Dilemma machines use `sendParent()` to emit fact events. The showcase machine must handle (or silently accept) these — they can be no-ops since there's no journal.

4. **Inject `senderId`**: When forwarding player events from WebSocket to the cartridge child, inject `senderId` from the WebSocket's assigned player identity (same as L1 does in the real game). For `ADMIN.SIMULATE`, unwrap the inner event and inject the specified `playerId` as `senderId` before forwarding to the child.

#### WebSocket Event Allowlist

Only forward these events from WebSocket messages to the showcase machine (with `senderId` injected):

```typescript
const ALLOWED_EVENTS = [
  Events.Dilemma.submit('SILVER_GAMBIT'),   // DILEMMA.SILVER_GAMBIT.SUBMIT
  Events.Dilemma.submit('SPOTLIGHT'),        // DILEMMA.SPOTLIGHT.SUBMIT
  Events.Dilemma.submit('GIFT_OR_GRIEF'),    // DILEMMA.GIFT_OR_GRIEF.SUBMIT
  // Future: voting, chat events added here per feature flag
];
```

### SYNC Payload

Use `buildDemoSyncPayload()` from `apps/game-server/src/demo/demo-sync.ts` as the base pattern — it already produces the correct `{ type, state, context: { ... } }` nesting that the client's Zustand store expects. There is no shared `SyncPayload` type; both `buildSyncPayload()` and `buildDemoSyncPayload()` return `any`.

The showcase sync builder (`showcase-sync.ts`) should:

1. **Start from the demo-sync template** — same `context` shape with all game-mechanic fields defaulted to safe values (`activeVotingCartridge: null`, etc.). The `state` field stays `'socialPeriod'` even when a dilemma is running — the client renders the `DilemmaCard` based on `activeDilemmaCartridge` being truthy, NOT the `state` field value.
2. **Add `activeDilemmaCartridge`** — use `projectDilemmaCartridge()` from `apps/game-server/src/projections.ts` to produce this field from the spawned dilemma child's snapshot. This ensures correct redaction (decisions hidden during COLLECTING, visible during REVEAL).
3. **Add `context.showcase`** — showcase-specific extension for the admin panel:
   ```typescript
   showcase: {
     config: ShowcaseConfig,                 // Feature flags for admin panel
     state: 'idle' | 'running' | 'results', // Admin panel state
     lastResults?: any,                      // Last completed cartridge output
   }
   ```
   The client ignores unknown `context` fields, so this is safe to add.

Note: `playerId` is NOT in the SYNC payload — the client sets it independently via `setPlayerId()` on initial connection.

### Wrangler Config

Add to `wrangler.toml` (all environments):

```toml
[[durable_objects.bindings]]
name = "SHOWCASE_SERVER"
class_name = "ShowcaseServer"
```

Add migration (next sequential tag after existing v1/v2):

```toml
[[migrations]]
tag = "v3"
new_sqlite_classes = ["ShowcaseServer"]
```

Export from `server.ts`:

```typescript
export { ShowcaseServer } from './showcase/showcase-server';
```

---

## 3. Client: `/showcase` Route

### Routing

In `App.tsx`, detect `/showcase` path alongside `/demo` and `/game/:code`:

```typescript
if (initialPath === '/showcase') {
  return <ShowcasePage />;
}
```

### ShowcasePage Component

**File**: `apps/client/src/pages/ShowcasePage.tsx`

1. Fetches config from `GET /parties/showcase-server/SHOWCASE/config`
2. Connects via `useGameEngine` with `party: 'showcase-server'`, `room: 'SHOWCASE'`
3. No auth — passes `playerId` from SYNC assignment
4. Renders `ShellLoader` with vivid shell + `ShowcaseAdminPanel` overlay

### ShowcaseAdminPanel Component

**File**: `apps/client/src/pages/ShowcaseAdminPanel.tsx`

A floating panel (vaul drawer or fixed sidebar) that appears over the vivid shell. Contents driven by `config.features`:

#### Dilemma Controls (when `features` includes `'dilemma'`)

- **Start Dilemma**: Button per available type (e.g., "Start Silver Gambit", "Start Spotlight", "Start Gift or Grief")
- **Player Simulation**: For each non-self player, a "Submit as Player X" dropdown with the relevant decision options:
  - SILVER_GAMBIT: DONATE / KEEP
  - SPOTLIGHT: target player picker
  - GIFT_OR_GRIEF: target player picker
- **Force End**: Ends the collecting phase immediately (triggers timeout resolution)
- **Reset**: Returns to idle, clears cartridge state

#### Status Display

- Current state: idle / running (which cartridge + phase) / results
- Connected players with their assigned personas
- Last results summary

### Admin Panel Interaction Flow

1. Designer clicks "Start Silver Gambit"
2. Client POSTs `{ type: 'ADMIN.START_DILEMMA', dilemmaType: 'SILVER_GAMBIT' }` to ShowcaseServer
3. DO spawns `silverGambitMachine` with roster
4. SYNC pushes `showcaseState: 'running'` + cartridge context
5. All connected clients see the dilemma UI (same components as real game)
6. Designer submits their own decision normally via the game UI
7. Designer simulates other players via admin panel "Submit as Player X"
8. Once all decisions in, dilemma resolves → `showcaseState: 'results'`
9. Designer sees results UI, can reset and try another type

---

## 4. Data Flow

```
/create-demo dilemma
       │
       ▼ POST /configure
  ShowcaseServer DO
       │ reset + re-init
       ▼ broadcast SYNC
  Client (/showcase)
       │ renders vivid shell + admin panel
       │
  Designer clicks "Start Silver Gambit"
       │ POST /admin
       ▼
  ShowcaseServer spawns dilemma machine
       │ broadcast SYNC (showcaseState: running)
       ▼
  All clients show dilemma UI
       │
  Designer submits decision (WebSocket)
  Designer simulates p1, p2, p3 (POST /admin)
       │
       ▼
  Dilemma resolves → results
       │ broadcast SYNC (showcaseState: results)
       ▼
  All clients show results UI
```

---

## 5. What's NOT in v1

- Voting feature module
- Mini-game feature module
- Activity/prompt feature module
- Chat (DemoServer already covers this)
- Elimination/night summary
- Schedule view
- Any authentication
- D1 integration

These are added incrementally by defining new feature configs and admin panel sections.

---

## 6. Future Consideration: Integration Testing

The ShowcaseServer's admin API (start cartridge, simulate players, read results) is naturally usable for programmatic integration testing without the ceremony of full game creation. This is noted as a future opportunity — the admin API will be designed to return structured responses suitable for assertion, but v1 focuses on the designer demo use case.

Testing hierarchy (not all addressed by this spec):
1. **Lobby tests** — manifest conforms to type specs (no client needed)
2. **Server/cartridge tests** — machine produces correct output (no lobby or client needed)
3. **Client tests** — UI renders correctly for a given state (no lobby or server lifecycle needed) — **ShowcaseServer sits here**

---

## 7. File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `apps/game-server/src/showcase/showcase-server.ts` | ShowcaseServer DO |
| `apps/game-server/src/showcase/showcase-machine.ts` | XState machine |
| `apps/game-server/src/showcase/showcase-seed.ts` | Roster builder |
| `apps/game-server/src/showcase/showcase-sync.ts` | SYNC payload builder |
| `apps/client/src/pages/ShowcasePage.tsx` | `/showcase` route page |
| `apps/client/src/pages/ShowcaseAdminPanel.tsx` | Admin panel overlay |
| `.claude/commands/create-demo.md` | Claude Code command |

### Modified Files

| File | Change |
|------|--------|
| `apps/game-server/src/server.ts` | Export ShowcaseServer |
| `apps/game-server/src/types.ts` | Add `SHOWCASE_SERVER: DurableObjectNamespace` to `Env` interface |
| `apps/game-server/wrangler.toml` | Add SHOWCASE_SERVER binding + migration (all envs) |
| `apps/client/src/App.tsx` | Add `/showcase` route detection |
