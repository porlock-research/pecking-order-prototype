# Architecture Debt

Deep architectural concerns that affect the overall system design. These are cross-cutting issues, not isolated bugs.

---

## [BUG-013] Scheduler alarms lost on DO restart (ADR-012 race)

**Priority**: Medium
**Status**: Fixed (ADR-093)

PartyWhen's Scheduler calls `await this.alarm()` inside `blockConcurrencyWhile` during its constructor — before `onStart()` creates the XState actor. This was a deterministic ordering issue, not a race condition: the Scheduler always processes and deletes tasks before the actor exists.

**Fix (ADR-093)**: WAKEUP is now delivered from `onAlarm()`, where the actor is guaranteed to exist (PartyServer calls `onStart()` before `onAlarm()`). The PartyWhen callback (`wakeUpL2`) is a no-op. The `pendingWakeup` buffer mechanism has been removed. Vestigial `scheduleNextTimelineEvent`/`scheduleGameStart`/`nextWakeup` dead code also removed.

---

## [PROD-016] L3 session state fragile on snapshot restore

**Priority**: Medium — acceptable for coordinated deploys, problematic for always-on production
**Status**: Known architectural limitation

### What's persisted
- `l2`: L2's `getPersistedSnapshot()` (includes L2 context + serialized child references)
- `l3Context.chatLog`: extracted separately (largest piece)
- `tickerHistory`: in-memory ticker buffer

### What's lost on restore
1. **Spawned cartridge actors** — `AnyActorRef` objects don't survive JSON serialization. If DO restarts mid-voting/mid-game, the active cartridge is gone. L3 thinks it's in `voting`/`dailyGame` state but the child doesn't exist.
2. **L3 context fields added after snapshot creation** — old snapshots don't have new fields. Guards/actions read `undefined`.
3. **DM/channel state** — serialized as side effect of XState's child serialization. If L3 child fails to restore, all DM state for the day is lost.

### What a mid-game restart looks like
1. DO restarts -> `onStart()` reads snapshot -> restores L2
2. L2 in `dayLoop.activeSession` -> XState tries to restore L3
3. If L3 restores: state/context correct, but spawned cartridge children lost. Stuck in cartridge state with no child.
4. If L3 fails to restore: snapshot cleared, game resets to `uninitialized`

### Impact
During a live game, a deploy/restart mid-voting/mid-game leaves the game stuck. The next scheduled event (CLOSE_VOTING/END_GAME) force-terminates but the cartridge doesn't exist — `xstate.done.actor.*` never fires.

### Potential fixes
- Persist cartridge state separately and re-spawn on restore
- If L3 is in cartridge state but child missing, force-transition past it
- Use XState v5 `systemId` + persistence for spawned actors
- Separate volatile (cartridges) from durable (roster, economy, chat) state

---

## [BUG-015] No strategy for deploying code changes while games are in progress

**Priority**: CRITICAL
**Status**: Needs design — must be resolved before next playtest
**Related**: ADMIN-001 (KV->SQL migration is a specific instance)

### The Problem

XState actors are ephemeral in-memory objects inside a Durable Object per game. On every DO eviction/deploy, actors are destroyed and recreated from a persisted snapshot blob. When new code changes the machine definition:

```
old snapshot (persisted before deploy) -> createActor(NEW machine, { snapshot: old })
```

XState does NOT validate the snapshot against the machine. It blindly uses whatever context/state it finds.

### Failure Modes

1. New code reads `context.newField` -> `undefined` -> silent bug or crash
2. State renamed -> old snapshot has old state value -> XState can't find it -> throws
3. Child actor ID changed -> L3 lost entirely
4. Guard/action references removed field -> runtime error mid-game
5. Context field type changed -> downstream code breaks

### What We Can Reconstruct from D1

If snapshot is unrestorable, D1 `GameJournal` + manifest provide: alive/eliminated, silver balances, vote history, game/prompt completion. **Cannot** reconstruct: chat log, perk overrides, channel state, in-progress cartridge state.

### Candidate Approaches

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **A. Version stamp + migration** | `version: N` on snapshot, run v3->v4->v5 chain | Precise | Hand-written migration per change |
| **B. Context normalizer** | `normalizeContext(raw)` fills defaults, strips obsolete | Simple, no versioning | Can't handle state hierarchy changes |
| **C. Journal reconstruction** | Rebuild from D1 events + manifest on failure | Game continues | Slow, can't recover chat/ephemeral state |
| **D. Game-pinned machine versions** | Keep old machine defs, running games use original | Zero migration | Massive maintenance burden |
| **E. Hybrid (likely best)** | Version stamp + normalizer + journal fallback | Best coverage | Most implementation effort |

### Hybrid approach detail

1. Stamp `machineVersion` on manifest at game creation
2. On restore, compare snapshot version vs current code version
3. If mismatched, run `normalizeContext()` to fill defaults / strip obsolete
4. Validate restored `state.value` exists in current machine
5. If validation fails, attempt journal reconstruction into known-good state
6. If all else fails, game enters "frozen" state for manual intervention

### Current Guardrails (insufficient)

- `onStart()`: checks if L3 child missing after restore -> clears snapshot and starts fresh
- `onStart()`: catches `createActor` throws -> clears snapshot and starts fresh
- Both fallbacks lose ALL game state — unacceptable for production

---

## [PROD-017] PartyWhen alarm scheduling is opaque and fires unexpectedly

**Priority**: Medium
**Status**: Partially fixed (ADR-071, ADR-077, ADR-078)

### Root causes (addressed)
1. No visibility into task table -> **Fixed**: `/scheduled-tasks` endpoint + admin UI panel
2. Stale tasks survive game state changes -> **Fixed**: auto-flush on game end
3. `querySql()` return shape bug -> **Fixed** (ADR-077)
4. Co-timed events now show combined labels (ADR-078)

### Root causes (remaining)
5. **Alarm chaining invisible**: If chain breaks, it's not obvious why alarms stopped or are firing continuously
6. ~~**Time window filtering fragile**~~: **Addressed** (ADR-093). Window widened to 5min, and delivery is now reliable via `onAlarm()`. Window width is secondary.
7. **PartyWhen replacement**: Direct `ctx.storage.setAlarm()` + hand-managed task list would be simpler and fully inspectable (deferred — current architecture is now robust)

---

## [ARCH-018] Lobby timeline events use Record (no repeated events)

**Priority**: Medium
**Status**: Open — workaround in place for playtest

### Problem
The lobby's `ConfigurableDayConfig.events` is a `Record<string, ConfigurableEventConfig>` — object keys must be unique. This prevents scheduling the same event type twice in one day (e.g., two `OPEN_GROUP_CHAT` windows: 10-12 and 3-4).

### Current workaround
`_2` suffix convention: `OPEN_GROUP_CHAT_2`, `CLOSE_GROUP_CHAT_2`. `resolveActionName()` in `actions.ts` strips the suffix before building the manifest timeline. The server receives two separate `OPEN_GROUP_CHAT` events at different times — works correctly.

### Proper fix
Convert `events` from `Record<string, ConfigurableEventConfig>` to `Array<{ action: string; time: string; enabled: boolean }>`. This requires updating:
- `ConfigurableDayConfig` type
- `buildConfigurableDays()` default generation
- `toISOConfigurableConfig()` date resolution
- Lobby UI: render event list instead of fixed-key grid
- `TIMELINE_EVENT_KEYS` iteration in `buildManifestDays()`

### Related
- `PLAYTEST` schedule preset (`timeline-presets.ts`) already uses arrays — no issue server-side
- Only affects the lobby's game creation UI
