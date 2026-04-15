# Pulse Shell — Cartridge Overlay Design

**Date:** 2026-04-14
**Status:** Approved (brainstorm). Ready for implementation plan.
**Branch:** `feature/pulse-phase4-catchup`
**Extends:** `2026-04-10-pulse-shell-design.md` §2 (Pulse Bar) + §9 (Active Cartridge — Expanded Pill)
**Related:** `2026-04-12-pulse-dm-cast-strip-design.md` §11 (deferred overlay grammar) · `2026-04-14-pulse-phase4-catchup-design.md` §2 (deep-link intent contract)
**Mockups:** `docs/reports/pulse-mockups/04-cartridges.png` · `08-full-interaction-prototype.html` · `11-cast-strip-v2.html`

## Problem

Tapping a Pulse pill today does nothing. `PulseBar` doesn't pass `onTap` to `Pill`, and there is no overlay surface to render the cartridge into. Voting, games, activities, and dilemmas are visible in the Pulse Bar but not reachable — the cartridge UI is effectively hidden.

This blocks Phase 4 (catch-up & deep linking). Phase 4 commits to push-driven `cartridge_active` and `cartridge_result` intents that route the player to a specific cartridge. Without an overlay surface, those intents have nowhere to land — Phase 4 §2 had to specify an interim "scroll pill into view + toast" fallback. That fallback is dead UI in a shell that's supposed to feel alive.

## North Star

**Pills are doors.** Every pill — upcoming, active, or completed — opens to a content surface that explains, hosts, or resolves its cartridge. The overlay is the universal cartridge presentation surface for Pulse: the same architecture handles a pre-game tutorial splash, a live playable vote, and a post-game results card.

## Scope

**In scope:**
- A shell-agnostic `focusedCartridge` store slice that expresses player attention.
- A Pulse-specific `CartridgeOverlay` component that renders content keyed to pill lifecycle.
- Per-lifecycle inner views: upcoming-info splash, live-playable panel, completed-result card.
- A `CARTRIDGE_INFO` content map in `packages/shared-types` with v1 authored copy for all 19 cartridges.
- Pill tap wiring (`onTap` propagation, origin-rect capture for entry animation).
- Phase 4 `cartridge_active` / `cartridge_result` intent handlers routing through `focusCartridge(...)`.
- A small "pill ignition" animation on `upcoming → just-started` transitions.

**Explicitly deferred:**
- **Mini-bar for multi-cartridge navigation.** No mini-bar. To switch cartridges, dismiss → tap another pill.
- **Chat peek at the bottom.** Cartridge content goes full bleed; players rely on push notifications and toasts for chat awareness while the overlay is open.
- **Swipe-down to dismiss.** Header `‹` + scrim tap only. Cartridge content (especially canvas games) owns all touches inside the sheet.
- **Symmetric exit animation back to pill origin.** Exit is a simple fade + slight scale-down. Pill positions can change during an overlay session; symmetric exit risks animating into a stale or off-screen target.
- **Catch-up "diff" view** for completed cartridges seen mid-activity but not yet seen post-result. v1 shows the standard result card; the diff treatment can come with Phase 4 polish.
- **Hero images and "your history with this mechanic" stats** in the upcoming splash. Layout reserves a slot for the image; the stat block waits on a fact-counting source.
- **Auto-open on cartridge spawn.** Phase-transition splashes + pill ignition handle in-session announcements; deep-link intents handle the more common push-driven "land directly here" case.

## Design Principles

1. **Ownership: store holds intent, shell renders.** The store says "the player's attention is on cartridge X." Pulse renders an overlay; another shell could scroll-and-highlight or swap a tab. Coordinates and presentation never enter the store.
2. **Pills are doors at every lifecycle stage.** No "this pill isn't ready yet" dead taps. The same overlay handles before/during/after.
3. **Cartridge content owns its sheet.** Once the overlay is open, every touch inside it goes to the cartridge. No competing gestures.
4. **Reveals win, then return.** Dramatic reveals and phase splashes layer above the overlay (z-index 80 vs 60). Dismissing a reveal returns the player to the overlay underneath.
5. **Motion is spring-based and deliberate.** All overlay animation uses `PULSE_SPRING` exports — no ad-hoc cubic-beziers.
6. **Push-driven opens are skipped, not animated.** A push-deep-linked overlay appears with a brief opacity fade and no scale. Manual taps get the expressive scale-from-pill-origin entry.

## 1. Architecture

### Store slice (shell-agnostic)

`apps/client/src/store/useGameStore.ts`:

```typescript
focusedCartridge: {
  cartridgeId: string;
  cartridgeKind: CartridgeKind;       // 'voting' | 'game' | 'prompt' | 'dilemma'
  origin: 'manual' | 'push';
} | null

focusCartridge(cartridgeId: string, cartridgeKind: CartridgeKind, origin: 'manual' | 'push'): void
unfocusCartridge(): void
```

The slice expresses attention, not presentation. Each shell decides how to render it:

- **Pulse:** opens a full-screen overlay (this spec).
- **Vivid:** could highlight + scroll the relevant card (existing CartridgeTakeover logic could route through this).
- **Classic:** could route to the appropriate tab.

`focusedCartridge` is **not** persisted to localStorage. It's session-scoped attention.

### Phase 4 integration

The Phase 4 spec's `cartridge_active` and `cartridge_result` intent handlers collapse into:

```typescript
useGameStore.getState().focusCartridge(intent.cartridgeId, intent.cartridgeKind, 'push');
```

The Phase 4 interim "scroll-pill-into-view + toast" branch is removed. Phase 4 §2 delivery #4 will need an updated paragraph; the push-payload format does not change.

### Pulse rendering

`PulseShell` mounts `<CartridgeOverlay />` once. The component subscribes to `focusedCartridge` and renders only when non-null. Internally it routes content based on the cartridge's current lifecycle (resolved by looking up `cartridgeId` against active slots and `completedCartridges`).

### Origin-rect capture (presentational, NOT in store)

Pulse-local. Two viable shapes:

- A `useRef<DOMRect | null>` lifted to `PulseShell`, written by `Pill` immediately before calling `focusCartridge(...)`.
- A small `usePillOriginStore` (Zustand or `useSyncExternalStore`) co-located with the Pulse shell tree.

The plan can pick either; the constraint is **the rect must not enter `useGameStore`**. Coordinates are pure presentation.

## 2. Overlay Anatomy

```
┌─────────────────────────────────────────┐ ← top of viewport
│ ░ scrim (top 40px, tap to dismiss) ░░░ │
├─────────────────────────────────────────┤ ← top: 40px
│ ‹    Executioner Vote • voting     8:42│   header bar (~44px)
├─────────────────────────────────────────┤
│                                         │
│                                         │
│  Cartridge content (flex: 1)            │
│  - upcoming → CartridgeInfoSplash       │
│  - active   → VotingPanel / GamePanel   │
│  - completed → CartridgeResultCard      │
│                                         │
│                                         │
│                                         │
└─────────────────────────────────────────┘ ← bottom of viewport
```

**Header bar (~44px):**
- Left: `‹` close button (38×38 hit area, glass-blur background, matches DM sheet's back button).
- Center: cartridge label (e.g., "Executioner Vote") with a 6×6 kind-color dot prefix. Label sourced from `CARTRIDGE_INFO[typeKey].displayName`, falling back to `typeKey`.
- Right: countdown timer for active cartridges with a deadline (mono font, kind color when normal, `--pulse-accent` (red) under 1 minute). Hidden for upcoming (deadline irrelevant) and completed (no clock). **Hook contract:** the existing `useCountdown` / `useActivityCountdown` hooks return a label string only — no urgency flag. The plan must extend them to return `{ label: string; urgent: boolean }` (or add a sibling hook). Parsing the label string for "0:" prefix is fragile and out of scope for this overlay; it's a small hook addition.

**Cartridge content area:** `flex: 1; overflow: auto`. Routes by lifecycle state — see §3.

**No mini-bar. No chat peek. No swipe gesture.**

**Scrim:** `position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(5px)`. Tapping it (only the top 40px is reachable; the rest is occluded by the sheet) calls `unfocusCartridge()`. Single backdrop-filter, not stacked, per spec §Anti-Patterns.

**Z-index:** Overlay renders at `PULSE_Z.drawer` (60), backdrop at `backdropFor(drawer)` (59). Same tier as DM sheet and Social panel.

**Coordination with DM sheet and Social panel:** Those two surfaces are PulseShell-local state (`silverTarget`, `dmTarget`, `socialPanelOpen`); the new `focusedCartridge` is store state. v1 does **not** auto-close them on focus and vice versa — the three surfaces stack at the same z-tier, each dismissable through its own path (scrim tap, back button, programmatic). Lifting the locals into the store for unified coordination is deferred (§11). In practice the only stack that occurs is overlay-on-top-of-DM (player taps a pill from inside an open DM), which dismisses cleanly when the overlay closes. If playtesting surfaces a usability problem, add coordination then.

## 3. Lifecycle-State Content Matrix

| Pill lifecycle | Overlay content | Data source |
|---|---|---|
| `upcoming` | `CartridgeInfoSplash` — name, tagline, description, mechanics list, countdown | manifest timeline entry + `CARTRIDGE_INFO[typeKey]` |
| `starting` (ADR-128 SYNC gap) | Same `CartridgeInfoSplash` with "Starting now…" microcopy. Swaps to playable view automatically when active cartridge data lands. | manifest entry → active cartridge slot when populated |
| `just-started`, `needs-action`, `urgent` | Playable cartridge panel via `--po-*` CSS-var contract | active cartridge slot (`activeVotingCartridge` / etc.) |
| `in-progress` (player has acted) | Same playable panel — the panels themselves render the live-status view (vote tally, leaderboard) when the player has acted | active cartridge slot |
| `completed` | `CartridgeResultCard` — Pulse-themed result summary | `completedCartridges` entry matched by `cartridgeId` |
| Truly missing (push intent for stale/unknown id) | Don't open. Toast "Activity unavailable." Clear `focusedCartridge`. | n/a |

The "starting" gap is **content, not a placeholder.** A player who taps a pill at the moment voting opens sees the info splash, then watches it transition into the playable view as the cartridge data arrives. No spinner.

The `CartridgeResultCard` is a new Pulse-specific component. Cartridge panels do have internal result views, but they're tuned for inline-in-Today rendering (Vivid pattern) and don't all support a clean overlay frame. v1 builds a thin Pulse-native card that reads the `CompletedCartridge` snapshot and renders a kind-themed summary (winner, tally, ranking). The exact field set is per-kind (voting → eliminated player + tally; game → top-3 leaderboard; prompt → response highlights; dilemma → reveal). Plan-phase task to enumerate the per-kind result schema.

### Routing constraint

The shell-agnostic cartridge panels (`VotingPanel`, `GamePanel`, `PromptPanel`, `DilemmaPanel`) read **active** cartridge state directly from the store (`useGameStore(s => s.activeVotingCartridge)` etc.) — they do not accept a snapshot via props. They render whatever's currently active.

This means **completed cartridges must never route through the panel layer.** The lifecycle router in `CartridgeOverlay` branches strictly:

- `upcoming` / `starting` → `CartridgeInfoSplash` (manifest-driven, no cartridge data)
- `just-started` / `needs-action` / `urgent` / `in-progress` → `PlayableCartridgeMount` (active-only)
- `completed` → `CartridgeResultCard` (snapshot from `completedCartridges`, never the panel layer)

Edge case to test: player taps a `completed` pill (e.g., Day 1 voting) while an `active` cartridge of the same kind exists (Day 2 voting). The router must produce `CartridgeResultCard` for Day 1, not the active Day 2 panel. `cartridgeId` (per Phase 4 §0.1: `${kind}-${dayIndex}-${typeKey}`) disambiguates.

## 4. CARTRIDGE_INFO Content Map

`packages/shared-types/src/cartridge-info.ts` (new file).

```typescript
export interface CartridgeInfoEntry {
  kind: CartridgeKind;
  displayName: string;          // "Executioner Vote"
  tagline: string;              // "One vote. One execution. No mercy."
  description: string;          // 2-3 sentence paragraph
  mechanics: string[];          // 3-5 bullet steps
}

export const CARTRIDGE_INFO: Record<string, CartridgeInfoEntry> = {
  EXECUTIONER: { kind: 'voting', displayName: 'Executioner Vote', /* ... */ },
  TRIVIA:      { kind: 'game',   displayName: 'Trivia Blitz',     /* ... */ },
  // ... 19 entries total
};
```

**v1 must-have fields:** `kind`, `displayName`, `tagline`, `description`, `mechanics`.

**Authoring scope:** ~19 entries. Suggested ~2-3 hours of writing in one pass, or incrementally as each cartridge gets visited.

**Fallback:** Any `typeKey` missing from `CARTRIDGE_INFO` shows a terse splash — `displayName` from existing `GAME_TYPE_INFO` / vote-mechanism lookup if available, otherwise the raw `typeKey`, plus countdown and a generic "starts soon" line. The overlay still opens.

**Deferred fields (post-v1):**
- `heroImage?: string` — slot reserved in splash layout, conditionally rendered.
- `estimatedDuration?: string` — needs per-cartridge config.
- Per-player history block (`yourHistory`) — needs fact-counting that doesn't exist today.

## 5. Motion

All overlay motion uses `PULSE_SPRING` exports. No raw cubic-beziers, no duration-only tweens.

### Entry — manual (`origin: 'manual'`)

Scale-from-pill-origin. Sequence:

1. `Pill.onClick`: capture `getBoundingClientRect()` immediately, write to the Pulse-local origin ref, then call `focusCartridge(...)`.
2. Overlay mounts. Reads origin ref. If present:
   - `transform-origin: ${rect.left + rect.width/2}px ${rect.top + rect.height/2}px`
   - `initial: { scale: 0.92, opacity: 0 }`, `animate: { scale: 1, opacity: 1 }`
   - `transition: PULSE_SPRING.snappy`
3. Origin ref cleared on mount (one-shot — re-renders don't re-animate).

### Entry — push (`origin: 'push'`)

No scale. Brief opacity fade-in only:
- `initial: { opacity: 0 }`, `animate: { opacity: 1 }`
- `transition: { duration: 0.1 }` (linear, intentional — push opens shouldn't feel theatrical when the player wasn't there to trigger them).

### Exit (asymmetric)

Always a simple fade + slight scale-down regardless of how the overlay was opened:
- `exit: { opacity: 0, scale: 0.96 }`
- `transition: PULSE_SPRING.exit` (a softer spring than `snappy`; if not yet defined in `springs.ts`, the plan adds it).

### Pill ignition (state transition)

When a pill transitions from `upcoming` → `just-started`, a brief one-shot animation:
- Scale pulse: `1 → 1.06 → 1` over ~400ms (`PULSE_SPRING.snappy`)
- Background bloom: dashed muted surface fades to kind-color tint over the same duration
- Breathing dot fades in

This runs whether or not the overlay is open. It's the in-session announcement complement to the phase-transition splash.

### Reveal layering

Reveals (`PULSE_Z.reveal: 80`) and phase-transition splashes layer above the overlay (`drawer: 60`). When a reveal dismisses, the overlay underneath is untouched and visible. Overlay state is preserved across reveals.

## 6. Dismissal

Three paths, all calling `unfocusCartridge()`:

1. **Header `‹` button.** 38×38 glass-blur pill, top-left of overlay.
2. **Scrim tap.** The top 40px above the sheet. Rest of scrim is occluded by the sheet itself.
3. **Programmatic.** `unfocusCartridge()` called by Phase 4 logic, error paths (cartridge missing), or shell teardown.

**No swipe gesture.** Cartridge content — especially canvas-based arcade games — owns every touch inside the sheet. No swipe-down anywhere on the overlay.

## 7. Reveals & Phase Transitions Layered Above

Already covered by `PULSE_Z`. Reveals (elimination, winner, phase splash) sit at z-index 80; the overlay sits at 60. The overlay is preserved underneath. When the reveal dismisses, the overlay is exactly as the player left it.

Edge case: if a reveal's dismissal coincides with the underlying cartridge becoming orphaned (cartridge ref disappeared from store entirely — error path, e.g., disconnect race), the overlay shows the missing-cartridge state and auto-closes after a brief toast. This should be vanishingly rare; the empty-state guard in `CartridgeOverlay` handles it.

## 8. Phase 4 Deep-Link Integration

Phase 4 spec §2 delivery #4 specifies an interim behavior: "scroll the target pill into view, flash a coral highlight for ~1.2s, announce via a toast, and mark the cartridge seen." That branch is replaced. New behavior:

```typescript
// In useDeepLinkIntent's resolver:
if (intent.kind === 'cartridge_active' || intent.kind === 'cartridge_result') {
  useGameStore.getState().focusCartridge(intent.cartridgeId, intent.cartridgeKind, 'push');
  useGameStore.getState().markCartridgeSeen(intent.cartridgeId);
  return;
}
```

`markCartridgeSeen` was already specified in Phase 4 §3. The overlay closing (via any dismissal path) does not re-clear the unread state — it was cleared on open.

The push payload format does not change. Phase 4 §2 Push-event → intent mapping table is unchanged.

## 9. Files to Create / Modify

### Create

```
packages/shared-types/src/cartridge-info.ts
  - CARTRIDGE_INFO map + CartridgeInfoEntry interface
  - v1 entries for all 19 cartridges (or as many as authored; fallback handles gaps)
  - Re-export from packages/shared-types/src/index.ts

apps/client/src/shells/pulse/components/cartridge-overlay/
  CartridgeOverlay.tsx          # the sheet + scrim + header + content router
  CartridgeOverlayHeader.tsx    # close button + label + countdown
  CartridgeInfoSplash.tsx       # upcoming-state info view
  CartridgeResultCard.tsx       # completed-state result summary (per-kind branch)
  PlayableCartridgeMount.tsx    # routes voting/game/prompt/dilemma to the right shell-agnostic panel
  usePillOrigin.ts              # presentational ref/store for entry animation
```

### Modify

```
apps/client/src/store/useGameStore.ts
  - Add focusedCartridge slice + focusCartridge / unfocusCartridge actions
  - memoSelector wrapping per finite-zustand-selector-fresh-objects.rule
  - Note: no auto-close coordination with silverTarget / dmTarget / socialPanelOpen.
    Per §2 "Coordination" — surfaces stack at the same z-tier and dismiss through
    their own paths. Do not add effect-based coordination in this phase.

apps/client/src/shells/pulse/components/PulseBar.tsx
  - Pass onTap to Pill; tap captures origin rect then calls focusCartridge

apps/client/src/shells/pulse/components/Pill.tsx
  - Wire onTap (already typed; just needs to actually call it from PulseBar)
  - Add ignition animation on lifecycle transition upcoming → just-started

apps/client/src/shells/pulse/hooks/usePillStates.ts
  - Detect ADR-128 SYNC gap: a manifest timeline entry has fired (eventTime <= now)
    but the corresponding active cartridge slot is still null
  - Assign 'starting' lifecycle during the gap; auto-swap to 'just-started' when
    the slot populates
  - Without this, the spec's "Starting now…" splash treatment never fires —
    the union currently includes 'starting' but no producer assigns it

apps/client/src/hooks/useCountdown.ts (and useActivityCountdown)
  - Extend return shape: { label: string; urgent: boolean }
  - urgent = true when remaining time < 60s
  - Header countdown reads `urgent` to switch to red coloring

apps/client/src/shells/pulse/PulseShell.tsx
  - Mount <CartridgeOverlay /> alongside DmSheet, SocialPanel
  - Wrap in AnimatePresence for entry/exit

apps/client/src/shells/pulse/springs.ts
  - Add PULSE_SPRING.exit (softer than snappy) if not present

apps/client/src/hooks/useDeepLinkIntent.ts  (Phase 4 — when it lands)
  - Replace cartridge_active / cartridge_result interim branch with focusCartridge call

docs/superpowers/specs/2026-04-14-pulse-phase4-catchup-design.md
  - Update §2 delivery #4 paragraph noting the interim behavior is now the overlay path

CLAUDE.md hierarchy — no changes needed in this phase.
  - The hierarchy was restructured on 2026-04-14. Pulse conventions now live in
    apps/client/src/shells/pulse/CLAUDE.md (already exists and already documents
    cartridge overlay rules: "Pills are doors," no swipe-down, overlay owns all
    touches, completed → CartridgeResultCard).
  - The legacy "results inline" rule has already been scoped to Vivid in
    apps/client/src/shells/vivid/CLAUDE.md. The legacy z-index stack has moved
    to the same file.
  - apps/client/CLAUDE.md no longer carries shell-specific rules; it lists the
    shells and points to per-shell CLAUDE.md files.
  - Implementation should verify the Pulse CLAUDE.md still accurately describes
    the final overlay behavior after this phase ships, and touch it up if any
    conventions drift (e.g., if PULSE_SPRING.exit lands as a new export).
```

### Delete

None.

## 9a. Testing

Matches the rigor of the revised Phase 4 spec and the 2026-04-13 sibling specs. The plan enumerates each as a vitest test and/or a Playwright e2e step.

**Unit (vitest, `apps/client/src/shells/pulse/components/cartridge-overlay/__tests__/`):**

- **Lifecycle routing.** Given a `cartridgeId` and store state with the cartridge in each lifecycle state (upcoming, starting, just-started, in-progress, completed, missing), `CartridgeOverlay` renders the correct inner component (`CartridgeInfoSplash` / `PlayableCartridgeMount` / `CartridgeResultCard` / nothing+toast).
- **Active vs completed disambiguation.** Day-1-completed voting and Day-2-active voting both present in store; tapping the Day-1 pill produces the result card, not the Day-2 active panel. Driven by `cartridgeId` matching, not kind matching.
- **Missing cartridge.** Push intent with stale `cartridgeId` → toast fires, `focusedCartridge` cleared, no overlay rendered.
- **Origin-rect one-shot.** Pill writes rect → overlay reads it → ref cleared. A subsequent re-render of the overlay does not re-animate from the same rect.
- **Pill ignition.** Transition `upcoming` → `just-started` (forced by store update in test) triggers the ignition class/animation on the Pill.
- **`usePillStates` 'starting' detection.** Manifest timeline entry with `eventTime <= now` and corresponding active slot still null → pill lifecycle = `'starting'`. When slot populates, lifecycle = `'just-started'`.
- **Countdown urgency.** `useCountdown` returns `{ urgent: false }` at >60s remaining and `{ urgent: true }` at <60s.

**Integration / Playwright (`e2e/tests/pulse-cartridge-overlay.spec.ts`):**

- **Manual tap, full lifecycle.** Create a test game with an upcoming vote; tap pill → splash visible. Advance to active via `INJECT_TIMELINE_EVENT` → splash swaps to playable view in the same overlay (no reopen). Cast vote → live status. Inject elimination/completion → result card swaps in place.
- **Reveal layering.** Open overlay; trigger an elimination reveal (admin endpoint). Reveal renders above; dismissal returns to overlay (overlay's content state preserved).
- **Phase 4 push intent → focusCartridge.** Simulate a `cartridge_active` intent arriving via SW postMessage; overlay opens with `origin: 'push'` (no scale animation), `markCartridgeSeen` called.
- **Dismissal paths.** Header `‹` button, scrim tap on top 40px — both call `unfocusCartridge`, fade-out animates, overlay unmounts.
- **No-swipe guarantee.** Drag-down from inside overlay content (e.g., on a vote button) does not dismiss. (Not strictly testable as a positive assertion, but covered by absence of any drag handler — a static review item in the plan.)

## 10. Success Criteria

- Tapping any pill — upcoming, active, or completed — opens the overlay with appropriate content within one frame (no dead taps).
- Manual opens animate scale-from-pill-origin with a spring; push opens fade in with no scale.
- No swipe gesture inside the overlay can trigger dismissal. Every touch inside the sheet reaches the cartridge content.
- Reveals (elimination, winner, phase splash) layer above the overlay. Dismissing a reveal returns the player to the overlay state they left.
- A cartridge that completes while the player is viewing it swaps in place to the result view; player can dismiss when ready.
- A push notification with a `cartridge_active` intent opens the overlay directly to the playable cartridge with no intermediate scroll/toast.
- Cast Strip's pulsing-pending-invite remains the only auto-pulsing motion in the shell. Pill ignition is one-shot, not continuous.
- Players reach a v1 cartridge with authored `CARTRIDGE_INFO` content; cartridges without authored content render the terse fallback splash without crashing.
- Phase 4 Tasks 8–19 can resume immediately on top of this work — `cartridge_active` / `cartridge_result` intents have a real surface to route to.

## 11. Plan-Level Items (no spec revision needed)

These are decisions that surface during plan authoring but don't affect the design. Listed so they're not lost:

- **`CompletedCartridgeSnapshot` schema enumeration.** `CompletedCartridge.snapshot` is typed `any`. The per-kind result cards need a typed discriminated union — voting tally, game leaderboard, prompt highlights, dilemma reveal. Plan preamble task: enumerate by inspecting `data.context.completedPhases` in the L3 machine and the four cartridge kinds' final-state outputs.
- **`PULSE_SPRING.exit` numerical values.** Spec says "softer than `snappy`"; plan authors the actual stiffness/damping/mass.
- **Back-to-back push intent semantics.** If intent B arrives while overlay is animating in for intent A, intent B replaces A (overlay snaps to B's content, no animation queue). Document explicitly in `useDeepLinkIntent`.
- **`activeDilemma` vs `activeDilemmaCartridge` naming mismatch.** The store uses `activeDilemma` (per `usePillStates.ts:37`); other slots use the `activeXCartridge` pattern. The `cartridgeId` generator (`${kind}-${dayIndex}-${typeKey}`) must use the client-side kind string `'dilemma'` regardless of slot name. Plan should not "fix" the slot name — out of scope.
- **Header swipe-down (deferred for v1).** Players will instinctively try swipe-down. A swipe limited to the 44px header strip would match DM-sheet vocabulary without colliding with cartridge touches. Plan author's call whether to add as a low-risk extra; v1 spec position is "no swipe" and that's defensible.

## 12. Open / Deferred for Future Phases

- Mini-bar for inter-cartridge navigation (defer until playtesters reach for it).
- Chat peek at the bottom of the overlay.
- Symmetric scale-back-to-origin exit animation.
- Catch-up "diff" view for cartridges seen-but-not-resulted.
- Hero images and per-player history stats in the upcoming splash.
- Auto-open on cartridge spawn for in-session players.
- Migrating `silverTarget` and `dmTarget` from PulseShell-local state into the store the way `focusedCartridge` lives there. Symmetric, but out of scope for this overlay phase.
