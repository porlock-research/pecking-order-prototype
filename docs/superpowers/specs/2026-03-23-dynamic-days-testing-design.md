# Dynamic Days Testing Design

**Date:** 2026-03-23
**Goal:** Thoroughly test dynamic days before the March 24 playtest. Cover the full L2 dynamic tournament lifecycle, timeline generation for all presets, Game Master resolution, voting/elimination, manifest growth, and game completion guards.

## Scope

Three test files:

1. **`timeline-presets.test.ts`** — Backfill: PLAYTEST preset, SMOKE_TEST preset, dilemma conditional events
2. **`game-master.test.ts`** — Backfill: dilemma type resolution (whitelist, avoidRepeat, NONE)
3. **`dynamic-days-integration.test.ts`** — New: multi-day L2 orchestrator integration test

## 1. Timeline Preset Backfill

### PLAYTEST Preset
- Generates calendar-based events (10:00–17:00 UTC per day)
- Day 2 advances to next calendar day at 10:00
- Includes dilemma events when `dilemmaType !== 'NONE'`
- Omits game/activity/dilemma events when their type is `'NONE'`
- Second `OPEN_GROUP_CHAT` at 15:01 (re-opens after activities) — **unique to PLAYTEST preset**, test should assert two `OPEN_GROUP_CHAT` entries
- Verify Day 1 last event (END_DAY) is at 17:00

### SMOKE_TEST Preset
- Offset-based: 5 min day duration, 1 min inter-day gap
- Day 2 base = startTime + 6 min
- Same canonical event sequence as SPEED_RUN (scaled to 5 min)

### Dilemma Conditional Events
- `START_DILEMMA` / `END_DILEMMA` included when `dilemmaType !== 'NONE'`
- Omitted when `dilemmaType === 'NONE'`
- Test across SPEED_RUN (offset) and PLAYTEST (calendar) presets

## 2. Game Master Dilemma Resolution Backfill

### Tests via RESOLVE_DAY
- Whitelist mode: picks from `dilemmas.allowed[]`
- avoidRepeat: skips last played dilemma type
- Returns `'NONE'` when `dilemmas` is undefined on ruleset (distinct code path from mode='NONE')
- Returns `'NONE'` when `dilemmas.mode === 'NONE'`
- Returns `'NONE'` when `dilemmas.allowed` is empty
- Sequence mode: picks by dayIndex

## 3. Multi-Day Integration Test (Main Event)

### Setup
- 4-player roster (p1–p4, **1-indexed** per production convention), all ALIVE, varying silver (p1:100, p2:80, p3:60, p4:40) to make tiebreakers deterministic
- DYNAMIC manifest with SMOKE_TEST preset (5min days, fastest iteration)
- Whitelist voting: `['MAJORITY', 'PODIUM_SACRIFICE']` (avoids BUBBLE which grants immunity to top-3 silver — with 3 alive all become immune)
- Games: NONE (simplify — focus on voting/elimination)
- Activities: NONE
- Dilemmas: NONE
- `dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE' }` → 3 days
- Inactivity disabled (separate concern, already well-tested)

### Test: Full Tournament Lifecycle

Drive L2 through a complete 3-day tournament:

**Day 1:**
1. Send `SYSTEM.INIT` with dynamic manifest → preGame
2. Send `SYSTEM.WAKEUP` → dayLoop → morningBriefing
3. Assert: `manifest.days.length === 1`, resolved day has `dayIndex: 1`, `voteType: 'MAJORITY'`, timeline populated, `nextDayStart` defined
4. L3 invoked, send `ADMIN.INJECT_TIMELINE_EVENT { action: 'OPEN_VOTING' }` to trigger voting
5. Send `VOTE.MAJORITY.CAST` from p1→p4, p2→p4, p3→p4 (majority eliminates p4)
6. Send `ADMIN.INJECT_TIMELINE_EVENT { action: 'CLOSE_VOTING' }` → cartridge calculates result
7. Wait for `CARTRIDGE.VOTE_RESULT` to propagate (voting cartridge reaches final → L3 forwards → L2 stores)
8. Send `ADMIN.INJECT_TIMELINE_EVENT { action: 'END_DAY' }` → nightSummary
9. Assert: p4 ELIMINATED, `completedPhases` has voting entry, `pendingElimination` cleared

**Day 2:**
1. Send `SYSTEM.WAKEUP` → morningBriefing (Day 2)
2. Assert: `manifest.days.length === 2`, day 2 has `voteType: 'PODIUM_SACRIFICE'`, `nextDayStart` defined
3. Open voting with `ADMIN.INJECT_TIMELINE_EVENT { action: 'OPEN_VOTING' }`
4. Send `VOTE.PODIUM_SACRIFICE.CAST` from p1→p3, p2→p3 (eliminates p3)
5. Close voting, assert `pendingElimination` set, then send END_DAY
6. Assert: p3 ELIMINATED, 2 alive (p1, p2), machine in nightSummary

**Day 3 (FINALS):**
1. Send `SYSTEM.WAKEUP` → morningBriefing (Day 3)
2. Assert: `manifest.days.length === 3`, day 3 has `voteType: 'FINALS'`
3. Assert: `nextDayStart` is undefined (last day)
4. Open voting — **eliminated players (p3, p4) are the voters**, alive players (p1, p2) are the targets
5. Send `VOTE.FINALS.CAST` from p3→p1, p4→p1 (p1 wins, p2 eliminated)
6. Close voting, assert `pendingElimination` set with both `winnerId` and `eliminatedId`
7. Send END_DAY → nightSummary → `isGameComplete` fires (winner set) → gameSummary
8. Assert: `winner` set on context (`{ playerId: 'p1', mechanism: 'FINALS' }`), L2 in `gameSummary` state

### Test: Manifest Growth Correctness
- After each morningBriefing, verify `manifest.days[i]` has:
  - Correct `dayIndex`
  - Timeline with expected event count
  - `dmCharsPerPlayer` and `dmPartnersPerPlayer` from social scaling
  - `activityType` and `dilemmaType` absent (not set) when configured as NONE
  - No duplicate dayIndex entries

### Test: isGameComplete Guard
- With 4 players, 3 days of elimination → 1 alive → game complete
- Verify nightSummary transitions to gameSummary (not back to morningBriefing)
- Verify `isDayIndexPastEnd` doesn't fire prematurely

### Test: Roster Elimination Propagates to Game Master
- After Day 1 elimination, Day 2 RESOLVE_DAY receives updated roster
- `totalDays` recalculates based on alive count (3 alive → 2 days remaining)
- But since we started with totalDays=3 and are on day 2, the game still resolves correctly

### Event Flow Pattern Per Day
```
L2.send(SYSTEM.WAKEUP)
  → morningBriefing (incrementDay, sendAndCaptureGameMasterDay, resolveCurrentDay)
  → activeSession (L3 invoked)
L2.send(ADMIN.INJECT_TIMELINE_EVENT { action: 'OPEN_VOTING' })
  → L3 enters voting state, spawns cartridge
L2.send(VOTE.{MECHANISM}.CAST { senderId, targetId })  [repeated per voter]
  → forwarded to L3 → forwarded to voting cartridge
L2.send(ADMIN.INJECT_TIMELINE_EVENT { action: 'CLOSE_VOTING' })
  → forwarded to L3 → forwarded to voting cartridge → calculates result
  → cartridge final state → L3 sends CARTRIDGE.VOTE_RESULT to L2
  → L2 storeVoteResult
L2.send(ADMIN.INJECT_TIMELINE_EVENT { action: 'END_DAY' })
  → raises ADMIN.NEXT_STAGE → nightSummary
  → entry: recordCompletedVoting, processNightSummary (eliminates player),
    processGameMasterActions, sendDayEndedToGameMaster
  → isGameComplete guard: if true → gameSummary; if false → stays in nightSummary
L2.send(SYSTEM.WAKEUP)  [only if game not complete]
  → morningBriefing (next day)
```

### Key Considerations
- **Voting cartridge needs to reach final state** before we inject END_DAY. The CLOSE_VOTING event triggers result calculation synchronously in XState, and the `done` event propagates through L3→L2 within the same synchronous batch. **Always assert `pendingElimination` is set on L2 context before sending END_DAY.**
- **ADMIN.INJECT_TIMELINE_EVENT with END_DAY** raises ADMIN.NEXT_STAGE, which transitions activeSession → nightSummary.
- **nightSummary `always` guard** evaluates immediately after entry actions. If `isGameComplete` returns true, transitions to gameSummary. If false, machine **stays in nightSummary** and requires explicit `SYSTEM.WAKEUP` or `ADMIN.NEXT_STAGE` to proceed to next day. The test must send WAKEUP after Days 1 and 2.
- **FINALS voters are eliminated players**, not alive players. The alive players are the targets/candidates. `VOTE.FINALS.CAST` produces both `winnerId` and `eliminatedId`.
- **BUBBLE voting with few players**: BUBBLE grants immunity to top-3 silver holders. With only 3 alive players, all become immune and no explicit votes are valid — use a different mechanism for small rosters.

## Out of Scope
- Alarm scheduling (requires Cloudflare runtime — test via live E2E if time allows)
- DO persistence/snapshot restore
- Client-side rendering of dynamic manifest
- Push notifications
- Inactivity elimination (already well-tested in isolation)
