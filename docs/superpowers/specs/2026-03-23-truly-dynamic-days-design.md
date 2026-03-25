# Truly Dynamic Days — Design Spec

**Date:** 2026-03-23
**Goal:** Remove the fixed `maxPlayers`/slot count requirement from dynamic game creation. Players join freely via shared invite link or targeted invites. The game adapts to however many show up, using the Game Master to resolve appropriate mechanisms per day.

## Problem

Dynamic games currently hardcode `maxPlayers: 8` in the lobby UI and pre-allocate that many invite slots. This forces the host to decide player count upfront, even though the Game Master already resolves days dynamically based on alive player count. The fixed slot model is a leftover from static games.

## Design

### Schema Changes

**`packages/shared-types` — DynamicManifest:**

```typescript
// Before
maxPlayers: z.number(),  // required

// After
maxPlayers: z.number().optional(),  // capacity limit, optional
minPlayers: z.number().min(2).optional(),  // new — minimum to start, defaults to 3
```

- `maxPlayers` becomes optional. If set, lobby enforces it as a join cap. If unset, no cap.
- `minPlayers` is checked at game start. Floor of 2 (smallest playable game). Default to 3 if omitted (MAJORITY → FINALS arc).
- Backwards-compatible: existing manifests with `maxPlayers` still parse.

### Invite Flow

**Current (STATIC):** Pre-create N slots in `Invites` D1 table → send individual invite links → each maps to a pre-existing slot.

**New (DYNAMIC):**
- At game creation, no slots are pre-created. The game gets a shared `inviteCode` (already exists).
- When a player accepts an invite (shared link or targeted), the lobby creates a slot on the fly: `slot_index = MAX(existing slots for this game) + 1`.
- Player ID assignment stays `p${slot_index}` (1-indexed).
- Each accepted player triggers `SYSTEM.PLAYER_JOINED` to the DO (existing mechanism for CONFIGURABLE_CYCLE).
- Invites stop being accepted once game status changes to `STARTED`.
- If `maxPlayers` is set and the count is reached, further joins are rejected.

**Host can also send targeted invites** — these work the same way (slot created on accept, not upfront). The host can keep sending invites at any time before the game starts.

### Game Start Logic

Two triggers, whichever fires first:

1. **Scheduled auto-start:** The DO already has `startTime` on the manifest. When the alarm fires at `startTime`:
   - Count players in roster (via `SYSTEM.PLAYER_JOINED` events received during preGame)
   - If `>= minPlayers`: send `SYSTEM.WAKEUP` → game begins
   - If `< minPlayers`: stay in preGame, notify host via push ("Only N of M minimum players joined")

2. **Host early start:** Host clicks "Start Game" in lobby UI:
   - Lobby checks `minPlayers` — if not met, show error
   - If met: call DO endpoint to trigger `SYSTEM.WAKEUP`

**Edge case — not enough players at startTime:**
- Game stays in preGame. Host is notified.
- Host can wait for more joins, or start anyway (lobby allows host override with a confirmation: "Only 2 players joined. Start anyway?").
- The Game Master handles any roster size >= 2.

### What Changes

| File | Change |
|------|--------|
| `packages/shared-types/src/index.ts` | `maxPlayers` optional, add `minPlayers` field to `DynamicManifestSchema` |
| `apps/lobby/app/actions.ts` | `createGame()`: skip slot pre-creation for DYNAMIC. `acceptInvite()`: create slot on the fly for DYNAMIC games. `startGame()`: add `minPlayers` guard. |
| `apps/lobby/app/page.tsx` | Remove hardcoded `maxPlayers: 8`. Add `minPlayers` input (default 3). |
| `apps/game-server` (scheduling/server) | preGame alarm handler: guard `SYSTEM.WAKEUP` on `roster count >= minPlayers` |

### What Doesn't Change

- **L2/L3/L4 machines** — already handle any roster size
- **Game Master** — resolves days from alive count, `alive <= 2` triggers FINALS
- **Voting mechanisms** — `minPlayers` constraints with MAJORITY fallback
- **Social scaling** — works off alive count
- **Timeline generation** — preset-driven, player-count independent
- **Client** — renders whatever SYNC payload contains
- **`SYSTEM.PLAYER_JOINED` event** — already exists and works in preGame
- **Persona selection / character bio flow** — per-player at invite accept, unchanged

### Out of Scope

- **Mid-game joins** — players cannot join after game starts. Future consideration.
- **Max player cap enforcement** — no cap for V1. Add if playtests reveal scaling issues.
- **Spectator mode** — not part of this change.

### Testing

- Lobby unit tests: dynamic slot creation on join, `minPlayers` guard on start
- Integration: create dynamic game → N players join → start → verify roster has N players
- Edge case: start with exactly 2 players → immediate FINALS (already tested in game-server)
- Edge case: `startTime` arrives with < `minPlayers` → game stays in preGame
