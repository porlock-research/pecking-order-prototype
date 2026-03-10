# Phase 3c: Dynamic Mode Lobby Integration — Design

**Status**: Approved
**Date**: 2026-03-09
**Branch**: TBD (off `feature/dynamic-days`)
**Depends on**: Phase 3a (types), 3b/3d (Game Master + inactivity)

---

## Goal

Add dynamic mode game creation to the lobby UI. The host configures boundaries (whitelists, scaling rules, inactivity, day count, schedule preset) — the Game Master decides what happens each day at runtime.

## Architecture

A "Static / Dynamic" toggle on the existing game config page. Dynamic mode replaces the per-day config with a Ruleset Builder.

### Host Configures (Boundaries)

| Section | Fields |
|---------|--------|
| **Allowed Mechanics** | Whitelist of vote types, game types, activity types |
| **Social Scaling** | DM chars (mode/base/floor), DM partners (mode/base/floor), DM cost, group DM toggle |
| **Inactivity** | Enabled, threshold days, action |
| **Day Count** | Mode (ACTIVE_PLAYERS_MINUS_ONE / FIXED), maxDays / fixedCount |
| **Schedule Preset** | DEFAULT / COMPACT / SPEED_RUN |

### Game Master Decides (Runtime)

- Which vote type to use each day (from allowed pool, based on alive count + history)
- Which game type to use (from allowed pool, based on history + variety)
- Which activity type to use (from allowed pool)
- Social scaling is applied as configured (no GM decision)
- Inactivity is evaluated as configured (no GM decision)

## Data Flow

1. Host fills ruleset builder + picks schedule preset
2. Lobby builds `DynamicManifest` (`kind: 'DYNAMIC'`, empty `days[]`, populated `ruleset` + `schedulePreset`)
3. POSTs to `/init` — same endpoint, same two-phase init as CONFIGURABLE_CYCLE
4. Game server handles DynamicManifest via existing discriminated union

## Type Changes

### Ruleset: Strategy → Whitelist

The `PeckingOrderRuleset` voting/games/activities configs evolve from strategy-driven (SEQUENCE/POOL with ordered lists) to whitelists for dynamic mode:

```ts
// Static mode still uses strategy configs (no change)
voting: { mode: 'SEQUENCE', sequence: ['MAJORITY', 'BUBBLE', 'FINALS'] }

// Dynamic mode uses whitelists
voting: { allowed: ['MAJORITY', 'BUBBLE', 'EXECUTIONER', 'PODIUM_SACRIFICE', 'FINALS'] }
```

The Game Master's resolution functions (`resolveVoteType`, `resolveGameType`) change from reading pre-defined sequences to selecting from the allowed pool based on game state.

**Option**: Make the ruleset voting/games/activities configs a discriminated union themselves (strategy | whitelist), or keep them flat with optional fields. TBD during implementation — follow the simplest path that type-checks.

## What Changes Where

| Layer | Change |
|-------|--------|
| **Lobby UI** | Static/Dynamic toggle + ruleset builder component |
| **`actions.ts`** | `createGame()` branches on mode to build Static vs Dynamic manifest |
| **`shared-types`** | Ruleset types gain whitelist fields for voting/games/activities |
| **`game-master.ts`** | Resolution functions read whitelists instead of sequences |
| **Game server** | No structural changes |

## What Doesn't Change

- Static mode — completely untouched
- L2/L3/L4 pipeline
- `/init` endpoint — accepts both manifest kinds
- Observation modules
- Snapshot persistence

## UI Approach

Toggle on existing game config page. When Dynamic:
- Per-day config section replaced by ruleset builder
- Ruleset builder has collapsible sections for each config area
- Whitelists use checkbox groups (all vote/game/activity types)
- Social scaling uses mode dropdowns + numeric inputs
- Inactivity uses toggle + numeric input
- Day count uses mode dropdown + optional numeric input
- Schedule preset uses radio/select

## Future Considerations

### Snapshot Rehydration

The Game Master is long-lived. As new observation modules or config sections are added, in-flight games will have snapshots missing the new fields. Strategy: `normalizeGameMasterSnapshot()` at restore time, same pattern as `normalizeManifest()`. Not Phase 3c scope.

### Presets (Strategy C)

As playtesting reveals winning ruleset configs, graduate them into named presets (e.g., "Classic", "Cutthroat", "Party Mode"). Host picks a preset, optionally overrides individual settings. Not Phase 3c scope.

### Adding New Ruleset Sections

To add a new config section (e.g., economy scaling):
1. Add field + Zod schema to `PeckingOrderRuleset` in shared-types
2. Add resolution logic in `game-master.ts`
3. Add UI section to ruleset builder
4. Add observation module if needed (same `ObservationModule<TState>` contract)

Each section is independent. Zod defaults handle missing fields in old data.
