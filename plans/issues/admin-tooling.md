# Admin / Lobby Tooling Issues

Issues related to game observability, admin dashboards, and operational tooling.

---

## [ADMIN-001] DO snapshot storage uses legacy KV API — not queryable in Data Studio

**Priority**: HIGH

`GameServer` is declared as SQLite-backed DO (`new_sqlite_classes = ["GameServer"]`), but the snapshot is persisted via the legacy async KV API (`ctx.storage.put("game_state_snapshot", ...)`). On SQLite-backed DOs, KV data is stored in a hidden `_cf_KV` table that cannot be queried via SQL API or Data Studio.

**Impact**: Game state snapshot is completely opaque at rest. No way to inspect past state, debug silver discrepancies, or verify snapshot integrity without deploying new code.

**Data Studio investigation (2026-03-05)**: `_cf_KV` exists in sqlite_master but all SQL operations are blocked (`SELECT * FROM _cf_KV` -> "Error: SQL statement execution failed"). Only way to read: `ctx.storage.get()` inside the DO code.

**Fix**: Migrate from KV to SQL API:
1. Create `snapshots` table: `CREATE TABLE IF NOT EXISTS snapshots (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)`
2. Replace `ctx.storage.put/get` with `ctx.storage.sql.exec`
3. Migrate `goldCredited` boolean to same table
4. On restore, check SQL first, fall back to KV for backward compat, then delete KV entry

**Status**: ✅ FIXED (ADR-092) — SQL `snapshots` table with KV fallback for legacy DOs. Implemented in `snapshot.ts`.

---

## [ADMIN-002] No admin dashboard for game journal replay / silver ledger

**Priority**: Medium

Investigating player silver balances requires hand-crafted SQL against D1 via `wrangler d1 execute`. No UI for replaying economic history.

**What's needed**:
1. **Silver ledger per player**: Running balance from game start, every silver-affecting event with timestamps
2. **Event timeline**: Chronological journal events, filterable by type/player/day
3. **Player summary**: Current silver/gold, status, total DMs, total transfers
4. **Day boundaries**: Visual separation showing state at each day start

**Data source**: D1 `GameJournal` table. Silver-affecting events: SILVER_TRANSFER (explicit), DM_SENT (-1 per msg), PLAYER_GAME_RESULT (silverReward), PROMPT_RESULT (silverRewards).

**Note**: D1 `Players` table only stores initial silver (50) — NOT updated during gameplay. Journal is the only reliable source for historical balances.

**Status**: Documented — needs design and implementation

---

## [ADMIN-003] D1 Players table not updated during gameplay

**Priority**: Low

Players table populated at init with starting silver (50), never updated until `updateGameEnd()` at gameOver. Mid-game D1 queries show stale data.

**Potential fix**: Sync roster state to D1 at end-of-day transitions. Trade-off: more D1 writes, but infrequent (once per 24h per game).

**Status**: Documented — low priority, ADMIN-001 + ADMIN-002 are more impactful

---

## [ADMIN-004] Game status not synchronized between lobby and game server

**Priority**: HIGH

Two separate status systems with no sync:

| System | Statuses | Set by |
|--------|----------|--------|
| Lobby DB (`GameSessions.status`) | RECRUITING -> READY -> STARTED -> ARCHIVED | Lobby server actions |
| Game Server D1 (`Games.status`) | IN_PROGRESS -> COMPLETED | Game server D1 persistence |
| `shared-types GameStatus` enum | OPEN, FULL, IN_PROGRESS, COMPLETED | **Unused** — no code references it |

**Issues**:
1. No completion sync — game server sets COMPLETED, lobby stays STARTED forever
2. No auto-archive — ARCHIVED only via manual admin action
3. CONFIGURABLE_CYCLE status stuck at RECRUITING when not all slots filled (even though game is running)
4. Dead `GameStatus` enum in shared-types

**Fix**:
1. Unify status enum: RECRUITING -> READY -> STARTED -> COMPLETED -> ARCHIVED
2. Game server -> lobby callback on completion (HTTP POST to `/api/internal/game-status`)
3. CONFIGURABLE_CYCLE: transition to STARTED when DO initializes, not when all slots filled
4. Delete/align unused GameStatus enum

**Status**: Documented — needs design

---

## [ADMIN-005] No automatic cleanup of archived/completed games

**Priority**: Medium

No mechanism to clean up old games. DO instances persist with SQLite storage indefinitely. D1 rows accumulate (Games, Players, GameJournal, GameSessions, Invites, PersonaDraws).

**Fix**: Admin cleanup action:
1. Lobby: delete GameSessions/Invites/PersonaDraws for games archived > N days
2. Game server: cleanup Games/Players/GameJournal in D1
3. DO storage: `ctx.storage.deleteAll()` on old game DOs via admin endpoint
4. Consider 30-day retention policy

**Status**: Documented — needs design
