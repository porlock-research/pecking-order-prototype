# Pulse Pill/Cartridge System — Comprehensive Bug Analysis

**Date:** 2026-04-15
**Branch:** `feature/pulse-phase4-push-intent` (14 commits ahead of main)
**Methodology:** Live SPEED_RUN and SMOKE_TEST games via Chrome DevTools MCP, multi-tab inspection of Zustand store state via React fiber walking, cross-referenced against `plans/DECISIONS.md` ADRs 126-131, `docs/superpowers/specs/2026-04-14-pulse-cartridge-overlay-design.md`, and `docs/superpowers/plans/2026-04-14-pulse-cartridge-overlay.md`.

## Scope of this analysis

This document covers the Pulse shell's cartridge pill bar (`usePillStates.ts`) and full-screen overlay (`CartridgeOverlay.tsx`) — specifically how the client renders cartridge lifecycle state across the 4 cartridge kinds (voting, game, prompt, dilemma) and multiple days.

**Not covered:** The cartridge overlay's entry animation, DM sheet behavior, narrator lines, push notifications, or the underlying cartridge XState machines themselves.

---

## Architectural context (for grounding)

The cartridge lifecycle involves four coupled components:

1. **Server L3 session** (`apps/game-server/src/machines/l3-session.ts`) — parallel regions: mainStage (groupChat/dailyGame/voting), activityLayer, dilemmaLayer. `mainStage.dailyGame` and `mainStage.voting` are sequential; activity and dilemma are parallel to mainStage.

2. **ADR-126 result-hold design** — cartridge actors INTENTIONALLY stay alive in their final state after reaching `xstate.done.actor.*`. They are NOT stopped on completion. Cleanup only happens when (a) the day ends (XState auto-stops children on final state via day-loop transition) or (b) a new same-type cartridge spawns via `stopPreviousXxxCartridge` entry action.

3. **SYNC extraction** (`apps/game-server/src/sync.ts:20-52`) — reads active cartridge data from `l3Snap.children['activeXxxCartridge']?.getSnapshot()?.context`. Because of ADR-126, completed cartridge actors remain in the `.children` registry and keep broadcasting their final-state snapshot. This is how the client renders results — the "active slot" contains the final context.

4. **Client store** — `activeVotingCartridge`, `activeGameCartridge`, `activePromptCartridge`, `activeDilemmaCartridge` slots populated from SYNC; `completedCartridges` derived from L2's `context.completedPhases` accumulator (populated in `l2-economy.ts` by `forwardVoteResultToL2` / `forwardGameResultToL2` etc.).

5. **Phase 4 §0.1** — introduced stable `cartridgeId` scheme `${kind}-${dayIndex}-${typeKey}` on both active and completed cartridge projections (commit `b037c76`). Used by overlay focus, deep-link intents, and unread tracking.

Understanding these pieces is load-bearing: several issues I initially classified as bugs turned out to be consequences of ADR-126 that the client hasn't adapted to.

---

## Already fixed on this branch (commit `e8aeeb1`)

Two bugs from an earlier handoff were fixed in `fix(pulse): remove phantom INJECT_PROMPT pill + fix game pill lifecycle classifier`:

### F1. Phantom INJECT_PROMPT pill — FIXED
Previously `INJECT_PROMPT` was mapped to `'prompt'` in `ACTION_TO_KIND`, creating a perpetual ghost "Prompt" pill for GM briefing injections. Fix deleted the mapping. INJECT_PROMPT is a GM DM injection, not a cartridge spawn.

### F2. Game classifier fell through to `just-started` forever — FIXED
Previously `usePillStates.ts:72-74` only checked `game.phase === 'COMPLETED'`, but trivia/arcade expose `status` not `phase`. Fix at line 71-80 adds `game.status === 'COMPLETED'`, `game.allPlayerResults`, and `gameInCompleted` fallbacks. **However, this introduced regression A below.**

---

## Confirmed current bugs (by priority)

### CRITICAL bugs

#### B1. `gameInCompleted` check is too broad (regression from e8aeeb1)

**File:** `apps/client/src/shells/pulse/hooks/usePillStates.ts:71`

```ts
const gameInCompleted = completed?.some(c => c.kind === 'game');
const gameLifecycle: PillLifecycle =
  game.phase === 'COMPLETED' || game.phase === 'REVEAL'
    || game.status === 'COMPLETED' || game.allPlayerResults
    || gameInCompleted   // ← too broad
    ? 'completed'
  : …
```

`gameInCompleted` matches ANY completed game entry. Once Day 1's game completes, every subsequent day's game pill is classified `completed` regardless of its actual state. Same pattern is NOT applied to voting/prompt/dilemma (they only check `phase`), so the regression is game-specific but breaks the same-kind-per-multiple-days case.

**Live evidence:** Day 2 game SEQUENCE (active, just spawned) showed `lifecycle: 'completed'` because Day 1's TRIVIA was in `completedCartridges`.

**Root cause:** The check asks "does a completed game exist anywhere?" when it should ask "is THIS specific cartridge completed?" using the `cartridgeId` scheme.

**Fix:** Replace `gameInCompleted` with a cartridgeId-specific match:
```ts
const gameCartridgeId = `game-${dayIndex}-${game.gameType}`;
const thisGameCompleted = completed?.some(c => c.cartridgeId === gameCartridgeId || c.key === gameCartridgeId);
```

#### B2. Day N completed cartridges persist into Day N+1+

**File:** `apps/client/src/shells/pulse/hooks/usePillStates.ts:113-127`

```ts
if (completed) {
  for (const c of completed) {
    const existingId = c.kind === 'voting' ? 'voting' : c.kind;
    if (!pills.some(p => p.id === existingId)) {
      pills.push({ id: `completed-${c.kind}-${typeKey}`, … });
    }
  }
}
```

No filtering by `dayIndex`. `completedCartridges` accumulates across the entire game — by Day 3, the pill bar shows Day 1 voting + Day 2 voting + Day 3 voting (if not all finals).

**Live evidence:** On Day 2, pill bar rendered Day 1's `completed-prompt-HOT_TAKE` and `completed-voting-BUBBLE` alongside Day 2's own cartridges. Expected 3 pills for Day 2, got 6.

**Fix:** Filter to current day:
```ts
for (const c of completed) {
  if (c.dayIndex !== dayIndex) continue;
  …
}
```

(Requires `dayIndex` on the `CompletedCartridge` shape — verify the server projection includes it per Phase 4 §0.1.)

#### B3. Cartridge overlay shows wrong result for misclassified cartridges

**File:** Downstream consequence of B1.

Because Day 2's active game is misclassified as `completed`, tapping its pill routes to `CartridgeResultCard` (via `CartridgeOverlay.tsx:122`). The result card pulls from `completedCartridges` and renders Day 1's TRIVIA results under the header "Sequence" — visible "Game Over · Top Rewards: Bella +0, Silas +0, Brenda +0" when the game hasn't even started.

**Live evidence:** Screenshot captured at `/tmp/sequence-wrong-result.png`.

**Impact:** Players on multi-day games with same-kind cartridges (e.g., two games across two days) cannot reach the playable game on Day 2+. The pill always opens a stale result card.

**Fix:** Resolves automatically when B1 is fixed.

### HIGH priority bugs

#### B4. Starting/upcoming pills not suppressed by same-kind active/completed pills

**File:** `apps/client/src/shells/pulse/hooks/usePillStates.ts:133-136`

```ts
const alreadyActiveOfKind = pills.some(
  p => p.kind === kind && p.lifecycle !== 'completed' && p.lifecycle !== 'upcoming',
);
if (alreadyActiveOfKind) continue;
```

The skip check excludes `'completed'` and `'upcoming'` from suppression. Consequence:
- After Day 1's game completes: the timeline entry for Day 1's START_GAME is still in `day.timeline[]`. Its timestamp is past-due, so the loop at `:146-157` emits a stale `'starting'` pill — not suppressed by the completed game pill of the same kind.
- Upcoming pills from Day 2's timeline don't suppress each other correctly if the active slot is populated.

**Live evidence:** 6 pills rendering on Day 1 elimination phase: `completed-game-TRIVIA`, `completed-prompt-HOT_TAKE`, `completed-voting-BUBBLE`, `starting-START_GAME-…`, `starting-START_ACTIVITY-…`, `starting-OPEN_VOTING-…`. Only the first 3 are relevant; the 3 starting pills are stale.

**Fix:** Include `'completed'` in the suppression check:
```ts
const alreadyRepresented = pills.some(p => p.kind === kind);
if (alreadyRepresented) continue;
```

Or more defensively, check by `cartridgeId` match when available.

#### B5. Voting `needs-action` classifier uses global vote count

**File:** `apps/client/src/shells/pulse/hooks/usePillStates.ts:57-60`

```ts
lifecycle: voting.phase === 'REVEAL' || voting.phase === 'WINNER' ? 'completed'
  : castCount > 0 ? 'in-progress'
  : 'needs-action',
```

If ANY player votes, `castCount > 0` → ALL players see `in-progress`, losing the `!` badge. Players who haven't voted yet get no visual reminder.

**Code comment at line 62 literally says:** `playerActed: false, // Will be refined when we have playerId context`

This is a known TODO. The classifier needs `playerId` from the store and should check `voting.votes[playerId]`.

**Live evidence:** After P1 voted, P2's tab showed `BUBBLE VOTE 1/5` without `!` badge even though P2 hadn't voted.

**Fix:** Add `playerId` to the hook's reads and refine classifier:
```ts
const playerId = useGameStore(s => s.playerId);
const playerActed = playerId ? Boolean(voting.votes?.[playerId]) : false;
lifecycle: voting.phase === 'REVEAL' || voting.phase === 'WINNER' ? 'completed'
  : playerActed ? 'in-progress'
  : 'needs-action',
```

Same pattern should be applied to prompt (`prompt.stances?.[playerId]` or `prompt.responses?.[playerId]`) and dilemma.

### MEDIUM priority

#### B6. `CartridgeResultCard` renders sparse content for voting results

**File:** `apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeResultCard.tsx`

For voting, the card renders only:
- "Completed" chip
- "Vote Resolved" title
- "Full details in chat." footer
- (Maybe eliminated player name if `snap.eliminatedPlayerId` resolves)

No tally display, no voter attribution, no immunity explanation. The `EliminationReveal` modal shows the elimination dramatically, but the persistent result card is empty.

Compared to Vivid's `CompletedSummary.tsx` (per ADR-129.1), which renders: "tallies + vote bars + voter attribution + immune/abstainer badges."

**Root cause:** Per the plan's Task 12 comment: *"The detailed per-kind result schema is a plan-level item (spec §11); for v1 we render a best-effort view."* This is acknowledged-deferred work, but bumps into real UX pain because the result card is the primary way players review the vote.

#### B7. Upcoming pills show generic labels for dynamic-day cartridges

**File:** `apps/client/src/shells/pulse/hooks/usePillStates.ts:139-157` + `CartridgeOverlay.tsx:129-138`

Day 2's upcoming Activity pill renders with label "Activity" instead of "Would You Rather" even though the manifest has `activityType: 'WOULD_YOU_RATHER'` resolved for Day 2. Similarly, Vote pill shows "Vote" instead of "Majority Vote".

Upcoming pills get no `cartridgeData`, so `resolveTypeKey()` returns `'UNKNOWN'` and the splash renders fallback copy ("Starts soon.") instead of the full `CARTRIDGE_INFO` entry.

**Per the plan's Task 13:** `pillIdToTypeKey()` returns `null` with comment *"Plan-level item: surface manifest-declared voteType/gameType on the timeline entry so splashes can be specific."* Known TODO.

**Fix:** Attach `cartridgeData` with the appropriate type field to upcoming pills, sourced from `day.voteType`/`day.gameType`/`day.activityType`/`day.dilemmaType` at the manifest level.

### LOW priority

#### B8. Duplicate "Chat opens at dawn" static text during elimination phase

**Evidence:** Snapshot during Day 1 elimination phase contained two StaticText nodes with identical content at different uids (uid=15_4 and uid=15_5). Likely a component double-render or a conditional that renders in two branches.

**File to investigate:** Likely in PulseShell's chat-closed state handling.

---

## Not bugs (confirmed via ADRs/code comments)

### NB1. Active cartridge refs persist after `xstate.done.actor.*`
**Per ADR-126.3:** cartridge actors are intentionally kept alive in their final state so SYNC broadcasts results. Cleanup only on day-end or new same-type spawn. Previous diagnosis that recommended adding `stopChild` would have reintroduced the exact problem ADR-126 solved (GH #113, #72 — results never rendering because next SYNC delivered null).

### NB2. No upcoming pills for ADMIN games
**Per `usePillStates.ts:121` code comment:** *"PRE_SCHEDULED only — ADMIN events have no fixed times."* ADMIN manifests have `timeline: []` — even removing the gate would yield nothing. An actual fix would require sourcing upcoming pills from day-level manifest fields (day.gameType / day.activityType / day.voteType / day.dilemmaType) — related to B7, but scoped to ADMIN.

### NB3. Voting auto-closes with partial votes
In SMOKE_TEST, the voting window is short (by design). CLOSE_VOTING alarm fires regardless of vote count. Per game-server CLAUDE.md: *"Voting always eliminates: Every voting mechanism must eliminate exactly one player. eliminatedId must NEVER be null. If no one votes, eliminate lowest silver."* Working as intended.

### NB4. Dramatic reveals replay per-tab
Each browser tab maintains its own `revealsSeen` in localStorage. Opening a new tab replays the elimination reveal. This is documented in Phase 4 spec §1 surface row #7: *"Reveals fire once per device."* Working as intended.

---

## Suggested fix sequencing

Most of these bugs live in ONE file: `apps/client/src/shells/pulse/hooks/usePillStates.ts`. A single targeted refactor can resolve B1-B5 cohesively:

### Refactor sketch

1. **Read `playerId` and `dayIndex` from store.**
2. **Build an active-cartridge-first pill list** keyed by `cartridgeId` (`${kind}-${dayIndex}-${typeKey}`).
3. **Use `completedCartridges` as a per-cartridge completion signal**, matched by `cartridgeId`, not by kind.
4. **Filter completed pills to current dayIndex.**
5. **Check `playerActed` from `votes[playerId]` / `stances[playerId]` / etc. for `needs-action` classification.**
6. **Suppress upcoming/starting pills only if a pill of same `cartridgeId` already exists** (not just same kind).

Rough shape:

```ts
export function usePillStates(): PillState[] {
  const voting = useGameStore(s => s.activeVotingCartridge);
  const game = useGameStore(s => s.activeGameCartridge);
  const prompt = useGameStore(s => s.activePromptCartridge);
  const dilemma = useGameStore(s => s.activeDilemma);
  const completed = useGameStore(s => s.completedCartridges);
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);
  const playerId = useGameStore(s => s.playerId);

  return useMemo(() => {
    const pills: PillState[] = [];
    const thisDayCompleted = completed?.filter(c => c.dayIndex === dayIndex) ?? [];

    // Active voting
    if (voting) {
      const cartridgeId = `voting-${dayIndex}-${voting.mechanism || voting.voteType}`;
      const thisCompleted = thisDayCompleted.some(c => c.cartridgeId === cartridgeId);
      const playerActed = playerId ? Boolean(voting.votes?.[playerId]) : false;
      pills.push({
        id: cartridgeId,
        kind: 'voting',
        label: prettyLabel(voting.mechanism || voting.voteType, 'Vote'),
        lifecycle:
          voting.phase === 'REVEAL' || voting.phase === 'WINNER' || thisCompleted ? 'completed'
          : playerActed ? 'in-progress'
          : 'needs-action',
        playerActed,
        cartridgeData: voting,
      });
    }

    // … similar for game/prompt/dilemma …

    // Completed pills for this day not already represented
    for (const c of thisDayCompleted) {
      if (!pills.some(p => p.id === c.cartridgeId)) {
        pills.push({ id: c.cartridgeId, kind: c.kind, … lifecycle: 'completed' });
      }
    }

    // Timeline-driven upcoming/starting — only if no pill of same cartridgeId exists
    // (requires resolving manifest day-level fields to typeKeys for upcoming pills)
    …
  }, [voting, game, prompt, dilemma, completed, manifest, dayIndex, playerId]);
}
```

### Separate work items

- **B6 (sparse result card):** Needs per-kind detail implementation. Follow Vivid's `CompletedSummary.tsx` as precedent. Plan-level item already acknowledged.
- **B7 (generic upcoming labels):** Requires `cartridgeData` on upcoming pills sourced from manifest day-level fields. Plan-level item.
- **B8 (duplicate chat-closed text):** Needs separate investigation in PulseShell's rendering.

### Testing strategy

- **Unit:** `usePillStates.test.ts` — cases for each bug (multi-day persistence, same-kind skip, playerActed classifier, starting suppression)
- **Integration:** Create a fixture with Day 1 completed cartridges + Day 2 active cartridges, assert pill list has exactly 3 Day-2 pills
- **E2E:** Extend `e2e/tests/pulse-cartridge-overlay.spec.ts` with a 2-day SMOKE_TEST, assert Day 2's game pill opens the playable panel (not the result card)

---

## Evidence artifacts

- `/tmp/game-edrovi-p1.png` — Day 1 social phase, 5 pills rendered
- `/tmp/bubble-vote-overlay.png` — Voting overlay with 3 immune + 2 targets
- `/tmp/elimination-view.png` — DramaticReveal stacked above Bubble Vote completed overlay
- `/tmp/day2-start.png` — Day 2 showing stale Day 1 pills alongside new cartridges
- `/tmp/sequence-wrong-result.png` — Clicking Day 2's SEQUENCE pill opens Day 1 TRIVIA result card
- `/tmp/pecking-order-test-game.json` — Test game config (EDROVI, 5 players, SMOKE_TEST, 3 days, BUBBLE→MAJORITY→FINALS, TRIVIA+SEQUENCE, HOT_TAKE+WOULD_YOU_RATHER)

## Memory / guardrail updates captured this session

- `.claude/guardrails/finite-cartridge-result-hold.rule` — fires on `l3-session.ts` edits to warn about ADR-126
- `memory/project_pulse_shell.md` — rewritten with corrected understanding (2 real bugs from initial analysis, 3 not-bugs)
- `memory/feedback_read_adrs_before_diagnosing.md` — reminder to check DECISIONS.md before classifying cartridge-lifecycle "bugs"

---

## Honest assessment of this analysis

This analysis is the product of **multiple correction cycles by the user**. My first pass classified 6 bugs, 4 of which were wrong. Refined iteratively:

1. First pass: 6 bugs proposed
2. After ADR-126 read: 3 of 6 were by-design, 1 acknowledged TODO, 2 real
3. After discovery that commit `e8aeeb1` already fixed those 2: refactored testing surfaced new multi-day bugs (B1-B4) that weren't visible in the single-day test
4. Current list: **5 real bugs, 2 acknowledged TODOs, 1 minor UI double-render** — all confirmed against live observations

**Remaining uncertainty:**
- B1's fix requires the `cartridgeId` to be consistently present on both active and completed cartridges. Phase 4 §0.1 added it; the implementation plan says it's done (commit `b037c76`) but I didn't verify the shape on live SYNC data in this round.
- B8 (duplicate text) has no identified root cause — just an observation.
- B6/B7 are acknowledged plan-level items; the decision is "keep deferred" vs "promote to active."

**What to verify with the second agent:**
1. Is the `cartridgeId` shape truly on every completedCartridge and active cartridge projection today? (Phase 4 §0.1 compliance check.)
2. Does `completedCartridges[i].dayIndex` exist on the client shape? (Required for B2 fix.)
3. Is the Vivid `CompletedSummary.tsx` cleanly forkable for Pulse, or does it carry too many Vivid-specific assumptions?
4. Are there additional overlay bugs I missed (transitions, reveal stacking, scroll behavior) that weren't exercised in this test?

---

## Code review findings (2026-04-16, verified by independent agent)

Between this analysis being written and review, commits `a97dce3`, `0ef6dc2`, `ca4a44c`, `64db45c`, `d9b62f1`, `aac1afb`, `2ef288a`, `3f03189`, `6cbf4ec` landed on the branch implementing the proposed refactor. The review evaluated both the analysis and the shipped implementation.

### Analysis errors the review caught

**CR-1: Hallucinated a field that doesn't exist.** My B5 fix sketch referenced `prompt.submissions?.[playerId]` — no such field exists in any prompt machine. Grep confirms. Future proposals must grep for fields before citing them.

**CR-2: B5 fix shipped with regressions for 4+ prompt/dilemma surfaces.** I didn't check `apps/game-server/src/projections.ts` before proposing which fields to read. Sensitive fields are stripped from SYNC per phase:
- **DILEMMA:** `decisions` STRIPPED during COLLECTING (visible only at REVEAL). During COLLECTING the pre-REVEAL signal is `submitted: Record<playerId, bool>`.
- **CONFESSION:** `confessions` STRIPPED during COLLECTING/VOTING. `votes[playerId]` is the VOTING-phase signal; no COLLECTING-phase signal is currently projected.
- **GUESS_WHO:** `answers` STRIPPED during ANSWERING; `guesses` STRIPPED during GUESSING.
- **WOULD_YOU_RATHER:** field is `choices`, not `stances`/`responses`.

Four prompt/dilemma phases now have a live regression where the pill stays `needs-action` even after the player acts. Correct fix: add a uniform `participated: Record<playerId, boolean>` to every prompt/dilemma projection, emitted across all phases, and check that from the client.

**CR-3: B2's fix introduced a new bug in CartridgeOverlay (not caught).** `CartridgeOverlay.tsx:36-39` matches pills by **kind only**, not by `cartridgeId`. Per spec §351 this violates the Day-1-vs-Day-2 disambiguation contract. With B2's cross-day filter applied, a stale push carrying `cartridgeId: 'voting-1-BUBBLE'` arriving on Day 2 now opens Day 2's active voting instead of Day 1's result card. Fix: match `focused.cartridgeId` against pill `.id` first, fall back to kind only if no id match.

**CR-4: `CartridgeResultCard.tsx:50` fallback chain can mis-attribute.** `entry?.snapshot ?? activeForKind?.results ?? activeForKind` has no cartridgeId sanity check on the fallback path. Fix: verify `activeForKind?.cartridgeId === cartridgeId` before using it.

### Analysis gaps the review caught

- **I2:** `usePillStates.ts` timeline loop only handles ISO-with-T timestamps; manifest schema allows `HH:MM` (calendar presets) which emits zero upcoming pills.
- **I3:** `manifest?.days?.[dayIndex - 1] ?? manifest?.days?.[dayIndex]` silently shows Day 1's pills during pregame (dayIndex === 0). Undocumented behavior.
- **I4:** CartridgeOverlay has no `role="dialog"`, no `aria-modal`, no focus trap, no Escape-key handler. A11y regression.
- **I5:** Test coverage is voting-only; no `playerActed` tests for prompt/dilemma (would have caught CR-2).
- **I6:** First-render `playerId: null` race — voting pills briefly flash `needs-action` before `setPlayerId()` hydrates. Subsequent renders correct.
- **I8:** My claim "B3 resolves automatically when B1 is fixed" is wrong — CR-3 means the overlay path is still broken for cross-day stale intents.

### Minor inaccuracies the review caught

- **M1:** Commit `b037c76` I cited as the cartridgeId introduction doesn't exist in current log. Likely was a pre-rebase hash.
- **M2:** `plans/DECISIONS.md` has DUPLICATE ADR numbers — two ADR-126 (lines 1844, 1929), two ADR-128 (1877, 1951), two ADR-131. The document happens to cite the correct one each time via context but future readers could trip.

### Reviewer verdict

**"With fixes."** Analysis was directionally correct for the bugs it scoped, but shipped regressions (CR-2), the new overlay bug (CR-3), and hallucinated field (CR-1) need addressing before handing off.

### Next agent must

1. Treat `submissions` as a phantom — delete any reference in their proposal.
2. Fix B5 properly: add `participated: Record<string, boolean>` to every prompt/dilemma projection across all phases; update client classifier to read that one field.
3. Fix CartridgeOverlay match (CR-3): prefer cartridgeId, fall back to kind.
4. Add cartridgeId check to CartridgeResultCard fallback (CR-4).
5. Write prompt/dilemma `playerActed` tests BEFORE declaring B5 done.
6. Address a11y (I4) and HH:MM timeline support (I2) either as part of this work or a separate ticket.
7. Audit `PulseResultContent.tsx` (932 lines, added in `0ef6dc2`) — not reviewed in this pass.
