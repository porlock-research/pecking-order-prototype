# Pecking Order — Glossary

Canonical definitions of project-specific terms. When in doubt, this file is authoritative.

## Manifest Kind

| Kind | `days[]` at creation | Day content | Game Master |
|------|---------------------|-------------|-------------|
| **STATIC** | Pre-populated with all days | Fixed at creation time | Not spawned |
| **DYNAMIC** | Empty `[]` | Resolved at runtime by Game Master each morning | Spawned at preGame |

- STATIC: lobby computes all days upfront. The manifest arrives complete.
- DYNAMIC: Game Master resolves each day based on live roster state (alive count, history). Days are appended to `manifest.days[]` as the game progresses.

## Scheduling Mode

| Mode | Timeline events fire via | Alarms | Use case |
|------|--------------------------|--------|----------|
| **PRE_SCHEDULED** | PartyWhen alarms at real timestamps | Yes — `scheduleManifestAlarms()` inserts tasks | Production games, playtests |
| **ADMIN** | Manual `INJECT_TIMELINE_EVENT` API calls | No — `scheduling.ts` short-circuits | Dev/debug, e2e tests needing precise control |

**Critical distinction:** In ADMIN mode, timestamps in `timeline[]` are **ignored**. Events only fire when explicitly injected via the admin API. In PRE_SCHEDULED mode, timestamps are real and the alarm pipeline fires them automatically.

## Schedule Preset

Controls **when** timeline events happen within a day. Only meaningful for PRE_SCHEDULED games.

| Preset | Type | Day duration | Gap between days | Use case |
|--------|------|-------------|------------------|----------|
| **DEFAULT** | Calendar | 24h (clock times) | 0 | Production |
| **COMPACT** | Calendar | 8.5h | 0 | Compressed testing |
| **PLAYTEST** | Calendar | ~7h (10am start) | 0 | Human playtesting |
| **SPEED_RUN** | Offset | 23 min | 3 min | Fast e2e testing |
| **SMOKE_TEST** | Offset | 5 min | 1 min | Fastest testing |

- **Calendar** presets use fixed clock times (`HH:MM`).
- **Offset** presets scale the canonical event sequence to a target duration, anchored to `Date.now()`.

## Common Combinations

| Name | Kind | Scheduling | Preset | Description |
|------|------|-----------|--------|-------------|
| **Production game** | DYNAMIC | PRE_SCHEDULED | DEFAULT | Real game with real-time alarms |
| **Playtest** | DYNAMIC | PRE_SCHEDULED | SMOKE_TEST | Fast real game for testing (5min days) |
| **Quick test** | STATIC | ADMIN | N/A | Manual control, no alarms, fixed days |
| **Speed run** | DYNAMIC | PRE_SCHEDULED | SPEED_RUN | Automated test (23min days) |

**The most common mistake:** Creating a STATIC/ADMIN game with timestamps in the timeline. Those timestamps are cosmetic — they never fire. Use PRE_SCHEDULED if you want real alarms.

## Alarm Pipeline

```
scheduleManifestAlarms() → PartyWhen SQLite tasks
    → Cloudflare DO alarm fires
    → GameServer.onAlarm()
    → WAKEUP sent to L2
    → processTimelineEvent() finds due events
    → INJECT_TIMELINE_EVENT raised for each
    → L3 state transitions
```

Only runs for PRE_SCHEDULED games. ADMIN games skip the entire pipeline.

## Day Lifecycle

1. **morningBriefing** (L2 entry): increment dayIndex, resolve day (DYNAMIC only), build GM briefing
2. **activeSession** (L3): social + mainStage + activityLayer + dilemmaLayer run in parallel
3. **nightSummary** (L2): process vote result → eliminate player → check game-over
4. Repeat or → **gameSummary** (L4) → **gameOver**

## Cartridge Phases

### Voting
`EXPLAIN` → `VOTING` → `REVEAL` (+ `EXECUTIONER_PICKING` → `WINNER` for Executioner type)

### Arcade Games (per-player)
`NOT_STARTED` → `PLAYING` → `AWAITING_DECISION` → `COMPLETED`

### Prompts/Activities
- Simple: `ACTIVE` → `RESULTS`
- Two-phase (Confession, GuessWho): `COLLECTING` → `VOTING`/`GUESSING` → `RESULTS`

### Sync Decisions (multiplayer games)
`COLLECTING` → (`ROUND_REVEAL` →)* `REVEAL`

### Dilemmas
`ANNOUNCED` → `COLLECTING` → `REVEAL`

## Player IDs

`p${slot_index}` — **1-indexed**. First player is `p1`, not `p0`. Lobby creates slots starting at 1.

## Key File Locations

| Concern | File |
|---------|------|
| Type definitions, schemas | `packages/shared-types/src/index.ts` |
| Event constants, phases | `packages/shared-types/src/events.ts` |
| Timeline generation | `apps/game-server/src/machines/timeline-presets.ts` |
| Game Master | `apps/game-server/src/machines/game-master.ts` |
| Day resolution | `apps/game-server/src/machines/actions/l2-day-resolution.ts` |
| Alarm scheduling | `apps/game-server/src/scheduling.ts` |
| L2 orchestrator | `apps/game-server/src/machines/l2-orchestrator.ts` |
| L3 session | `apps/game-server/src/machines/l3-session.ts` |
| SYNC builder | `apps/game-server/src/sync.ts` |
