# Feature: Dynamic Days

**Status**: Phase 3a+3b complete, Phase 3c+3d pending
**Branch**: `feature/dynamic-days`
**ADRs**: [094] Dynamic Days, [066-068] CONFIGURABLE_CYCLE, [092] DO Persistence, [093] Alarm Delivery

---

## Why This Exists

Pecking Order started with static manifests — the host configures every day upfront at game creation. This works for controlled playtests and small groups, but breaks down as games scale:

1. **Day count is wrong.** An 8-slot game where only 5 join still runs 7 days. Players get bored or confused.
2. **No adaptation.** If a vote type needs 4+ players but only 3 remain alive, the game breaks or falls back silently.
3. **Social limits are frozen.** DM character limits, partner limits, and silver costs are baked in at creation. There's no way to tighten communication as the game narrows.
4. **Inactive players drag the game.** No mechanism to shorten or adjust when players disengage.
5. **Every game feels the same.** The host picks everything upfront; there's no surprise or strategic evolution.

The fix isn't to make static manifests smarter — they serve their purpose for admin-controlled playtests. Instead, we add a second manifest kind that resolves each day at runtime.

## How It Evolved

### Phase 1-2: Foundation (complete, merged to main)

The server refactor (Phase 1) extracted `server.ts` from a 1300-line monolith into focused modules. Phase 2 replaced scattered `gameMode` string matching with a typed `scheduling` strategy (`ADMIN` | `PRE_SCHEDULED`), killing the dead `PECKING_ORDER` and `DEBUG_PECKING_ORDER` modes.

These weren't dynamic days work, but they removed the tech debt that would have made dynamic days risky.

### Phase 3a: Type Foundation (complete)

The manifest became a discriminated union:

```
GameManifest = StaticManifest | DynamicManifest
```

Keyed on `kind: 'STATIC' | 'DYNAMIC'`. Every existing manifest gets `kind: 'STATIC'` — either explicitly (lobby, speed-run, E2E fixtures now emit it) or implicitly (`normalizeManifest()` adds it to legacy snapshots missing the field).

The `GameRuleset` is also a discriminated union (`PeckingOrderRuleset` as the first variant), so adding a new game type means adding a new variant, not modifying existing code.

`DailyManifest` gained optional `dmCharsPerPlayer` and `dmPartnersPerPlayer` fields. L3's `buildL3Context()` reads these with defaults matching the old hardcoded constants.

**Key decision**: No runtime behavior changed. Every game still runs exactly the same. The type system is in place; the runtime follows later.

### Phase 3b: Director Actor + L2 Wiring (complete)

The director (`L2.5`) is an XState actor spawned by L2 alongside L3 in dynamic mode. It does two things:

1. **Resolves the day.** On spawn, its context factory computes the day's config (vote type, game type, social limits) from the ruleset and game state. Pure functions — no side effects, highly testable.

2. **Observes the day.** L2 forwards `FACT.RECORD` events to the director throughout the day. It tracks which players are active and what they're doing. This data feeds future features (inactivity rules, adaptive difficulty).

L2 changes are minimal and behind `manifest.kind === 'DYNAMIC'` checks:
- `activeSession` entry spawns the director and captures its resolved day into `manifest.days[]`
- `FACT.RECORD` handler forwards to the director (no-op if no director exists)
- `nightSummary` / `dayLoop` guards consolidated into `isGameComplete` / `isDayIndexPastEnd`

Static mode is completely untouched — the director is never spawned.

### Phase 3c: Lobby Integration (not started)

The lobby needs to support dynamic mode game creation. The host would configure:
- A `GameRuleset` (which vote types, game types, social scaling rules)
- A `SchedulePreset` (DEFAULT, COMPACT, SPEED_RUN — determines daily timeline timing)
- Max player count

The server receives a `DynamicManifest` with an empty `days[]`. Each morning, the director fills in the next day.

### Phase 3d: Inactivity Rules (not started)

The director already tracks active players via FACT observations. This phase adds:
- Inactivity detection (configurable threshold)
- Nudge → eliminate pipeline
- Admin visibility and override

## Key Architectural Decisions

### Why a discriminated union, not feature flags?

Feature flags (`isStatic: boolean`, `hasDynamicDays: boolean`) create a combinatorial explosion. A discriminated union on `kind` gives TypeScript exhaustive checking and forces every consumer to handle each variant explicitly. Adding a third manifest kind is a compile-time checklist, not a runtime bug hunt.

### Why an actor, not a pure function?

The director needs to accumulate state throughout the day (fact counts, active player tracking) and could eventually emit mid-day events (nudge a player, inject a prompt). A pure `resolveDay()` function can't observe — it can only compute from a snapshot. The actor model gives us both: pure resolution in the context factory, observation via event handling.

### Why `days[]` grows instead of a separate field?

The director appends each resolved day to `manifest.days[]`. This means L3's input pattern (`manifest.days.find(d => d.dayIndex === context.dayIndex)`) works identically in both modes. It also creates an audit trail — you can inspect the manifest to see every day the director resolved.

### Why two game-over guards?

`isGameComplete` (used in `nightSummary`) checks `dayIndex >= days.length` — the day has finished, so `>=` is correct. `isDayIndexPastEnd` (used in `dayLoop.always`) checks `dayIndex > days.length` — the day hasn't run yet, so `>` avoids blocking the last valid day. Collapsing these into one guard caused a regression where the last day was skipped.

## Related Documents

| Document | Purpose |
|----------|---------|
| `plans/architecture/dynamic-days-design.md` | Architectural design (types, director contract, data flow) |
| `plans/architecture/2026-03-08-dynamic-days.md` | Implementation plan (10 tasks, step-by-step) |
| `plans/architecture/server-refactor-and-dynamic-days.md` | Phased roadmap (Phases 1-4) |
| `plans/architecture/granular-orchestration.md` | L3 refactor strategy (deferred, but relevant to future game types) |
| `plans/DECISIONS.md` → ADR-094 | Atomic decision record |

## Key Files

| File | Role |
|------|------|
| `packages/shared-types/src/index.ts` | `GameManifest`, `GameRuleset`, `normalizeManifest()`, `SchedulePreset` |
| `apps/game-server/src/machines/director.ts` | Director actor + `buildDirectorContext()` |
| `apps/game-server/src/machines/actions/l2-day-resolution.ts` | L2 wiring (spawn, capture, forward, guards) |
| `apps/game-server/src/machines/l2-orchestrator.ts` | L2 machine (director lifecycle integrated) |
| `apps/game-server/src/machines/l3-session.ts` | `buildL3Context()` reads social params from manifest |
| `apps/game-server/src/snapshot.ts` | `normalizeManifest()` on snapshot restore |
