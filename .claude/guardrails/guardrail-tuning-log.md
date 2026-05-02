# Guardrails Needing Update / Promotion

## Resolved 2026-04-24 (retirement pass — 72 → 63 rules)

**Retired (8):**
- `finite-decisions-before-architecture` — path-only on commonly-edited server files; advice duplicates root CLAUDE.md "Key Documentation" section pointing at `plans/DECISIONS.md`.
- `finite-ticker-update-not-sync` — duplicated by memory `reference_facts_ticker_pipeline.md`; `MATCH_PATTERN` matched any path containing "ticker" (too broad). Previously flagged "low urgency" below — closing the loop.
- `finite-game-id-format` — duplicated by memory `reference_lobby_logs_shape.md` + `reference_axiom_sre.md`.
- `finite-nudge-player-scoped` — misconfigured: `MATCH_PATTERN` contained code patterns, not file paths. Content lives in memory `reference_nudge_whisper_main_only.md`.
- `finite-silver-transfer-channel-auth` — same misconfiguration as nudge-player-scoped; covered by same memory.
- `finite-send-silver-no-channel-id` — same misconfiguration; regression test at `apps/client/src/hooks/__tests__/silverRouting.test.ts` already guards the invariant. Memory `reference_silver_routes_to_1on1_dm.md` covers behavior.
- `guardrail-pattern-specificity` — self-referential advice now lives in `.claude/guardrails/README.md`.
- `finite-projection-strips-mid-phase` — empty `ADVISORY:` body (fires but injects nothing); covered by `finite-verify-fields-against-projections` with a real body and `feedback_verify_projection_fields` memory.

**Fixed (1):**
- `finite-raf-dt-can-be-negative` — was using invalid `MATCH_FILE_GLOBS:` field (guardian.sh doesn't parse it), and `MATCH_PATTERN` carried code patterns instead of a file path. Rule was almost certainly not firing in its intended contexts. Rewrote with `MATCH_PATTERN: apps/client/src/cartridges/.+Renderer\.tsx$` and `MATCH_CONTENT` holding the RAF symbols. Added kill condition.

**Promoted (2):**
- `finite-arcade-spec-integration-checklist` → `packages/game-cartridges/CLAUDE.md` ("Adding a new arcade game — 10-point integration checklist"). A 10-point checklist is more naturally procedural documentation than an injected advisory, and the cartridge package is where agents start when adding a game.
- `finite-pulse-mockup-conventions` → `docs/reports/pulse-mockups/README.md`. Conventions belong beside the files they govern.

**Still pending from 2026-04-16 (updated):**
- `broad-commit-check-artifacts` — unchanged. Still fires on every `git commit` but advisory is short and appears to be doing useful work (today's session-start flagged 14 stale .png files at project root).

## Resolved 2026-04-24 (tightening pass — 10 rules gated)

Follow-on to the retirement pass. All 10 tighten-candidates listed below
now have `MATCH_CONTENT` gates; regexes hand-tested against positive and
negative inputs.

Arcade / canvas renderers (previously fired on every renderer edit):
- `finite-arcade-end-game-single-flag` — `(elapsed\s*[><]=|setTimeout\s*\([^)]*finish|let ending|ending\s*=\s*(true|false)|solveCelebrate|gameOver\s*\|\|\s*ending)`
- `finite-arcade-pickup-place-ownership` — `(floating\s*=\s*\{|floating\.(phase|fromTube)|pickupFromTube|tryPlaceInto|tubes\[|dropSelected)`
- `finite-canvas-theme-capture-at-init` — `(useCartridgeTheme|themeRef\.current|gameLoop\s*=\s*useCallback|colorKey|DEFAULT_CARTRIDGE_THEME|setTheme\()`
- `finite-canvas-trail-sampling-threshold` — `(trail\.(length|unshift|push|pop|shift)|THRESHOLD|sampling|arc-?length)`
- `finite-canvas-playtest-hidden-tab` — `(visibilityState|document\.hidden|cancelAnimationFrame|...|chrome-profile|--isolated)` (tightened to fire only on visibility/RAF plumbing or chrome-profile diagnostics, not every renderer edit)

Misconfigured `MATCH_PATTERN` (code patterns moved to `MATCH_CONTENT`,
file scope added to `MATCH_PATTERN`):
- `finite-arcade-result-integer-coercion` — now scoped to `apps/client/src/cartridges/games/.+Renderer\.tsx$`
- `finite-ts-config-as-const-literal-pin` — now scoped to `(packages/game-cartridges/src/machines/|apps/client/src/cartridges/games/).+\.(ts|tsx)$`
- `finite-game-dev-harness-local-types` — now scoped to `apps/.*GameDevHarness\.tsx$`

Broad path rules:
- `finite-claude-md-placement` — gated on structural additions (`^#{2,4}\s+[A-Z]|NEVER|ALWAYS|^\*\*|MUST|Don't|Do not|should never`) so minor copy edits don't fire the full 33-line rubric.
- `finite-shared-types-rebuild` — gated on export/type declarations so comment and formatting edits skip the advisory.

## Resolved 2026-04-16 (noise-reduction pass)

- `finite-reactions-not-persisted` — **deleted**. Premise became false once
  `feature/pulse-shell-phase1` merged to main (d65af1b); `Events.Social.REACT`,
  L3 handler, and SYNC delivery are all live.
- `finite-zustand-selector-fresh-objects` — added `MATCH_CONTENT` requiring
  one of: `memoSelector(`, `export const|function select`, `useGameStore(... => {|[`,
  `useShallow(`. Skips bare field-access selectors like `useGameStore(s => s.foo)`.
- `finite-stableref-for-mutable-fields` — added `MATCH_CONTENT` requiring one of:
  `stableRef(`, a collection field used as an object key (`chatLog:`,
  `channels:`, etc.), `Events.System.SYNC`, or the `sync: (data` reducer
  signature. Skips action-only or interface-only edits.
- `finite-inject-timeline-silent-noop` — added `MATCH_CONTENT` requiring a
  spawn action name, a `manifest.(game|activity|dilemma)Type` read, or the
  `INJECT_TIMELINE_EVENT` keyword. Skips unrelated edits to those action files.
- `broad-machines-read-specs` — added `MATCH_CONTENT` requiring structural
  markers (`createMachine(`, `setup(`, `initial:`, `states: {`, `invoke: {`).
  Skips handler/guard-only edits.
- `finite-dev-server-wrong-worktree` — removed bare `vite( |$)` match that
  caught `vite build`. Still fires on `lsof`, `npm run dev`, `wrangler dev`.
- `finite-narrator-lines-fact-driven` — added `MATCH_CONTENT` requiring a
  narrator-adjacent symbol (`useNarratorLines`, `SOCIAL_INVITE`, `NarratorLine`,
  `channels.filter`, `createdBy`, `memberIds.length`, `factToTicker`).
  Phase 4 T13 session had it firing ~6× on unrelated ChatView edits.
- `finite-invite-mode-pending-members` — added `MATCH_CONTENT` requiring
  `pendingMemberIds`, `.memberIds`, `addChannelMember`, `createChannel`,
  `emitChatFact`, `emitInitialDmInvite`, `requireDmInvite`, or `ACCEPT_DM`.
  Phase 4 T8–T10 had it firing ~5× on unrelated push-triggers edits.
- `finite-cartridge-theme-color-keys` — rule was a silent no-op due to a PCRE
  lookahead in BSD grep and a content pattern in the wrong field. Moved the
  pattern to `MATCH_CONTENT`, added a proper file-scope `MATCH_PATTERN` for
  `packages/game-cartridges/` and `apps/client/src/cartridges/`, and rewrote
  the lookahead `colors[(?!.*|)` as the positive class `colors[[^|]+]`.

## Resolved 2026-04-15

- `finite-pulse-bio-as-stereotype` — narrowed MATCH_PATTERN to
  `(CastCard|DmHero|DmBioQuote|PlayerProfile).*\.tsx$` (option B).
- `finite-stableref-for-mutable-fields` — added skip-if preamble to advisory
  (option 4). Superseded by the 2026-04-16 content-aware gate.
- `finite-zustand-selector-fresh-objects` — added skip-if preamble to advisory
  (option C). Superseded by the 2026-04-16 content-aware gate.

## Resolved 2026-05-02 (single-line shortening)

- `broad-commit-check-artifacts` — shortened advisory to a single line per the
  option flagged in 2026-04-16's "low urgency" note. Bash-side diff gating is
  still not feasible without a guardian refactor; KILL_CONDITION on the rule
  documents the trigger that would let the advisory re-expand. Closing the
  log entry — rule is now "as quiet as possible without infrastructure work."

## Confirmed empty 2026-04-29

The "Tighten candidates identified 2026-04-24 (not yet done)" list previously
held here is fully covered by the "Resolved 2026-04-24 (tightening pass — 10
rules gated)" section above. No guardrail commits between 2026-04-24 and
2026-04-29, so no new candidates have surfaced.
