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

## Testing

- Unit tests: `apps/game-server/src/machines/__tests__/`
- `test-cartridge` skill for isolated machine testing
- Every voting mechanism must eliminate exactly one player — test this invariant
