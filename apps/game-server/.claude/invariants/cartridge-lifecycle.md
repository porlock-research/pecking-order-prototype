# Cartridge Lifecycle Invariants

## Never kill spawned children directly

Forward termination event → child calculates results → final state → `xstate.done.actor.*` → parent handles.

Killing a child directly means results are never computed and the parent never gets the `done` event.

## Spawned actor registration

Must register machine in `setup({ actors: { key: machine } })` and spawn via key string. If you spawn with a direct machine reference instead of a key string, snapshot restore fails with `this.logic.transition is not a function`.

## Results flow

1. Parent spawns cartridge actor via key string
2. Cartridge runs its logic
3. Cartridge enters final state with results in context
4. `xstate.done.actor.*` fires on parent
5. Parent reads results from the done event
