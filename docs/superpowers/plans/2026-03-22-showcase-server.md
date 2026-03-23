# Showcase Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a publicly shareable, unauthenticated game sandbox for demonstrating client features (starting with dilemmas) to game designers.

**Architecture:** New `ShowcaseServer` Durable Object (singleton, ID `"SHOWCASE"`) with a lightweight XState machine that spawns real cartridge machines. Client renders vivid shell + admin panel overlay at `/showcase`. `/create-demo` Claude Code command configures the showcase via HTTP.

**Tech Stack:** Cloudflare Workers (PartyServer DO), XState v5, React 19 (Vite), Tailwind CSS, vaul (drawer)

**Spec:** `docs/superpowers/specs/2026-03-22-create-demo-design.md`

**Worktree:** `.worktrees/showcase-server` (branch `feature/showcase-server`)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `apps/game-server/src/showcase/showcase-seed.ts` | Build roster of N personas, all ALIVE |
| `apps/game-server/src/showcase/showcase-machine.ts` | XState machine: idle → running → results. Spawns real dilemma cartridges. |
| `apps/game-server/src/showcase/showcase-sync.ts` | Build per-player SYNC payload (follows demo-sync pattern) |
| `apps/game-server/src/showcase/showcase-server.ts` | DO class: HTTP handlers, WebSocket, round-robin player assignment |
| `apps/client/src/pages/ShowcasePage.tsx` | `/showcase` route — connects to ShowcaseServer, renders shell + admin panel |
| `apps/client/src/pages/ShowcaseAdminPanel.tsx` | Floating admin panel — dilemma controls, player simulation, status |
| `.claude/commands/create-demo.md` | Claude Code command to configure the showcase |

### Modified Files

| File | Change |
|------|--------|
| `apps/game-server/src/types.ts` | Add `SHOWCASE_SERVER: DurableObjectNamespace` to `Env` |
| `apps/game-server/src/server.ts` | Add `export { ShowcaseServer } from './showcase/showcase-server'` |
| `apps/game-server/wrangler.toml` | Add SHOWCASE_SERVER binding (local, staging, production) + v3 migration |
| `apps/client/src/App.tsx` | Add `/showcase` route detection |

---

## Task 1: Wrangler + Env Setup

**Files:**
- Modify: `apps/game-server/wrangler.toml`
- Modify: `apps/game-server/src/types.ts`
- Modify: `apps/game-server/src/server.ts`

- [ ] **Step 1: Add `SHOWCASE_SERVER` to Env interface**

In `apps/game-server/src/types.ts`, add after line 3 (`DEMO_SERVER`):

```typescript
SHOWCASE_SERVER: DurableObjectNamespace;
```

- [ ] **Step 2: Add DO binding + migration to wrangler.toml**

Add to local dev section (after line 24, after DEMO_SERVER binding):

```toml
[[durable_objects.bindings]]
name = "SHOWCASE_SERVER"
class_name = "ShowcaseServer"
```

Add migration after the v2 block (after line 13):

```toml
[[migrations]]
tag = "v3"
new_sqlite_classes = ["ShowcaseServer"]
```

Add to staging section (after line 65, after staging DEMO_SERVER binding):

```toml
[[env.staging.durable_objects.bindings]]
name = "SHOWCASE_SERVER"
class_name = "ShowcaseServer"
```

Add to production section (after line 101, after production DEMO_SERVER binding):

```toml
[[env.production.durable_objects.bindings]]
name = "SHOWCASE_SERVER"
class_name = "ShowcaseServer"
```

- [ ] **Step 3: Add placeholder export to server.ts**

In `apps/game-server/src/server.ts`, add after line 17 (`export { DemoServer }`):

```typescript
export { ShowcaseServer } from './showcase/showcase-server';
```

This will fail until Task 3 creates the file — that's expected.

- [ ] **Step 4: Commit**

```bash
git add apps/game-server/wrangler.toml apps/game-server/src/types.ts apps/game-server/src/server.ts
git commit -m "chore(game-server): add ShowcaseServer DO binding and Env type"
```

---

## Task 2: Showcase Seed

**Files:**
- Create: `apps/game-server/src/showcase/showcase-seed.ts`

- [ ] **Step 1: Create the roster builder**

```typescript
/**
 * Showcase Seed — builds a roster of N personas, all ALIVE.
 * Reuses the same persona pool as /create-game command.
 */
import type { SocialPlayer } from '@pecking-order/shared-types';
import { PlayerStatuses } from '@pecking-order/shared-types';

const PERSONA_POOL = [
  { personaId: 'persona-01', name: 'Bella Rossi', stereotype: 'The Influencer', bio: 'Lives for the likes, dies for lack of Wi-Fi.' },
  { personaId: 'persona-02', name: 'Chad Brock', stereotype: 'The Showmance', bio: 'Here to find love and maybe a protein shake.' },
  { personaId: 'persona-03', name: 'Sheila Bear', stereotype: 'The Momager', bio: "She didn't come to make friends; she came to make her daughter a star." },
  { personaId: 'persona-04', name: 'Silas Vane', stereotype: 'The Backstabber', bio: 'Whispers lies into ears and smiles for the cameras.' },
  { personaId: 'persona-05', name: 'Brick Thompson', stereotype: 'The Jock', bio: 'Winning is the only thing that matters.' },
  { personaId: 'persona-06', name: 'Kevin King', stereotype: 'The Conspiracy Theorist', bio: 'Believes the producers are lizards and the voting is rigged by ghosts.' },
  { personaId: 'persona-07', name: 'Penelope Pout', stereotype: 'The Crying Mess', bio: 'Everything is a tragedy. She can produce tears on command.' },
  { personaId: 'persona-08', name: 'Big Z', stereotype: 'The Zen Master', bio: 'Meditates through the screaming matches.' },
] as const;

const STAGING_ASSETS = 'https://staging-assets.peckingorder.ca';

function buildAvatarUrl(personaId: string, assetsBase: string): string {
  if (assetsBase.includes('/api/persona-image')) {
    return `${assetsBase}/${personaId}/headshot.png`;
  }
  return `${assetsBase}/personas/${personaId}/headshot.png`;
}

export function buildShowcaseRoster(
  playerCount: number,
  assetsBase: string = STAGING_ASSETS,
): Record<string, SocialPlayer> {
  const count = Math.min(Math.max(playerCount, 2), PERSONA_POOL.length);
  const roster: Record<string, SocialPlayer> = {};
  for (let i = 0; i < count; i++) {
    const p = PERSONA_POOL[i];
    roster[`p${i}`] = {
      id: `p${i}`,
      realUserId: `showcase-${p.personaId}`,
      personaName: p.name,
      avatarUrl: buildAvatarUrl(p.personaId, assetsBase),
      bio: `${p.stereotype} — ${p.bio}`,
      isAlive: true,
      isSpectator: false,
      status: PlayerStatuses.ALIVE,
      silver: 50,
      gold: 0,
      destinyId: '',
    } as SocialPlayer;
  }
  return roster;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/game-server/src/showcase/showcase-seed.ts
git commit -m "feat(showcase): add roster seed builder"
```

---

## Task 3: Showcase Machine

**Files:**
- Create: `apps/game-server/src/showcase/showcase-machine.ts`

Reference files:
- `apps/game-server/src/machines/cartridges/dilemmas/dilemma-machine.ts` — child machine contract
- `apps/game-server/src/machines/cartridges/dilemmas/_registry.ts` — DILEMMA_REGISTRY

- [ ] **Step 1: Create the showcase XState machine**

Uses `spawn()` for dynamic dilemma dispatch (not `invoke` — per CLAUDE.md, `invoke.src` with function is treated as callback actor). Follows the real L3 pattern from `apps/game-server/src/machines/actions/l3-dilemma.ts`.

```typescript
/**
 * Showcase Machine — lightweight harness for spawning real cartridge machines.
 *
 * States: idle → running → results → idle
 *
 * Uses spawn() for dilemma children (matching L3 pattern), NOT invoke.
 * XState v5: invoke.src with function = callback actor, not machine lookup.
 */
import { setup, assign, sendTo, enqueueActions, type AnyActorRef, type AnyEventObject } from 'xstate';
import { Events } from '@pecking-order/shared-types';
import type { DilemmaType, SocialPlayer } from '@pecking-order/shared-types';
import { DILEMMA_REGISTRY } from '../machines/cartridges/dilemmas/_registry';

// --- Types ---

export interface ShowcaseConfig {
  features: string[];
  players: number;
  dilemma?: { types: DilemmaType[] };
}

export interface ShowcaseContext {
  gameId: string;
  roster: Record<string, SocialPlayer>;
  config: ShowcaseConfig;
  lastResults: any;
  activeDilemmaCartridgeRef: AnyActorRef | null;
  activeDilemmaType: DilemmaType | null;
}

type ShowcaseEvent =
  | { type: 'ADMIN.START_DILEMMA'; dilemmaType: DilemmaType }
  | { type: 'ADMIN.FORCE_END' }
  | { type: 'ADMIN.RESET' }
  | { type: 'ADMIN.CONFIGURE'; config: ShowcaseConfig; roster: Record<string, SocialPlayer> }
  | { type: typeof Events.Fact.RECORD; [key: string]: any }
  | AnyEventObject;

// --- Machine ---

export const showcaseMachine = setup({
  types: {
    context: {} as ShowcaseContext,
    events: {} as ShowcaseEvent,
    input: {} as {
      gameId: string;
      roster: Record<string, SocialPlayer>;
      config: ShowcaseConfig;
    },
  },
  actors: {
    // Register all dilemma machines so XState can restore from snapshots
    ...DILEMMA_REGISTRY,
  },
}).createMachine({
  id: 'showcase',
  context: ({ input }) => ({
    gameId: input.gameId,
    roster: input.roster,
    config: input.config,
    lastResults: null,
    activeDilemmaCartridgeRef: null,
    activeDilemmaType: null,
  }),
  initial: 'idle',
  on: {
    // Accept fact events from children (no-op — no journal in showcase)
    [Events.Fact.RECORD]: {},
    // Reconfigure at any time
    'ADMIN.CONFIGURE': {
      target: '.idle',
      actions: [
        enqueueActions(({ enqueue, context }: any) => {
          if (context.activeDilemmaCartridgeRef) {
            enqueue.stopChild('activeDilemmaCartridge');
          }
        }),
        assign(({ event }: any) => ({
          config: event.config,
          roster: event.roster,
          lastResults: null,
          activeDilemmaCartridgeRef: null,
          activeDilemmaType: null,
        })),
      ],
    },
  },
  states: {
    idle: {
      on: {
        'ADMIN.START_DILEMMA': {
          target: 'running',
          guard: ({ event }) => event.dilemmaType in DILEMMA_REGISTRY,
          actions: assign({
            activeDilemmaCartridgeRef: ({ spawn, event, context }: any) =>
              (spawn as any)(event.dilemmaType, {
                id: 'activeDilemmaCartridge',
                input: {
                  dilemmaType: event.dilemmaType,
                  roster: context.roster,
                  dayIndex: 1,
                },
              }),
            activeDilemmaType: ({ event }: any) => event.dilemmaType,
          }),
        },
      },
    },
    running: {
      on: {
        'ADMIN.FORCE_END': {
          actions: sendTo('activeDilemmaCartridge', { type: 'INTERNAL.END_DILEMMA' }),
        },
        'xstate.done.actor.activeDilemmaCartridge': {
          target: 'results',
          actions: assign(({ event }: any) => ({
            lastResults: event.output,
            activeDilemmaCartridgeRef: null,
          })),
        },
      },
    },
    results: {
      on: {
        'ADMIN.RESET': {
          target: 'idle',
          actions: assign({ activeDilemmaType: null }),
        },
        'ADMIN.START_DILEMMA': {
          target: 'running',
          guard: ({ event }) => event.dilemmaType in DILEMMA_REGISTRY,
          actions: assign({
            activeDilemmaCartridgeRef: ({ spawn, event, context }: any) =>
              (spawn as any)(event.dilemmaType, {
                id: 'activeDilemmaCartridge',
                input: {
                  dilemmaType: event.dilemmaType,
                  roster: context.roster,
                  dayIndex: 1,
                },
              }),
            activeDilemmaType: ({ event }: any) => event.dilemmaType,
          }),
        },
      },
    },
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/game-server && npx tsc --noEmit 2>&1 | head -20`

Fix any type errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add apps/game-server/src/showcase/showcase-machine.ts
git commit -m "feat(showcase): add showcase XState machine with dilemma spawning"
```

---

## Task 4: Showcase Sync Builder

**Files:**
- Create: `apps/game-server/src/showcase/showcase-sync.ts`

Reference files:
- `apps/game-server/src/demo/demo-sync.ts` — template to follow
- `apps/game-server/src/projections.ts` — `projectDilemmaCartridge()`

- [ ] **Step 1: Create the sync payload builder**

Follow `buildDemoSyncPayload()` structure exactly. Add `activeDilemmaCartridge` via `projectDilemmaCartridge()` and `context.showcase` extension.

```typescript
/**
 * Showcase SYNC — builds per-player SYSTEM.SYNC payload.
 * Follows the demo-sync.ts pattern with dilemma cartridge support.
 */
import type { Connection } from 'partyserver';
import { Events } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { projectDilemmaCartridge } from '../projections';
import type { ShowcaseConfig } from './showcase-machine';

export interface ShowcaseSyncDeps {
  gameId: string;
  roster: Record<string, SocialPlayer>;
  config: ShowcaseConfig;
  showcaseState: string;  // 'idle' | 'running' | 'results'
  dilemmaChildSnapshot: any | null;  // Snapshot of the spawned dilemma actor
  lastResults: any;
}

export function buildShowcaseSyncPayload(
  deps: ShowcaseSyncDeps,
  playerId: string,
  onlinePlayers: string[],
): any {
  const { gameId, roster, config, showcaseState, dilemmaChildSnapshot, lastResults } = deps;

  // Project dilemma cartridge context for the client (redacted during COLLECTING)
  const activeDilemmaCartridge = dilemmaChildSnapshot
    ? projectDilemmaCartridge(dilemmaChildSnapshot.context)
    : null;

  return {
    type: Events.System.SYNC,
    state: 'socialPeriod',  // Client uses activeDilemmaCartridge presence to show DilemmaCard, not this field
    context: {
      gameId,
      dayIndex: 1,
      roster,
      manifest: {
        kind: 'STATIC' as const,
        id: `manifest-${gameId}`,
        gameMode: 'CONFIGURABLE_CYCLE',
        scheduling: 'ADMIN' as const,
        days: [{ dayIndex: 1, theme: 'Showcase', voteType: 'MAJORITY', gameType: 'NONE', timeline: [], requireDmInvite: false, dmSlotsPerPlayer: 5 }],
        pushConfig: {},
      },
      chatLog: [],
      channels: {
        MAIN: {
          id: 'MAIN',
          type: 'MAIN',
          memberIds: Object.keys(roster),
          createdBy: 'system',
          createdAt: Date.now(),
          capabilities: ['CHAT'],
          constraints: {},
        },
      },
      groupChatOpen: true,
      dmsOpen: false,
      activeVotingCartridge: null,
      activeGameCartridge: null,
      activePromptCartridge: null,
      activeDilemmaCartridge,
      winner: null,
      goldPool: 0,
      goldPayouts: [],
      gameHistory: [],
      completedPhases: [],
      dmStats: {
        charsUsed: 0,
        charsLimit: 1200,
        partnersUsed: 0,
        partnersLimit: 5,
        groupsUsed: 0,
        groupsLimit: 3,
        slotsUsed: 0,
      },
      playerActivity: Object.fromEntries(
        Object.keys(roster).map(pid => [pid, {
          messagesInMain: 0,
          dmPartners: 0,
          isOnline: onlinePlayers.includes(pid),
        }])
      ),
      onlinePlayers,
      // Showcase-specific extension (client ignores, admin panel reads)
      showcase: {
        config,
        state: showcaseState,
        lastResults,
      },
    },
  };
}

export function broadcastShowcaseSync(
  deps: ShowcaseSyncDeps,
  getConnections: () => Iterable<Connection>,
  connectedPlayers: Map<string, Set<string>>,
): void {
  const onlinePlayers = Array.from(connectedPlayers.keys());
  for (const ws of getConnections()) {
    const state = ws.state as { playerId: string } | null;
    const pid = state?.playerId || ws.deserializeAttachment()?.playerId;
    if (!pid) continue;
    ws.send(JSON.stringify(buildShowcaseSyncPayload(deps, pid, onlinePlayers)));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/game-server/src/showcase/showcase-sync.ts
git commit -m "feat(showcase): add SYNC payload builder following demo-sync pattern"
```

---

## Task 5: ShowcaseServer DO

**Files:**
- Create: `apps/game-server/src/showcase/showcase-server.ts`

Reference files:
- `apps/game-server/src/demo/demo-server.ts` — pattern to follow
- `apps/game-server/src/ws-handlers.ts` — `getOnlinePlayerIds`, `broadcastPresence`

- [ ] **Step 1: Create the ShowcaseServer DO**

```typescript
/**
 * ShowcaseServer — singleton Durable Object for feature demos.
 *
 * No auth, no alarms, no timeline. Spawns real cartridge machines
 * triggered via admin panel. Round-robin player assignment.
 */
import { Server, type Connection, type ConnectionContext } from 'partyserver';
import { createActor, type AnyActorRef } from 'xstate';
import { Events } from '@pecking-order/shared-types';
import type { DilemmaType } from '@pecking-order/shared-types';
import { showcaseMachine, type ShowcaseConfig } from './showcase-machine';
import { buildShowcaseRoster } from './showcase-seed';
import { buildShowcaseSyncPayload, broadcastShowcaseSync, type ShowcaseSyncDeps } from './showcase-sync';
import { getOnlinePlayerIds, broadcastPresence } from '../ws-handlers';
import type { Env } from '../types';

const DEFAULT_CONFIG: ShowcaseConfig = {
  features: ['dilemma'],
  players: 4,
  dilemma: { types: ['SILVER_GAMBIT', 'SPOTLIGHT', 'GIFT_OR_GRIEF'] as DilemmaType[] },
};

export class ShowcaseServer extends Server<Env> {
  static options = { hibernate: true };

  private actor: ReturnType<typeof createActor<typeof showcaseMachine>> | undefined;
  private connectedPlayers = new Map<string, Set<string>>();
  private nextSlot = 0;

  async onStart() {
    // Restore config from SQLite or use default
    const config = this.loadConfig() || DEFAULT_CONFIG;
    const roster = buildShowcaseRoster(config.players, this.env.PERSONA_ASSETS_URL);
    this.initActor(config, roster);
  }

  private initActor(config: ShowcaseConfig, roster: Record<string, any>) {
    // Stop existing actor if any
    if (this.actor) {
      this.actor.stop();
    }

    this.actor = createActor(showcaseMachine, {
      input: { gameId: 'SHOWCASE', roster, config },
    });
    this.actor.subscribe(() => {
      this.broadcastSync();
    });
    this.actor.start();
    this.nextSlot = 0;
  }

  // --- Config Persistence (SQLite) ---

  private loadConfig(): ShowcaseConfig | null {
    try {
      this.ctx.storage.sql.exec(
        `CREATE TABLE IF NOT EXISTS showcase_config (key TEXT PRIMARY KEY, value TEXT)`
      );
      const rows = this.ctx.storage.sql.exec(
        `SELECT value FROM showcase_config WHERE key = 'config'`
      ).toArray();
      if (rows.length > 0) {
        return JSON.parse(rows[0].value as string);
      }
    } catch { /* first boot — no table yet */ }
    return null;
  }

  private saveConfig(config: ShowcaseConfig) {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS showcase_config (key TEXT PRIMARY KEY, value TEXT)`
    );
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO showcase_config (key, value) VALUES ('config', ?)`,
      JSON.stringify(config),
    );
  }

  // --- Sync ---

  private buildSyncDeps(): ShowcaseSyncDeps {
    const snap = this.actor!.getSnapshot();
    const ctx = snap.context;
    const stateValue = typeof snap.value === 'string' ? snap.value : 'idle';

    // Get dilemma child snapshot if running
    let dilemmaChildSnapshot = null;
    if (stateValue === 'running') {
      const child = snap.children['activeDilemmaCartridge'] as AnyActorRef | undefined;
      if (child) {
        dilemmaChildSnapshot = child.getSnapshot();
      }
    }

    return {
      gameId: ctx.gameId,
      roster: ctx.roster,
      config: ctx.config,
      showcaseState: stateValue,
      dilemmaChildSnapshot,
      lastResults: ctx.lastResults,
    };
  }

  private broadcastSync() {
    broadcastShowcaseSync(
      this.buildSyncDeps(),
      () => this.getConnections(),
      this.connectedPlayers,
    );
  }

  // --- HTTP ---

  async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop() || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // POST /configure — update config, reset state
    if (req.method === 'POST' && path === 'configure') {
      const config = await req.json() as ShowcaseConfig;
      this.saveConfig(config);
      const roster = buildShowcaseRoster(config.players, this.env.PERSONA_ASSETS_URL);
      this.initActor(config, roster);
      this.broadcastSync();
      return Response.json({ ok: true, config }, { headers: corsHeaders });
    }

    // GET /config — return current config
    if (req.method === 'GET' && path === 'config') {
      const snap = this.actor!.getSnapshot();
      return Response.json({
        config: snap.context.config,
        roster: snap.context.roster,
        state: typeof snap.value === 'string' ? snap.value : 'idle',
      }, { headers: corsHeaders });
    }

    // POST /admin — trigger admin actions
    if (req.method === 'POST' && path === 'admin') {
      const action = await req.json() as any;
      return this.handleAdmin(action, corsHeaders);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  private handleAdmin(action: any, headers: Record<string, string>): Response {
    if (!this.actor) {
      return Response.json({ error: 'Not initialized' }, { status: 500, headers });
    }

    switch (action.type) {
      case 'ADMIN.START_DILEMMA':
        this.actor.send({ type: 'ADMIN.START_DILEMMA', dilemmaType: action.dilemmaType });
        break;

      case 'ADMIN.FORCE_END':
        this.actor.send({ type: 'ADMIN.FORCE_END' });
        break;

      case 'ADMIN.RESET':
        this.actor.send({ type: 'ADMIN.RESET' });
        break;

      case 'ADMIN.SIMULATE': {
        // Forward a player action as if it came from that player
        const snap = this.actor.getSnapshot();
        const child = snap.children['activeDilemmaCartridge'] as AnyActorRef | undefined;
        if (child) {
          child.send({ ...action.event, senderId: action.playerId });
          // Child state changed but parent didn't — manually broadcast
          this.broadcastSync();
        }
        break;
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400, headers });
    }

    return Response.json({ ok: true }, { headers });
  }

  // --- WEBSOCKET ---

  async onConnect(ws: Connection, ctx: ConnectionContext) {
    if (!this.actor) return;

    const snap = this.actor.getSnapshot();
    const playerCount = Object.keys(snap.context.roster).length;
    const playerId = `p${this.nextSlot % playerCount}`;
    this.nextSlot++;

    ws.setState({ playerId });
    ws.serializeAttachment({ playerId });

    // Track presence
    const existing = this.connectedPlayers.get(playerId) || new Set();
    existing.add(ws.id);
    this.connectedPlayers.set(playerId, existing);

    // Send initial SYNC
    const onlinePlayers = getOnlinePlayerIds(this.connectedPlayers);
    ws.send(JSON.stringify(buildShowcaseSyncPayload(this.buildSyncDeps(), playerId, onlinePlayers)));

    // Send player assignment
    ws.send(JSON.stringify({ type: 'SHOWCASE.PLAYER_ASSIGNED', playerId }));

    broadcastPresence(this.connectedPlayers, () => this.getConnections());
  }

  onClose(ws: Connection) {
    const state = ws.state as { playerId: string } | null;
    const playerId = state?.playerId || ws.deserializeAttachment()?.playerId;
    if (!playerId) return;

    const conns = this.connectedPlayers.get(playerId);
    if (conns) {
      conns.delete(ws.id);
      if (conns.size === 0) this.connectedPlayers.delete(playerId);
    }
    broadcastPresence(this.connectedPlayers, () => this.getConnections());
  }

  onMessage(ws: Connection, message: string) {
    if (!this.actor) return;

    try {
      const event = JSON.parse(message);
      const state = ws.state as { playerId: string } | null;
      const playerId = state?.playerId || ws.deserializeAttachment()?.playerId;
      if (!playerId) {
        ws.close(4001, 'Missing Identity');
        return;
      }

      // Re-set ws.state if lost after hibernation
      if (!state?.playerId) ws.setState({ playerId });

      // Forward allowed dilemma events to the child actor
      if (event.type?.startsWith('DILEMMA.')) {
        const snap = this.actor.getSnapshot();
        const child = snap.children['activeDilemmaCartridge'] as AnyActorRef | undefined;
        if (child) {
          child.send({ ...event, senderId: playerId });
          // Child state changed but parent didn't — manually broadcast
          this.broadcastSync();
        }
      }
    } catch { /* ignore malformed messages */ }
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/game-server && npx tsc --noEmit 2>&1 | head -30`

Fix any type errors. The server.ts export from Task 1 should now resolve.

- [ ] **Step 3: Commit**

```bash
git add apps/game-server/src/showcase/showcase-server.ts
git commit -m "feat(showcase): add ShowcaseServer DO with HTTP + WebSocket handlers"
```

---

## Task 6: Client — ShowcasePage + Route

**Files:**
- Create: `apps/client/src/pages/ShowcasePage.tsx`
- Modify: `apps/client/src/App.tsx`

Reference: `apps/client/src/pages/DemoPage.tsx` — pattern to follow

- [ ] **Step 1: Create ShowcasePage**

The ShowcaseServer assigns playerId server-side via round-robin and includes it in a `SHOWCASE.PLAYER_ASSIGNED` message sent immediately after WebSocket connect. Since `useGameEngine` doesn't handle this custom message type, we need to handle player assignment differently.

**Approach**: Use the WebSocket `query` param to let the server communicate the assigned player. The server assigns the player in `onConnect` and sends it in the initial SYNC. The client reads `playerId` from the first SYNC's `context.showcase` extension, then calls `setPlayerId()`.

However, `ShellLoader` requires `playerId` upfront to construct `useGameEngine`. So we use a two-phase approach: first fetch config to verify server is ready, then connect with a placeholder `playerId` (the server will assign the real one and the SYNC will set it in the store).

```tsx
import React, { useEffect, useState } from 'react';
import { ShellLoader } from '../shells/ShellLoader';
import { useGameStore } from '../store/useGameStore';

const GAME_SERVER_HOST = import.meta.env.VITE_GAME_SERVER_HOST || 'http://localhost:8787';

/**
 * Showcase page — connects to the persistent ShowcaseServer.
 * No auth. Player auto-assigned by server via round-robin.
 *
 * The server assigns a playerId on WebSocket connect and sends it
 * in the initial SYNC payload. We connect with playerId='p0' as
 * a placeholder — the server ignores client-provided playerId
 * and assigns via round-robin regardless.
 */
export default function ShowcasePage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function connect() {
      try {
        const host = new URL(GAME_SERVER_HOST).host;
        const protocol = GAME_SERVER_HOST.startsWith('https') ? 'https' : 'http';
        const res = await fetch(`${protocol}://${host}/parties/showcase-server/SHOWCASE/config`);
        if (!res.ok) {
          setError('Showcase not configured. Run /create-demo to set it up.');
          return;
        }
        setReady(true);
      } catch {
        setError('Could not reach the game server.');
      }
    }
    connect();
  }, []);

  if (error) {
    return (
      <div style={styles.container}>
        <p style={styles.error}>{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={styles.container}>
        <span style={styles.loadingText}>Loading showcase...</span>
      </div>
    );
  }

  // Connect with placeholder playerId — server assigns real one via round-robin
  // and sends it in the SYNC payload. useGameEngine's SYNC handler calls
  // setPlayerId() via the store, which is what the shell reads.
  // Note: this matches DemoPage pattern (DemoPage.tsx line 57).
  useGameStore.getState().setPlayerId('p0');
  return <ShellLoader gameId="SHOWCASE" playerId="p0" token={null} party="showcase-server" />;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#FDF8F0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    fontFamily: "'Quicksand', 'DM Sans', sans-serif",
  },
  loadingText: {
    fontSize: 14,
    color: '#9B8E7E',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
  },
  error: {
    fontSize: 15,
    color: '#E8614D',
  },
};
```

**Note on player assignment**: The server-side round-robin assigns the real playerId and sends SYNC scoped to that player. The `p0` placeholder is only used for the WebSocket connection query param. The SYNC payload's `context` will contain data for the server-assigned player. We'll need to handle the player ID mismatch — either:
- (a) Include `assignedPlayerId` in the `context.showcase` extension and have the admin panel read from there, OR
- (b) Send a `SHOWCASE.PLAYER_ASSIGNED` message and add a handler in `useGameEngine`'s `onMessage` to call `setPlayerId()`

Option (b) is cleaner. Add to the ShowcaseServer's `onConnect` (already in Task 5):
```typescript
ws.send(JSON.stringify({ type: 'SHOWCASE.PLAYER_ASSIGNED', playerId }));
```

And in ShowcasePage, add a custom `onMessage` handler via `useGameEngine` or handle it in the store. The simplest approach: add `SHOWCASE.PLAYER_ASSIGNED` handling directly in `useGameEngine.ts`'s `onMessage` callback. This is a one-line addition in the message handler switch.

- [ ] **Step 2: Add route detection in App.tsx**

In `apps/client/src/App.tsx`, add the lazy import after line 12 (`const DemoPage = ...`):

```typescript
const ShowcasePage = lazy(() => import('./pages/ShowcasePage'));
```

Add route detection. After the `isDemo` line (line 323), add:

```typescript
const isShowcase = initialPath === '/showcase';
```

Add to the skip condition in useEffect (line 333), change:

```typescript
if (isDemo || initialPath === '/dev/games') return;
```

to:

```typescript
if (isDemo || isShowcase || initialPath === '/dev/games') return;
```

Add the render block. After the `isDemo` render block (after line 531), add:

```tsx
if (isShowcase) {
  return (
    <Suspense fallback={null}>
      <ShowcasePage />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verify client builds**

Run: `cd apps/client && npx vite build 2>&1 | tail -10`

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/pages/ShowcasePage.tsx apps/client/src/App.tsx
git commit -m "feat(client): add /showcase route and ShowcasePage"
```

---

## Task 7: Client — ShowcaseAdminPanel

**Files:**
- Create: `apps/client/src/pages/ShowcaseAdminPanel.tsx`
- Modify: `apps/client/src/pages/ShowcasePage.tsx` (add admin panel overlay)

This task uses the `frontend-design` skill for the admin panel UI.

- [ ] **Step 1: Create the admin panel component**

The admin panel reads `showcase` data from the SYNC payload in the Zustand store. It renders dilemma controls based on `config.features` and `config.dilemma.types`.

Key functionality:
- POST to `{GAME_SERVER_HOST}/parties/showcase-server/SHOWCASE/admin` for admin actions
- "Start Dilemma" buttons — one per configured type
- "Submit as Player X" — dropdown per non-self player with decision options per dilemma type:
  - SILVER_GAMBIT: DONATE / KEEP
  - SPOTLIGHT: target player picker
  - GIFT_OR_GRIEF: target player picker
- "Force End" — sends `ADMIN.FORCE_END`
- "Reset" — sends `ADMIN.RESET`
- Status display: current state, connected players, last results

Use vivid shell styling (`--vivid-*` CSS variables, inline styles). Use `@solar-icons/react` icons with `weight="Bold"`. Use vaul `Drawer` for the panel.

- [ ] **Step 2: Integrate admin panel into ShowcasePage**

Update `ShowcasePage.tsx` to render `ShowcaseAdminPanel` alongside `ShellLoader`. The admin panel should float over the shell as a persistent overlay (not inside the shell's DOM tree — so use explicit hex values, not CSS variables, per the vaul portal note in CLAUDE.md).

- [ ] **Step 3: Verify client builds**

Run: `cd apps/client && npx vite build 2>&1 | tail -10`

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/pages/ShowcaseAdminPanel.tsx apps/client/src/pages/ShowcasePage.tsx
git commit -m "feat(client): add ShowcaseAdminPanel with dilemma controls"
```

---

## Task 8: `/create-demo` Command

**Files:**
- Create: `.claude/commands/create-demo.md`

Reference: `.claude/commands/create-game.md` — pattern to follow

- [ ] **Step 1: Create the command file**

The command parses `$ARGUMENTS` for feature preset + overrides, builds a config payload, POSTs to ShowcaseServer's `/configure` endpoint, and prints the showcase URL.

Follow the `/create-game` command structure:
- Parse first positional arg as feature (`dilemma`)
- Parse `key=value` overrides
- Build config JSON
- Run a Node.js script from monorepo root
- Environment handling: local vs staging (same as create-game)
- Print formatted output

See spec Section 1 for full details on presets, overrides, examples, and output format.

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/create-demo.md
git commit -m "feat: add /create-demo command for showcase configuration"
```

---

## Task 9: Integration Test — Manual Smoke Test

- [ ] **Step 1: Start dev servers**

Run: `npm run dev` (from monorepo root)

- [ ] **Step 2: Run `/create-demo dilemma`**

Verify it POSTs config and prints the URL.

- [ ] **Step 3: Open `http://localhost:5173/showcase` in browser**

Verify:
- Page loads without errors
- Vivid shell renders
- Admin panel is visible
- Player is auto-assigned (check console for `[WS] Connected`)

- [ ] **Step 4: Test dilemma flow via admin panel**

1. Click "Start Silver Gambit" in admin panel
2. Verify dilemma UI appears in the shell
3. Submit own decision via game UI
4. Simulate other players via admin panel
5. Verify results screen appears after all submissions
6. Click "Reset" and try another dilemma type

- [ ] **Step 5: Test round-robin player assignment**

Open a second browser tab to `/showcase`. Verify it gets a different player (`p1` instead of `p0`).

- [ ] **Step 6: Final build check**

Run: `cd apps/game-server && npx tsc --noEmit && cd ../client && npx vite build`

---

## Task Order & Dependencies

```
Task 1 (wrangler/env) ─────────────────────────────────────┐
Task 2 (seed) ──────────────────────────────────────────────┤
Task 3 (machine) ── depends on Task 2 (seed) ──────────────┤
Task 4 (sync) ── depends on Task 2, Task 3 ────────────────┤
Task 5 (server DO) ── depends on Tasks 1-4 ────────────────┤
Task 6 (client page + route) ── depends on Task 5 ─────────┤
Task 7 (admin panel) ── depends on Task 6 ─────────────────┤
Task 8 (create-demo command) ── independent ────────────────┤
Task 9 (smoke test) ── depends on all ─────────────────────►│
```

Tasks 1, 2, and 8 can run in parallel.
Task 3 depends on Task 2. Task 4 depends on Tasks 2 and 3.
