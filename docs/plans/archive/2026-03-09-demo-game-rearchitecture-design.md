# Demo Game Rearchitecture — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Isolate demo game into its own Durable Object with a rich pre-seeded mid-game state, using real personas and manifest types — purely for UI/UX testing.

**Architecture:** Separate `DemoServer` DO class, fully isolated from `GameServer`. All demo code lives under `apps/game-server/src/demo/`. Zero demo references in the main game code. The demo machine handles only chat/silver events while serving a SYNC payload structurally identical to a real mid-game.

---

## Problem

The current demo implementation has three issues:

1. **Wrong personas** — Demo invented new personas (Sunny Meadows, Rex Thunder) instead of using the existing 24 PersonaPool personas (Skyler Blue, Bella Rossi, etc.)
2. **Demo code scattered in game code** — `isDemoMode` checks in `server.ts`, `ws-handlers.ts`, `http-handlers.ts` contaminate the real game logic and create maintenance burden
3. **Shallow game state** — Demo shows Day 1 of an empty game. For UI testing, we need a mid-game state with past events, eliminations, completed phases, etc.

## Design

### Separate Durable Object

`DemoServer` is its own DO class with wrangler binding `demo-server`. This means:
- Zero demo code in `GameServer`, `ws-handlers.ts`, `http-handlers.ts`
- Demo can evolve independently (test new UI states, mechanics) without risk to real games
- Clear boundary: `GameServer` = real games, `DemoServer` = UI testing sandbox

### Real Personas

Hardcode a subset of the existing PersonaPool personas (Skyler Blue, Bella Rossi, Chad Brock, etc.) with their actual R2 avatar URLs. No D1 dependency — the demo is self-contained.

### Demo Manifest

The demo uses a real-shaped `StaticManifest` with populated `DailyManifest` entries. This exercises the same types the client uses to render game state. The manifest covers 5 days with real VoteTypes, GameTypes, and PromptTypes from the registries.

### Pre-Seeded Mid-Game State

The demo starts at **Day 3 of 5** with:
- 2 players already eliminated (status: `ELIMINATED`)
- Completed phases for Days 1-2 (voting results, game results, prompt results)
- Game history entries for past days
- Pre-seeded chat messages in MAIN channel
- Existing DM channels between some players
- Silver balances reflecting past game rewards
- `groupChatOpen: true`, `dmsOpen: true`

### Demo Machine

Lightweight XState machine with a single `active` state. Handles only:
- `SOCIAL.SEND_MSG` — main chat, DMs, channel messages (auto-creates DM channels)
- `SOCIAL.CREATE_CHANNEL` — group DMs
- `SOCIAL.SEND_SILVER` — silver transfers

Context includes all pre-seeded fields so the SYNC builder can produce rich payloads.

### SYNC Drift Prevention

1. **Compile-time**: Demo sync builder imports types from `shared-types`. TypeScript breaks the demo build if the SYNC shape changes.
2. **Workflow rule**: After changes to L2/L3 machines, SYNC payload, manifest types, or cartridge registries — check if DemoServer needs updating.
3. **Generated fixture**: The demo seed data is a function, not hand-maintained constants. Can be regenerated from current game schemas.

### Demo Seed Data (`demo-seed.ts`)

Exported as `buildDemoSeed()` function that returns the full pre-seeded context:
- Roster with 6 real personas (4 alive, 2 eliminated)
- StaticManifest with 5 days using real cartridge types
- completedPhases array with voting/game/prompt results for days 1-2
- gameHistory entries
- chatLog with 8-10 pre-seeded messages
- channels with MAIN + 2 existing DM channels
- Silver balances (varied, reflecting game activity)

## Component Breakdown

### New Files

| File | Purpose |
|------|---------|
| `demo/demo-server.ts` | `DemoServer` DO class — lifecycle, HTTP, WS |
| `demo/demo-seed.ts` | Pre-seeded mid-game fixture generator |

### Updated Files

| File | Change |
|------|--------|
| `demo/demo-machine.ts` | Context gains seeded fields; uses real personas |
| `demo/demo-sync.ts` | Imports shared SYNC types; richer payload |
| `wrangler.toml` | Add `DemoServer` DO binding |

### Deleted Files

| File | Reason |
|------|--------|
| `demo/demo-personas.ts` | Replaced by real personas in `demo-seed.ts` |

### Cleaned Up (demo code removed)

| File | What's removed |
|------|---------------|
| `server.ts` | `demoActor`, `isDemoMode`, `initDemoMode()`, demo check in `onStart()`, demo fields in context builders |
| `ws-handlers.ts` | Demo branch in `handleConnect()`, demo branch in `handleMessage()`, demo fields in `WsContext` |
| `http-handlers.ts` | `handleInitDemo`, `handleJoinDemo`, demo fields in `HandlerContext`, demo routes |

### Client Changes

| File | Change |
|------|--------|
| `DemoPage.tsx` | Update PartySocket to use `party: 'demo-server'` |

## Data Flow

```
POST /init-demo (admin-authed)
  DemoServer.onRequest
    → Stores demo flag in SQL
    → Creates demo actor with pre-seeded context

GET /join-demo
  DemoServer.onRequest
    → Returns persona list from roster

WS connect (?playerId=p0)
  DemoServer.onConnect
    → Validates playerId against roster
    → Sends SYNC (rich mid-game state with history)

WS message (SOCIAL.SEND_MSG)
  DemoServer.onMessage
    → Routes to demo actor
    → Actor processes, updates context
    → Broadcasts SYNC to all connected players

Client renders normally — indistinguishable from real game
```

## Wrangler Config

```toml
[[durable_objects.bindings]]
name = "DEMO_SERVER"
class_name = "DemoServer"
```

Party name: `demo-server`
PartySocket URL: `/parties/demo-server/DEMO`

## Out of Scope

- Game mechanics (voting, games, prompts, day progression)
- Persistence / snapshot restoration
- Alarms / scheduling
- D1 journal writes
- Push notifications
- Admin inspector
