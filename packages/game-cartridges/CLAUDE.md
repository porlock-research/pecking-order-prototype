# Game Cartridges

## Registries

- **Games**: `src/machines/index.ts` — 16 entries (9 arcade, TRIVIA, REALTIME_TRIVIA, TOUCH_SCREEN + 4 sync decisions). Count may increase as new games are added — check the file for the current count.
- **Voting**: `packages/cartridges/src/voting/_registry.ts` (in `@pecking-order/cartridges`)
- **Prompts**: `packages/cartridges/src/prompts/_registry.ts` (in `@pecking-order/cartridges`)
- **Dilemmas**: `packages/cartridges/src/dilemmas/_registry.ts` (in `@pecking-order/cartridges`)

## Cartridge Lifecycle

1. Parent spawns cartridge actor via key string (registered in `setup({ actors })`)
2. Cartridge runs its game/vote/prompt logic
3. When done, cartridge enters final state with results
4. `xstate.done.actor.*` fires, parent reads results
5. **NEVER kill spawned children directly** — always let them reach final state

## Arcade Factory

Arcade games use the factory pattern in `src/machines/arcade-factory.ts`. The factory wraps game-specific config into a standard XState machine with common lifecycle states.

## Adding a new arcade game — 10-point integration checklist

The game appears to "work" in GameDevHarness via its own separate registry, so it's easy to miss the client-side wiring. Verify all 10 touchpoints:

### Shared types (4)
1. `GameTypeSchema` in `packages/shared-types/src/index.ts`
2. `GAME_TYPE_INFO` in `packages/shared-types/src/game-type-info.ts` (name + description)
3. `Config.game.<name>` in `packages/shared-types/src/config.ts` (timeLimitMs + reward divisors)
4. `GAME_POOL` in `packages/shared-types/src/cycle-defaults.ts` (minPlayers)

### Cartridge (3 — note DUAL barrel)
5. Machine file in `packages/game-cartridges/src/machines/<name>.ts`
6. `GAME_REGISTRY` + export in `packages/game-cartridges/src/machines/index.ts`
7. Re-export in `packages/game-cartridges/src/index.ts` (the outer barrel)

### Client (3 — all easy to miss, harness bypasses these)
8. `GAME_COMPONENTS` in `apps/client/src/components/panels/GamePanel.tsx` (lazy import). Without this, the real game panel renders nothing for the new type.
9. `GAME_STAT_CONFIG` in `apps/client/src/cartridges/games/shared/Leaderboard.tsx`. Without this, leaderboard shows no stat for the game.
10. `GameDevHarness.tsx` — `GameType` union + `GAME_DEFS` + `ARCADE_TYPES` array (for local dev only).

### Commonly missed
- Client harness wiring (#10) — game will not surface in `/dev/games` without it.
- Client production wiring (#8, #9) — game "works" in harness but breaks in real-game flow.
- `LIVE_GAMES` exclusion — confirm the game is NOT in this set (solo arcade games are never live).
- `ClientEvent` union in `shared-types/src/index.ts` (`GAME.X.START` / `GAME.X.RESULT` types).
- DemoServer impact check (`apps/game-server/src/demo/`).
- `renderBreakdown` prop on the wrapper component.
- `GAME_STAT_CONFIG` should use a distinctive stat, not generic "score".
- Result payload values must be integers (arcade machine floors everything at `arcade-machine.ts:139`).
- `timeElapsed` is server-injected — the client must NOT send it in `onResult`.

## Testing

- Unit tests: `apps/game-server/src/machines/__tests__/`
- `test-cartridge` skill for isolated machine testing
- Every voting mechanism must eliminate exactly one player — test this invariant
