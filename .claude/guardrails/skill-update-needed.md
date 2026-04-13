# Guardrails Needing Update / Promotion

## `finite-arcade-result-integer-coercion` — fires too broadly

**Observed:** During the arcade VFX polish session on 2026-04-12, this
advisory fired on **every single edit** to files under
`apps/client/src/cartridges/games/*/` — roughly 20+ times. The rule is
useful when actually touching `onResult(...)` payloads, but it fires on
VFX changes, render-function tweaks, game-state edits, imports, and
anything else that happens to touch an arcade renderer.

**Action needed:** Tighten the `MATCH_PATTERN` to only fire when the
edit actually touches a result-adjacent construction. Candidates:
- `onResult\s*\(` (the call itself)
- `onResultRef\.current\s*\(`
- A pattern matching the known result field names (`distance:`,
  `score:`, `accuracyPct:`, `perfectLayers:`, `height:`, etc.)

Keep the advisory — it's correct when it matches. Just narrow it.

## `finite-game-dev-harness-local-types` — fires on every harness edit

**Observed:** Same session, same pattern. Fired whenever I edited
`apps/client/src/components/GameDevHarness.tsx` even though I was only
adding a collapsible event log — no new game type involved. The
three-things-to-update warning is valuable, but not on unrelated edits.

**Action needed:** Narrow `MATCH_PATTERN` to only fire on edits that
touch the `GameType` union, the `GAME_DEFS` record, or the
`ARCADE_TYPES` array specifically. Not the whole file.
