# Game Server

## Architecture

Russian Doll: L1 (Durable Object `server.ts`) → L2 (XState orchestrator `l2-orchestrator.ts`) → L3 (daily session `l3-session.ts`) → L4 (post-game `l4-post-game.ts`).

L2 states: `uninitialized` → `preGame` → `dayLoop` (invokes L3) → `nightSummary` → `gameSummary` (invokes L4) → `gameOver`

Server modules (L1 is a thin shell): `http-handlers.ts`, `ws-handlers.ts`, `subscription.ts`, `machine-actions.ts`, `scheduling.ts`, `snapshot.ts`, `sync.ts`, `global-routes.ts`, `log.ts`

## GET /state Limitation

`GET /state` only returns L2 context (state value, dayIndex, manifest, roster). Does NOT include L3 context (channels, chatLog, cartridge state, day phase). L3 data lives in `snapshot.children['l3-session']` and is only accessible via WebSocket SYNC or the inspector (`INSPECT.SUBSCRIBE`). Use `extractL3Context()`/`extractCartridges()` from `sync.ts` if extending.

**If you need L3 data, do NOT use the /state endpoint.**

## XState v5 Rules

- **`sendParent()` in `assign()`**: Silent no-op. Split into separate actions.
- **Invoked children**: Do NOT receive unhandled parent events. Use explicit `sendTo('childId', event)`.
- **Spawned actor snapshots**: Must register machine in `setup({ actors: { key: machine } })` and spawn via key string, or snapshot restore fails with `this.logic.transition is not a function`.
- **Set/Map in context**: Serialize to `{}` via JSON.stringify. Use `Record<string, true>` instead of `Set`, plain objects instead of `Map`.
- **Entry action batching**: `enqueue.sendTo()` queues delivery until AFTER all entry actions complete. For synchronous reads, use direct `ref.send()` inside `assign()`.
- **`invoke.src` with function**: Treated as callback actor, not key lookup. Use `spawn()` for dynamic dispatch.
- **`enqueue.sendTo('child-id', event)`**: Cannot resolve invoked children. Use `enqueue.raise()` workaround.
- **`spawn()` only in `assign()`**: `spawn()` is NOT available in `enqueueActions()`. If you need to spawn AND do other work, use separate actions: `assign()` for spawn, then another action for the rest.
- **Parallel state name collisions**: Parallel regions (dilemmaLayer, activityLayer, votingLayer) should use unique state names. Using `playing` in multiple layers causes `resolveDayPhase()` to misidentify the phase. Use descriptive names like `dilemmaActive`, `voting`, `dailyGame`.
- **Transient states (`always:`) can be skipped by subscribers**: When entry runs synchronously and `always:` advances in the same microtask (e.g. `dayLoop.morningBriefing → activeSession`), `actor.subscribe` can collapse the transient state's notification into the next stable state's. Don't gate side-effects on `JSON.stringify(snapshot.value).includes('transientName')` — that match silently no-ops when the subscriber misses the intermediate tick. Use synchronously-incremented context fields instead (e.g. `incrementDay` writes the new `dayIndex` before `always:` fires; both transient and stable states report the new value). The 2026-05-02 ticker-history clear in `subscription.ts` was a real instance of this — see commit `3f75e7f`.

## Game Design Rules

These rules come from playtesting. Violating them causes game-breaking bugs or UX regressions.

- **Voting always eliminates**: Every voting mechanism must eliminate exactly one player. `eliminatedId` must NEVER be null. If no one votes, eliminate lowest silver. If tied, use lowest silver. Only exception: FINALS picks a winner.
- **Results shown immediately**: Show voting/game/prompt results as soon as the phase closes. Never delay results to night summary — this is an async game, players shouldn't wait hours.
- **All voting result summaries must show**: vote tallies per player, who voted for whom, and the elimination outcome. Each mechanism stores tallies under different keys — see `CompletedSummary.tsx`.
- **Explain mechanics to players**: Every cartridge should have an explanation. Game Master messages in chat are the preferred approach.

## Cartridge Lifecycle

NEVER kill spawned children directly. Forward termination event → child calculates results → final state → `xstate.done.actor.*` → parent handles.

## Manifest & Scheduling

- **STATIC manifest**: All days pre-computed at game creation. Timeline events have fixed ISO timestamps.
- **DYNAMIC manifest**: Days resolved at runtime by the Game Master actor. Timeline anchored to `Date.now()` on each day start.
- **ADMIN scheduling**: No alarms — game master advances manually via `NEXT_STAGE`. Timeline timestamps are cosmetic only.
- **PRE_SCHEDULED scheduling**: Real PartyWhen alarms fire timeline events automatically.
- **Common trap**: A STATIC/ADMIN game with timestamps in its timeline = timestamps never fire. Use DYNAMIC/PRE_SCHEDULED for real alarms.
- **"Use now" anchoring**: Dynamic timelines use `dayIndex` for WHAT content plays (vote type, game type) and `Date.now()` for WHEN events fire. Never anchor to `startTime + dayOffset`.
- **Calendar preset day cycle**: `computeNextDayStart` for calendar presets always returns `now + 24h`. One game day per real calendar day.
- **Timezone rule**: Calendar preset `clockTimes` are offsets from `firstEventTime`, not absolute UTC. Always test with non-midnight startTimes.
- **Schedule presets**: `SMOKE_TEST` (5min days), `SPEED_RUN` (23min), `PLAYTEST` (4h), `PLAYTEST_SHORT` (5h, 3–8pm), `COMPACT` (6h), `DEFAULT` (24h). See `timeline-presets.ts`.

## PartyWhen Scheduler

Manages the alarm task queue in DO SQLite (`tasks` table). We access internals via `(scheduler as any).querySql(...)` because the public API is limited. The `wakeUpL2` callback is a no-op by design — actual WAKEUP delivery happens in `onAlarm()`.

## DO Persistence

SQL `snapshots` table (key/value/updated_at). No KV for new features.

## Machine Specs

Auto-generated specs live in `docs/machines/`. Run `npm run generate:docs` after modifying state machines. Always read the relevant spec before editing machines to understand the current state structure.

## Testing

- Vitest: `src/machines/__tests__/`. Pattern: create actor → send events → assert snapshots.
- Single test: `npx vitest run src/machines/__tests__/<name>.test.ts`
- After changes to L2/L3 machines, SYNC payload shape, manifest types, or cartridge registries — check if `DemoServer` (`src/demo/`) needs updating.

## Key References

- `plans/DECISIONS.md` — ADR log, **read before making architectural changes**
- `docs/machines/` — auto-generated machine specs, **regenerate after machine edits**
- `spec/spec_master_technical_spec.md` — technical requirements (source of truth)
