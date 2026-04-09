# Game Cartridges

## Registries

- **Games**: `src/machines/index.ts` — 12 entries (9 arcade, TRIVIA, REALTIME_TRIVIA, TOUCH_SCREEN + 4 sync decisions)
- **Voting**: `apps/game-server/src/machines/cartridges/voting/_registry.ts`
- **Prompts**: `apps/game-server/src/machines/cartridges/prompts/_registry.ts`
- **Dilemmas**: `apps/game-server/src/machines/cartridges/dilemmas/_registry.ts`

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
