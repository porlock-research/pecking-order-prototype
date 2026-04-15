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
- Right: countdown timer for active cartridges with a deadline (mono font, kind color when normal, `--pulse-accent` (red) under 1 minute). Hidden for upcoming (deadline irrelevant) and completed (no clock).

**Cartridge content area:** `flex: 1; overflow: auto`. Routes by lifecycle state — see §3.

**No mini-bar. No chat peek. No swipe gesture.**

**Scrim:** `position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(5px)`. Tapping it (only the top 40px is reachable; the rest is occluded by the sheet) calls `unfocusCartridge()`. Single backdrop-filter, not stacked, per spec §Anti-Patterns.

**Z-index:** Overlay renders at `PULSE_Z.drawer` (60), backdrop at `backdropFor(drawer)` (59). Same tier as DM sheet and Social panel — they don't co-exist with the overlay (opening the overlay closes them and vice versa, enforced in `focusCartridge`).

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
  - Coordination: opening focused cartridge closes DM sheet + Social panel, and vice versa
  - memoSelector wrapping per finite-zustand-selector-fresh-objects.rule

apps/client/src/shells/pulse/components/PulseBar.tsx
  - Pass onTap to Pill; tap captures origin rect then calls focusCartridge

apps/client/src/shells/pulse/components/Pill.tsx
  - Wire onTap (already typed; just needs to actually call it from PulseBar)
  - Add ignition animation on lifecycle transition upcoming → just-started

apps/client/src/shells/pulse/PulseShell.tsx
  - Mount <CartridgeOverlay /> alongside DmSheet, SocialPanel
  - Wrap in AnimatePresence for entry/exit

apps/client/src/shells/pulse/springs.ts
  - Add PULSE_SPRING.exit (softer than snappy) if not present

apps/client/src/hooks/useDeepLinkIntent.ts  (Phase 4 — when it lands)
  - Replace cartridge_active / cartridge_result interim branch with focusCartridge call

docs/superpowers/specs/2026-04-14-pulse-phase4-catchup-design.md
  - Update §2 delivery #4 paragraph noting the interim behavior is now the overlay path
```

### Delete

None.

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

## 11. Open / Deferred for Future Phases

- Mini-bar for inter-cartridge navigation (defer until playtesters reach for it).
- Chat peek at the bottom of the overlay.
- Symmetric scale-back-to-origin exit animation.
- Catch-up "diff" view for cartridges seen-but-not-resulted.
- Hero images and per-player history stats in the upcoming splash.
- Auto-open on cartridge spawn for in-session players.
- Migrating `silverTarget` and `dmTarget` from PulseShell-local state into the store the way `focusedCartridge` lives there. Symmetric, but out of scope for this overlay phase.
