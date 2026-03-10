# Demo Game Rearchitecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Isolate the demo game into its own `DemoServer` Durable Object, use real personas, serve a pre-seeded mid-game SYNC payload, and remove all demo code from the main `GameServer`.

**Architecture:** Separate `DemoServer extends Server<Env>` with its own wrangler binding (`demo-server` party). The demo machine handles only chat/silver events. A seed module produces a mid-game fixture (day 3 of 5, 2 eliminated players, completed phases). The demo SYNC payload is structurally identical to a real game's. All `isDemoMode`/`demoActor` references are removed from `GameServer`, `ws-handlers.ts`, and `http-handlers.ts`.

**Tech Stack:** PartyServer, XState v5, Cloudflare Workers (Durable Objects), TypeScript

**Design doc:** `docs/plans/2026-03-09-demo-game-rearchitecture-design.md`
**ADR:** ADR-095 in `plans/DECISIONS.md`

---

### Task 1: Create demo seed data with real personas and mid-game state

**Files:**
- Create: `apps/game-server/src/demo/demo-seed.ts`
- Reference: `apps/lobby/migrations/0004_revamp_persona_pool.sql` (persona names/stereotypes)
- Reference: `packages/shared-types/src/index.ts` (VoteType, GameType, PromptType, manifest types)
- Reference: `apps/game-server/src/sync.ts` (SYNC payload shape)

**Context:** This module generates the pre-seeded demo context — a mid-game fixture at Day 3 of 5. It uses 6 real personas from the PersonaPool, a real-shaped StaticManifest, and pre-populated history. The SYNC payload the client receives must be structurally identical to a real game's.

**Step 1: Create `demo-seed.ts`**

```typescript
/**
 * Demo Seed — generates a pre-seeded mid-game fixture for UI testing.
 *
 * Uses real PersonaPool personas, real manifest types, and pre-populated
 * history so the client can't distinguish demo from a real game.
 */
import type { VoteType, GameType } from '@pecking-order/shared-types';

// 6 real personas from PersonaPool (apps/lobby/migrations/0004_revamp_persona_pool.sql)
// Avatar URLs point to R2: /personas/{id}/{variant}.png
// For demo, use DiceBear with the real persona names as seeds for consistency
const DEMO_PERSONAS = [
  { id: 'p0', personaName: 'Skyler Blue', stereotype: 'The Party Animal', avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=skyler-blue&backgroundColor=b6e3f4' },
  { id: 'p1', personaName: 'Bella Rossi', stereotype: 'The Influencer', avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=bella-rossi&backgroundColor=ffd5dc' },
  { id: 'p2', personaName: 'Chad Brock', stereotype: 'The Showmance', avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=chad-brock&backgroundColor=c0aede' },
  { id: 'p3', personaName: 'Brenda Burns', stereotype: 'The Villain', avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=brenda-burns&backgroundColor=ffd5b4' },
  { id: 'p4', personaName: 'Jax Cash', stereotype: 'The Tech Bro', avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=jax-cash&backgroundColor=d1f4d1' },
  { id: 'p5', personaName: 'Raven Thorne', stereotype: 'The Goth Rebel', avatarUrl: 'https://api.dicebear.com/9.x/adventurer/svg?seed=raven-thorne&backgroundColor=ffeab6' },
] as const;

export { DEMO_PERSONAS };

export interface DemoSeed {
  gameId: string;
  dayIndex: number;
  roster: Record<string, any>;
  manifest: any; // StaticManifest shape
  chatLog: any[];
  channels: Record<string, any>;
  completedPhases: any[];
  gameHistory: any[];
  goldPool: number;
  winner: null;
}

/** Build a mid-game fixture: Day 3 of 5, 2 players eliminated, rich history. */
export function buildDemoSeed(gameId: string = 'DEMO'): DemoSeed {
  const now = Date.now();

  // Roster: p0-p3 alive, p4-p5 eliminated
  const roster: Record<string, any> = {};
  for (const p of DEMO_PERSONAS) {
    const isEliminated = p.id === 'p4' || p.id === 'p5';
    roster[p.id] = {
      id: p.id,
      realUserId: `demo-${p.id}`,
      personaName: p.personaName,
      avatarUrl: p.avatarUrl,
      bio: p.stereotype,
      isAlive: !isEliminated,
      isSpectator: isEliminated,
      status: isEliminated ? 'ELIMINATED' : 'ALIVE',
      silver: isEliminated ? 12 : (30 + Math.floor(Math.random() * 40)),
      gold: 0,
      destinyId: null,
    };
  }

  // Manifest: 5 days, real vote/game types
  const manifest = {
    kind: 'STATIC' as const,
    id: `manifest-${gameId}`,
    gameMode: 'CONFIGURABLE_CYCLE',
    scheduling: 'PRE_SCHEDULED' as const,
    days: [
      { dayIndex: 1, theme: 'First Impressions', voteType: 'MAJORITY' as VoteType, gameType: 'TRIVIA' as GameType, timeline: [] },
      { dayIndex: 2, theme: 'Alliances Form', voteType: 'BUBBLE' as VoteType, gameType: 'BLIND_AUCTION' as GameType, timeline: [] },
      { dayIndex: 3, theme: 'Betrayal', voteType: 'EXECUTIONER' as VoteType, gameType: 'BET_BET_BET' as GameType, timeline: [] },
      { dayIndex: 4, theme: 'Desperate Moves', voteType: 'PODIUM_SACRIFICE' as VoteType, gameType: 'THE_SPLIT' as GameType, timeline: [] },
      { dayIndex: 5, theme: 'The Finale', voteType: 'FINALS' as VoteType, gameType: 'KINGS_RANSOM' as GameType, timeline: [] },
    ],
    pushConfig: {},
  };

  // Completed phases for days 1-2
  const completedPhases = [
    {
      kind: 'voting', dayIndex: 1, mechanism: 'MAJORITY',
      eliminatedId: 'p4', completedAt: now - 86400000 * 2,
      results: { votes: { p0: 'p4', p1: 'p4', p2: 'p3', p3: 'p4', p4: 'p0', p5: 'p3' } },
    },
    {
      kind: 'game', dayIndex: 1, gameType: 'TRIVIA',
      completedAt: now - 86400000 * 2 + 3600000,
      results: { rankings: [{ playerId: 'p0', score: 8 }, { playerId: 'p1', score: 6 }, { playerId: 'p2', score: 5 }, { playerId: 'p3', score: 7 }] },
    },
    {
      kind: 'voting', dayIndex: 2, mechanism: 'BUBBLE',
      eliminatedId: 'p5', completedAt: now - 86400000,
      results: { votes: { p0: 'p5', p1: 'p3', p2: 'p5', p3: 'p5' } },
    },
    {
      kind: 'game', dayIndex: 2, gameType: 'BLIND_AUCTION',
      completedAt: now - 86400000 + 3600000,
      results: { rankings: [{ playerId: 'p1', score: 12 }, { playerId: 'p0', score: 9 }, { playerId: 'p3', score: 7 }, { playerId: 'p2', score: 4 }] },
    },
  ];

  // Game history
  const gameHistory = [
    { dayIndex: 1, theme: 'First Impressions', eliminatedId: 'p4', eliminatedName: 'Jax Cash', voteType: 'MAJORITY' },
    { dayIndex: 2, theme: 'Alliances Form', eliminatedId: 'p5', eliminatedName: 'Raven Thorne', voteType: 'BUBBLE' },
  ];

  // Pre-seeded chat messages (MAIN channel)
  const chatLog = [
    { id: crypto.randomUUID(), senderId: 'p0', content: 'Day 3 already... who\'s going home tonight?', channelId: 'MAIN', timestamp: now - 600000 },
    { id: crypto.randomUUID(), senderId: 'p3', content: 'Not me. I\'ve got plans.', channelId: 'MAIN', timestamp: now - 540000 },
    { id: crypto.randomUUID(), senderId: 'p1', content: 'That\'s what Jax said before Day 1 voting 💀', channelId: 'MAIN', timestamp: now - 480000 },
    { id: crypto.randomUUID(), senderId: 'p2', content: 'Can we just appreciate that Raven called the Bubble vote result?', channelId: 'MAIN', timestamp: now - 420000 },
    { id: crypto.randomUUID(), senderId: 'p0', content: 'The auction was wild. Bella came out of nowhere with that bid.', channelId: 'MAIN', timestamp: now - 360000 },
    { id: crypto.randomUUID(), senderId: 'p1', content: 'Strategy 😏', channelId: 'MAIN', timestamp: now - 300000 },
    // DM between p0 and p1
    { id: crypto.randomUUID(), senderId: 'p0', content: 'Hey, are we still aligned?', channelId: 'dm:p0:p1', timestamp: now - 240000 },
    { id: crypto.randomUUID(), senderId: 'p1', content: 'Always. Target is Brenda tonight.', channelId: 'dm:p0:p1', timestamp: now - 180000 },
  ];

  // Channels: MAIN + one pre-existing DM
  const channels: Record<string, any> = {
    MAIN: {
      id: 'MAIN',
      type: 'MAIN',
      memberIds: DEMO_PERSONAS.map(p => p.id),
      createdBy: 'system',
      createdAt: now - 86400000 * 3,
      capabilities: ['CHAT'],
      constraints: {},
    },
    'dm:p0:p1': {
      id: 'dm:p0:p1',
      type: 'DM',
      memberIds: ['p0', 'p1'],
      createdBy: 'p0',
      createdAt: now - 86400000,
      capabilities: ['CHAT', 'SILVER_TRANSFER'],
      constraints: { silverCost: 0 },
    },
  };

  return {
    gameId,
    dayIndex: 3,
    roster,
    manifest,
    chatLog,
    channels,
    completedPhases,
    gameHistory,
    goldPool: 50,
    winner: null,
  };
}
```

**Step 2: Build and verify types compile**

Run: `cd apps/game-server && npm run build`
Expected: PASS (tsc --noEmit)

**Step 3: Commit**

```bash
git add apps/game-server/src/demo/demo-seed.ts
git commit -m "feat(demo): add demo seed with real personas and mid-game fixture"
```

---

### Task 2: Update demo machine to use seed data

**Files:**
- Modify: `apps/game-server/src/demo/demo-machine.ts`
- Delete: `apps/game-server/src/demo/demo-personas.ts`

**Context:** The demo machine's context needs to include the pre-seeded history fields (completedPhases, gameHistory, manifest, dayIndex, goldPool) so the sync builder can produce rich payloads. Replace the old persona imports with the seed module.

**Step 1: Update `demo-machine.ts`**

Replace the imports and context type. The machine context should be initialized from `buildDemoSeed()`. Add the new fields to `DemoContext`. The machine's event handlers (handleSendMsg, handleCreateChannel, handleSendSilver) stay the same — they only mutate `chatLog`, `channels`, and `roster`.

Key changes:
- Import `buildDemoSeed` instead of `buildDemoRoster`/`buildDemoChannels`
- Expand `DemoContext` to include `dayIndex`, `manifest`, `completedPhases`, `gameHistory`, `goldPool`, `winner`
- Initialize context from `buildDemoSeed(input.gameId)` via spread

```typescript
import { buildDemoSeed } from './demo-seed';

export interface DemoContext {
  gameId: string;
  dayIndex: number;
  roster: Record<string, any>;
  manifest: any;
  chatLog: any[];
  channels: Record<string, any>;
  completedPhases: any[];
  gameHistory: any[];
  goldPool: number;
  winner: null;
}
```

Context initializer:
```typescript
context: ({ input }) => ({
  ...buildDemoSeed(input.gameId),
}),
```

The `dmChannelId` helper and `makeMessage` helper stay. All three action handlers stay — just update the `type` guard checks to use the correct `DemoContext` shape (they already work since they only read/write `roster`, `chatLog`, `channels`).

**Step 2: Delete `demo-personas.ts`**

Remove the file. All persona data now lives in `demo-seed.ts`.

**Step 3: Build and verify**

Run: `cd apps/game-server && npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/game-server/src/demo/demo-machine.ts
git rm apps/game-server/src/demo/demo-personas.ts
git commit -m "feat(demo): use seed data with real personas, remove demo-personas"
```

---

### Task 3: Update demo sync builder for rich SYNC payload

**Files:**
- Modify: `apps/game-server/src/demo/demo-sync.ts`
- Reference: `apps/game-server/src/sync.ts` (real SYNC shape to match)

**Context:** The demo SYNC must now include `completedPhases`, `gameHistory`, `manifest`, `goldPool`, and `dayIndex` from the seed data instead of hardcoded defaults. Import types from `shared-types` for compile-time drift detection.

**Step 1: Update `buildDemoSyncPayload`**

Replace hardcoded `dayIndex: 1`, `manifest: null`, empty `completedPhases`/`gameHistory` with values from the demo context. Keep the per-player channel/chat filtering logic.

Key changes to the returned SYNC payload:
```typescript
{
  type: 'SYSTEM.SYNC',       // Use Events.System.SYNC from shared-types
  state: 'socialPeriod',     // Still constant — demo stays in social phase
  context: {
    gameId: context.gameId,
    dayIndex: context.dayIndex,              // Was: 1. Now: 3
    roster: context.roster,
    manifest: context.manifest,              // Was: null. Now: StaticManifest
    chatLog: filteredChatLog,
    channels: filteredChannels,
    groupChatOpen: true,
    dmsOpen: true,
    activeVotingCartridge: null,
    activeGameCartridge: null,
    activePromptCartridge: null,
    winner: context.winner,
    goldPool: context.goldPool,              // Was: 0. Now: 50
    goldPayouts: [],
    gameHistory: context.gameHistory,        // Was: []. Now: 2 entries
    completedPhases: context.completedPhases, // Was: []. Now: 4 entries
    dmStats: { charsUsed: 0, charsLimit: 999999, partnersUsed: 0, partnersLimit: 999, groupsUsed: 0, groupsLimit: 999 },
    onlinePlayers,
  },
}
```

**Step 2: Import Events from shared-types**

Replace the raw `'SYSTEM.SYNC'` string with `Events.System.SYNC`.

**Step 3: Build and verify**

Run: `cd apps/game-server && npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/game-server/src/demo/demo-sync.ts
git commit -m "feat(demo): rich SYNC payload with history, manifest, and goldPool"
```

---

### Task 4: Create `DemoServer` Durable Object

**Files:**
- Create: `apps/game-server/src/demo/demo-server.ts`
- Reference: `apps/game-server/src/ws-handlers.ts` (reuse presence helpers)
- Reference: `apps/game-server/src/snapshot.ts` (ensureSnapshotsTable)

**Context:** This is the main deliverable — a standalone DO class that replaces all demo code in `GameServer`. It handles its own HTTP routes, WS lifecycle, and actor management. Import presence helpers (`getOnlinePlayerIds`, `broadcastPresence`) from `ws-handlers.ts` to avoid duplication.

**Step 1: Create `demo-server.ts`**

```typescript
/**
 * DemoServer — isolated Durable Object for UI/UX testing.
 *
 * Separate from GameServer (ADR-095). No voting, games, day progression,
 * alarms, or persistence. Pre-seeded mid-game state with real personas.
 */
import { Server, Connection, ConnectionContext } from 'partyserver';
import { createActor } from 'xstate';
import { Events } from '@pecking-order/shared-types';
import { demoMachine } from './demo-machine';
import { DEMO_PERSONAS } from './demo-seed';
import { buildDemoSyncPayload, broadcastDemoSync } from './demo-sync';
import { ensureSnapshotsTable } from '../snapshot';
import { getOnlinePlayerIds, broadcastPresence } from '../ws-handlers';
import type { Env } from '../types';

export class DemoServer extends Server<Env> {
  static options = { hibernate: true };

  private demoActor: ReturnType<typeof createActor<typeof demoMachine>> | undefined;
  private connectedPlayers = new Map<string, Set<string>>();

  async onStart() {
    ensureSnapshotsTable(this.ctx.storage);

    // Check if already initialized
    const rows = this.ctx.storage.sql
      .exec("SELECT value FROM snapshots WHERE key = 'demo_mode'")
      .toArray();

    if (rows.length > 0) {
      this.initDemoActor((rows[0] as any).value || 'DEMO');
    }
  }

  private initDemoActor(gameId: string) {
    this.demoActor = createActor(demoMachine, { input: { gameId } });
    this.demoActor.subscribe(() => {
      broadcastDemoSync(
        this.demoActor!.getSnapshot().context,
        () => this.getConnections(),
        this.connectedPlayers,
      );
    });
    this.demoActor.start();
  }

  // --- HTTP ---

  async onRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // POST /init-demo — admin-authed, stamps game as demo
    if (req.method === 'POST' && path.endsWith('/init-demo')) {
      const auth = req.headers.get('Authorization');
      if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== this.env.AUTH_SECRET) {
        return new Response('Unauthorized', { status: 401 });
      }

      const gameId = path.split('/').slice(-2, -1)[0] || 'DEMO';
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO snapshots (key, value, updated_at) VALUES ('demo_mode', ?, unixepoch())",
        gameId,
      );
      this.initDemoActor(gameId);

      return Response.json(
        { status: 'OK', gameId, personas: DEMO_PERSONAS.map(p => ({ id: p.id, personaName: p.personaName, avatarUrl: p.avatarUrl })) },
        { headers: corsHeaders },
      );
    }

    // GET /join-demo — unauthenticated, returns persona list
    if (req.method === 'GET' && path.endsWith('/join-demo')) {
      if (!this.demoActor) {
        return Response.json({ error: 'Demo not initialized' }, { status: 400, headers: corsHeaders });
      }
      const roster = this.demoActor.getSnapshot().context.roster;
      return Response.json(
        {
          gameId: this.demoActor.getSnapshot().context.gameId,
          personas: DEMO_PERSONAS.map(p => ({
            id: p.id,
            personaName: p.personaName,
            avatarUrl: p.avatarUrl,
            silver: roster[p.id]?.silver ?? 0,
          })),
        },
        { headers: corsHeaders },
      );
    }

    return new Response('Not Found', { status: 404 });
  }

  // --- WEBSOCKET ---

  async onConnect(ws: Connection, ctx: ConnectionContext) {
    if (!this.demoActor) {
      ws.close(4001, 'Demo not initialized');
      return;
    }

    const url = new URL(ctx.request.url);
    const playerId = url.searchParams.get('playerId');
    const roster = this.demoActor.getSnapshot().context.roster;

    if (!playerId || !roster[playerId]) {
      ws.close(4001, 'Invalid Player ID');
      return;
    }

    ws.setState({ playerId });
    ws.serializeAttachment({ playerId });

    // Track presence
    const existing = this.connectedPlayers.get(playerId) || new Set();
    existing.add(ws.id);
    this.connectedPlayers.set(playerId, existing);

    // Send initial SYNC
    const onlinePlayers = getOnlinePlayerIds(this.connectedPlayers);
    ws.send(JSON.stringify(buildDemoSyncPayload(this.demoActor.getSnapshot().context, playerId, onlinePlayers)));

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
    if (!this.demoActor) return;

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

      // Presence: relay typing indicators
      if (event.type === Events.Presence.TYPING || event.type === Events.Presence.STOP_TYPING) {
        const msg = JSON.stringify({ type: event.type, playerId, channel: event.channel || 'MAIN' });
        for (const other of this.getConnections()) {
          if (other !== ws) other.send(msg);
        }
        return;
      }

      // Only allow social events
      const allowed = [Events.Social.SEND_MSG, Events.Social.CREATE_CHANNEL, Events.Social.SEND_SILVER];
      if (allowed.includes(event.type)) {
        this.demoActor.send({ ...event, senderId: playerId });
      }
    } catch { /* ignore malformed messages */ }
  }
}
```

**Step 2: Build and verify**

Run: `cd apps/game-server && npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/game-server/src/demo/demo-server.ts
git commit -m "feat(demo): add DemoServer Durable Object (ADR-095)"
```

---

### Task 5: Register `DemoServer` in wrangler config and server exports

**Files:**
- Modify: `apps/game-server/wrangler.toml`
- Modify: `apps/game-server/src/server.ts` (export DemoServer)

**Context:** PartyServer requires the DO class to be exported from the main worker entry point. Wrangler needs a binding for the new class. The migration tag must include `DemoServer` in `new_sqlite_classes` so it gets its own SQLite storage.

**Step 1: Update `wrangler.toml`**

Add `DemoServer` to the durable_objects bindings and migrations in ALL environments (dev, staging, production). The migration needs a NEW tag (e.g., `v2`) since `v1` is already applied.

In the root `[durable_objects]` section, add:
```toml
{ name = "DEMO_SERVER", class_name = "DemoServer" }
```

Add a new migration:
```toml
[[migrations]]
tag = "v2"
new_sqlite_classes = ["DemoServer"]
```

Add the binding to staging and production environments too.

**Step 2: Export `DemoServer` from `server.ts`**

Add a re-export at the top of `server.ts`:
```typescript
export { DemoServer } from './demo/demo-server';
```

This must be a top-level export so wrangler can find the class.

**Step 3: Build and verify**

Run: `cd apps/game-server && npm run build`
Expected: PASS

**Step 4: Verify wrangler can parse config**

Run: `cd apps/game-server && npx wrangler dev --dry-run` (or just start dev and check for errors)

**Step 5: Commit**

```bash
git add apps/game-server/wrangler.toml apps/game-server/src/server.ts
git commit -m "feat(demo): register DemoServer DO in wrangler config"
```

---

### Task 6: Update client to connect to `demo-server` party

**Files:**
- Modify: `apps/client/src/pages/DemoPage.tsx`
- Modify: `apps/client/src/hooks/useGameEngine.ts` (add optional `party` parameter)
- Modify: `apps/client/src/shells/ShellLoader.tsx` (pass `party` prop)

**Context:** The client currently connects to `party: 'game-server'` for everything. The demo needs to connect to `party: 'demo-server'` instead. The simplest approach: add an optional `party` prop that flows from `DemoPage` → `ShellLoader` → `useGameEngine` → `usePartySocket`.

**Step 1: Update `useGameEngine` to accept optional `party` parameter**

```typescript
export const useGameEngine = (
  gameId: string,
  playerId: string,
  token?: string | null,
  party: string = 'game-server',
) => {
  // ...
  const socket = usePartySocket({
    host: new URL(import.meta.env.VITE_GAME_SERVER_HOST || "http://localhost:8787").host,
    room: gameId,
    party,  // Was hardcoded 'game-server'
    query,
    // ...
  });
```

**Step 2: Update `ShellLoader` to accept and pass `party` prop**

```typescript
interface ShellLoaderProps {
  gameId: string;
  playerId: string;
  token: string | null;
  party?: string;
}

export function ShellLoader({ gameId, playerId, token, party }: ShellLoaderProps) {
  const engine = useGameEngine(gameId, playerId, token, party);
  // ...
  const shellProps: ShellProps = { playerId, engine, token };
```

Also update the `ShellProps` type if `party` needs to pass through (it shouldn't — it's consumed by `useGameEngine`).

**Step 3: Update `DemoPage` to use `demo-server` party and API URL**

Two changes:
1. The fetch URL for `/join-demo` needs to target the `demo-server` party: `/parties/demo-server/${demoGameId}/join-demo`
2. Pass `party="demo-server"` to `ShellLoader`

```typescript
// Fetch personas from DemoServer
const res = await fetch(`${protocol}://${host}/parties/demo-server/${demoGameId}/join-demo`);

// Render shell connected to DemoServer
return <ShellLoader gameId={gameId} playerId={selectedPlayerId} token={null} party="demo-server" />;
```

**Step 4: Build client and verify**

Run: `cd apps/client && npm run lint`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/client/src/pages/DemoPage.tsx apps/client/src/hooks/useGameEngine.ts apps/client/src/shells/ShellLoader.tsx
git commit -m "feat(demo): connect client to demo-server party"
```

---

### Task 7: Remove all demo code from `GameServer`

**Files:**
- Modify: `apps/game-server/src/server.ts`
- Modify: `apps/game-server/src/http-handlers.ts`
- Modify: `apps/game-server/src/ws-handlers.ts`

**Context:** This is the cleanup task. Remove every `isDemoMode`, `demoActor`, and demo-related branch from the main game code. After this, `GameServer` has zero knowledge of demo mode.

**Step 1: Clean `server.ts`**

Remove:
- `import { demoMachine } from './demo/demo-machine'`
- `import { broadcastDemoSync } from './demo/demo-sync'`
- `demoActor` class property
- `isDemoMode` class property
- `initDemoMode()` private method
- Demo check in `onStart()` (the `try { SELECT demo_mode ... }` block)
- `isDemoMode` and `demoActor` from `handlerContext()` return
- `isDemoMode` and `demoActor` from `wsContext()` return
- `reinitAsDemo` from `handlerContext()` return

Keep the `export { DemoServer }` re-export added in Task 5.

**Step 2: Clean `http-handlers.ts`**

Remove:
- `isDemoMode`, `demoActor`, `reinitAsDemo` from `HandlerContext` interface
- `handleInitDemo` function
- `handleJoinDemo` function
- The two route entries for `/init-demo` and `/join-demo` in the router
- `import { DEMO_PERSONAS } from './demo/demo-personas'` (if still present)

**Step 3: Clean `ws-handlers.ts`**

Remove:
- `demoActor` and `isDemoMode` from `WsContext` interface
- `import { buildDemoSyncPayload } from './demo/demo-sync'` (if present)
- Demo branch in `handleConnect()` (the `if (ctx.isDemoMode && ctx.demoActor)` block, lines 74-97)
- Demo branch in `handleMessage()` (the `if (ctx.isDemoMode && ctx.demoActor)` block, lines 285-292)

**Important:** Keep the presence helper exports (`getOnlinePlayerIds`, `broadcastPresence`) — DemoServer imports them.

**Step 4: Build game-server and verify**

Run: `cd apps/game-server && npm run build`
Expected: PASS

**Step 5: Run existing tests to verify no regressions**

Run: `cd apps/game-server && npm run test`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add apps/game-server/src/server.ts apps/game-server/src/http-handlers.ts apps/game-server/src/ws-handlers.ts
git commit -m "refactor: remove all demo code from GameServer (ADR-095)"
```

---

### Task 8: Integration test — init demo, connect, send chat

**Context:** Verify the full demo flow works end-to-end with the new `DemoServer` DO.

**Step 1: Start dev server**

Run: `cd apps/game-server && npm run dev`

**Step 2: Initialize demo game**

```bash
curl -s -X POST http://localhost:8787/parties/demo-server/DEMO/init-demo \
  -H 'Authorization: Bearer dev-secret-change-me' | python3 -m json.tool
```

Expected: `{ "status": "OK", "gameId": "DEMO", "personas": [...] }` with Skyler Blue, Bella Rossi, etc.

**Step 3: Fetch personas**

```bash
curl -s http://localhost:8787/parties/demo-server/DEMO/join-demo | python3 -m json.tool
```

Expected: 6 personas with silver balances.

**Step 4: WebSocket chat test**

```javascript
// Run with: node --input-type=module
import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:8787/parties/demo-server/DEMO?playerId=p0');
ws.on('open', () => console.log('[OPEN]'));
ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'SYSTEM.SYNC') {
    console.log('[SYNC] day:', msg.context.dayIndex, 'chatLog:', msg.context.chatLog.length, 'completedPhases:', msg.context.completedPhases.length);
    // Should show dayIndex: 3, chatLog: 6+ (filtered to p0's channels), completedPhases: 4
    ws.send(JSON.stringify({ type: 'SOCIAL.SEND_MSG', content: 'Test from DemoServer!', channelId: 'MAIN' }));
  }
});
setTimeout(() => process.exit(0), 3000);
```

Expected: SYNC with `dayIndex: 3`, `completedPhases` length 4, chatLog with pre-seeded messages. Second SYNC after chat send includes the new message.

**Step 5: Browser test**

Navigate to `http://localhost:5173/demo`. Pick a persona. Verify:
- Chat input works (send message, see it appear)
- Day index shows 3 (if shell renders it)
- Roster shows 4 alive, 2 eliminated
- Pre-seeded messages visible

**Step 6: Commit (if any fixes needed)**

```bash
git commit -m "test: verify DemoServer integration"
```

---

### Task 9: Final cleanup and build verification

**Step 1: Full monorepo build**

Run: `npm run build` (from root)
Expected: All apps and packages build clean.

**Step 2: Run all tests**

Run: `npm run test` (from root)
Expected: All tests pass.

**Step 3: Verify GameServer still works normally**

Run `/speed-run` skill to verify the normal game lifecycle is unaffected by the demo removal.

**Step 4: Final commit**

```bash
git commit -m "chore: verify full build and test suite after demo rearchitecture"
```
