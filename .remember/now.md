# Session Handoff — 2026-04-15

## Branch: `feature/pulse-phase4-push-intent`

14 commits ahead of main. Phase 4 Tasks 8-13 (push/SW/intent plumbing, ChatDivider, silver pip, unread dot, reveal queue, PulseShell routing) are done. `feature/pulse-phase4-catchup` (overlay + Tasks 1-7) is already merged to main.

## What happened this session

Reviewed GM Intelligence Spec A (`docs/superpowers/specs/2026-04-15-gm-intelligence-spec-a-design.md`), then created a SPEED_RUN test game to observe Pulse pill behavior. Found issues with pills not showing results, phantom pills, and stuck lifecycle states.

Investigation traced through `usePillStates.ts`, `CartridgeOverlay.tsx`, `l3-session.ts`, `sync.ts`, and `l3-games.ts`. Initially diagnosed 6 bugs. After reading ADRs 126-131, corrected to **2 real bugs + 1 acknowledged TODO**.

## 2 bugs to fix

### Bug 1: Phantom "Prompt" pill (trivial)

`usePillStates.ts:27` maps `INJECT_PROMPT: 'prompt'` in `ACTION_TO_KIND`. INJECT_PROMPT is a GM briefing message injection, not a prompt/activity cartridge spawn. Dynamic game timelines include INJECT_PROMPT events for GM welcome messages — this creates a permanent "Prompt" pill in the pill bar that never resolves to an active slot, stuck in `lifecycle: 'starting'` forever.

**Fix:** Delete `INJECT_PROMPT: 'prompt'` at `usePillStates.ts:27` and `INJECT_PROMPT: 'Prompt'` at `:35`.

### Bug 2: Game pill stuck in `just-started` after game completes (structural)

`usePillStates.ts:72-74` classifies game pill lifecycle:
```ts
lifecycle: game.phase === 'COMPLETED' ? 'completed'
  : game.phase === 'PLAYING' || game.phase === 'ACTIVE' ? 'in-progress'
  : 'just-started',
```

Per ADR-126 (result-hold), game cartridge actors stay alive in their final state after completion — SYNC continues broadcasting the final-state snapshot so the client can render results. This is correct server behavior.

The problem: trivia and arcade games don't expose a top-level `phase` field. They use per-player `status: 'NOT_STARTED' | 'PLAYING' | 'COMPLETED'` via the projection in `packages/game-cartridges/src/helpers/projections.ts`. So `game.phase` is always `undefined` → the classifier falls through to `'just-started'` permanently, even after the game finalizes.

Prompts work because they expose `phase: 'RESULTS'` (line 84 checks this). Voting works because it exposes `phase: 'REVEAL' | 'WINNER'` (line 58). Games are the broken case.

**How Vivid solved this:** ADR-128.5 — TodayTab checks L3 `phase` (the mainStage state). When mainStage returns to `groupChat` but the game slot still has data, the TodayTab knows the game is completed. Pulse's `usePillStates` doesn't check L3 phase at all.

**Fix options (investigate before choosing):**
1. Check `completedPhases` from L2 (already in the store as `completedCartridges`) — if there's a matching entry, classify as completed
2. Check L3 `phase` (the store's `phase` field) — if it doesn't indicate an active game but the slot has data, classify as completed
3. Add a game-specific field check (e.g., check if game output/result is non-null in the snapshot)
4. Standardize: make game cartridge projections include a top-level `phase` like prompts/voting do

Option 1 or 2 are likely safest. Read `useGameStore.ts` to see what `phase` contains and how `completedCartridges` is populated from `completedPhases`.

## 1 acknowledged TODO (not a bug)

Upcoming/starting pill overlays show empty "Starts soon." instead of cartridge description. The overlay plan's Task 13 has `pillIdToTypeKey()` returning `null` with an inline comment: *"Plan-level item: surface manifest-declared voteType/gameType on the timeline entry so splashes can be specific."* This was explicitly deferred, not overlooked.

## Things that are NOT bugs (don't re-investigate)

- **Active refs persisting after `xstate.done.actor.*`:** ADR-126 result-hold by design. Do NOT add `stopChild` to done handlers.
- **No upcoming pills for ADMIN games:** Intentional — ADMIN manifests have `timeline: []` and the code comment explains the gate.
- **`completedCartridges` pills suppressed by active pills:** Design consequence of result-hold. Fixes when Bug 2 is fixed.

## Key files

- `apps/client/src/shells/pulse/hooks/usePillStates.ts` — pill lifecycle classifier (bugs 1 & 2)
- `apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeOverlay.tsx` — overlay router
- `apps/game-server/src/machines/l3-session.ts` — L3 done handlers (result-hold, don't touch)
- `apps/game-server/src/sync.ts` — SYNC extraction reads from XState `.children` registry
- `packages/game-cartridges/src/helpers/projections.ts` — game cartridge projections (no `phase` field for trivia/arcade)
- `plans/DECISIONS.md` ADRs 126-131 — cartridge lifecycle design decisions

## After fixing bugs

Check remaining Phase 4 tasks (14-19) in `docs/superpowers/plans/2026-04-14-pulse-phase4-catchup.md`. Also pending: overlay Tasks 15-16 (reveal layering verification + Playwright e2e) from `docs/superpowers/plans/2026-04-14-pulse-cartridge-overlay.md`.

## GM Intelligence Spec A

Reviewed this session at `docs/superpowers/specs/2026-04-15-gm-intelligence-spec-a-design.md`. Review notes were discussed but not persisted to a file. Key spec review finding: the spec needs to specify which `TickerCategory` GM_OBSERVATION facts use (Pulse filters narrator lines by specific categories — if it's not one of them, `NarratorLine` won't render). The GM Intelligence memory (`memory/project_gm_intelligence.md`) says this was addressed in review feedback (commit `fb80ce1` added `SOCIAL_NARRATION` category) — verify the spec on that branch reflects this.

## Memory updated

`memory/project_pulse_shell.md` rewritten with corrected bug analysis. New guardrail rule: `.claude/guardrails/finite-cartridge-result-hold.rule` fires on `l3-session.ts` edits to warn about ADR-126.
