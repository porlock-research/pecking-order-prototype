# Pulse Reveal Redesign — Design Brief

**Date:** 2026-04-19
**Branch:** `feature/pulse-reveal-redesign`
**Status:** Design brief, awaiting confirmation
**Supersedes:** current `EliminationReveal.tsx`, `WinnerReveal.tsx`, `PhaseTransition.tsx`

---

## 1. Feature Summary

Three full-screen/ambient surfaces in the Pulse shell that mark the dramatic beats of a reality-TV social game: an elimination moment (a player is voted out), a winner moment (game over), and a phase transition (rhythmic wayfinding between phases inside a day). The current implementations are generic dark modals with emoji icons and admin-panel copy; this redesign makes them feel like reality-TV peaks that honour Pulse's *photos-are-the-anchor* thesis and speak in a narrator voice teens recognize.

**Fonts (correction):** the brief originally referenced Outfit based on a stale memory entry. Pulse actually ships **Clash Display (display) + Satoshi (body)**, loaded via FontShare in `pulse-theme.css`. Use `var(--po-font-display)` and `var(--po-font-body)` at all call sites.

## 2. Primary User Action

For all three surfaces, the user is not *doing* — they are *receiving*. The surfaces must land an emotional beat in ≤5 seconds, then yield. The "action" is acknowledgement (tap / key to dismiss) and return to play.

Peak-end rule applies: elimination is the gut-punch peak, winner is the euphoric peak. Phase transition is pacing, not peak.

## 3. Design Direction

**Aesthetic**: reality TV. Big Brother / Survivor / Love Island for teens, over chat. Theatrical but not camp. The narrator is observing, not performing. Dry-theatrical, not Drag Race camp; cheeky, not sincere.

**Visual language** (per Pulse CLAUDE.md):
- Persona photos are the anchor — no floating thumbnails in voids.
- Chrome recedes so photos carry the moment.
- Clash Display (display) + Satoshi (body), Phosphor Fill icons, zero emoji.
- Colour: `--pulse-gold` for winner; elimination uses photo desaturation + ambient dark, no red "danger" flourishes (that was AI-slop).
- Motion vocabulary from `PULSE_SPRING.*`; reduced-motion collapses to cross-fade.

**Anti-goals** (what this MUST NOT be):
- Not a generic centered dark modal with a thumbnail and a label.
- Not emoji-driven.
- Not admin-panel copy ("Eliminated", "Winner!", "A new day begins").
- Not a full-screen blocker between every phase (nine-times-a-day friction).
- Not a port of the Vivid shell's reveals.

## 4. Layout Strategy

### EliminationReveal — full-bleed portrait + context block

```
┌─────────────────────────────┐
│                             │
│                             │
│    [ PERSONA PHOTO fills    │
│      the viewport,          │
│      desaturates on reveal ]│
│                             │
│                             │
│   "Pack your bags, Maya."   │  ← narrator line, Outfit display, ~32px
│                             │
│   Day 3 · 4 left · 5–2      │  ← context strip, Outfit 12px, muted
│                             │
└─────────────────────────────┘
  (tap anywhere to dismiss)
```

- Photo: `position: fixed; inset: 0; object-fit: cover`. Initial `filter: grayscale(0) scale(1.05)`, animates to `grayscale(1) scale(1)` over 600ms with a long hold.
- Dim layer: `background: rgba(10, 10, 14, 0.25)` over the photo to keep text legible (the photo carries mood; the dim is structural).
- Narrator line: centered lower-third, `--po-font-display`, weight 700, ~32px, tight tracking. NOT uppercase-letter-spaced.
- Context strip: one line, muted (`--pulse-text-2`), small. Day · survivors · vote tally.
- No icon. No "ELIMINATED" label. The face IS the label.

### WinnerReveal — solo triumph

```
┌─────────────────────────────┐
│                             │
│                             │
│    [ PERSONA PHOTO fills,   │
│      warm gold tint layer ] │
│                             │
│    [ Crown icon (Phosphor   │
│      Fill) lands on avatar  │
│      at ~200ms offset ]     │
│                             │
│   "Maya takes the crown."   │  ← narrator line
│                             │
│   confetti                  │
└─────────────────────────────┘
```

- Photo full-bleed, NO desaturation.
- Gold tint overlay: `background: linear-gradient(transparent, color-mix(in oklch, var(--pulse-gold) 15%, transparent))`.
- Crown: Phosphor `Crown` (Fill weight), lands over the face at ~30% from top, ~56px, with spring bounce entry. Replaces the current 👑 emoji.
- Narrator line same typographic treatment as elimination.
- Confetti fires once, same lib, particle count unchanged.

### PhaseTransition — ticker takeover

```
┌─────────────────────────────┐
│  HEADER TICKER AREA         │
│  ┌───────────────────────┐  │
│  │ ← narrator beat slides│  │  ← 300ms slide in from right,
│  │   in over ticker      │  │    1.5s hold, 300ms slide out
│  └───────────────────────┘  │
│                             │
│     [ rest of shell         │
│       remains fully         │
│       interactive ]         │
│                             │
└─────────────────────────────┘
```

- No full-screen overlay.
- Ticker yields its current slot to a narrator line for ~2.1s total.
- Phosphor icon leads (SunHorizon for morning, Moon for night, ChatCircle for social, Megaphone for voting, GameController for game, PencilLine for activity, Trophy for finale, ConfettiBall for game_over).
- Background: a thin warm accent wash derived from `--pulse-gold` (or phase-specific accent) at ~8% opacity.
- Non-blocking. User can keep reading / scrolling / typing.
- On catch-up (reconnect with multiple phase events queued), coalesce: show only the latest phase's takeover, not a forced sequence.

## 5. Key States

### EliminationReveal
- **Fires**: when `useRevealQueue` yields a `{ kind: 'elimination', dayIndex }` entry.
- **Entry**: photo fades in (200ms) + scales 1.05→1.0, narrator line at +200ms offset, context strip at +400ms, grayscale animates from 0→1 over 600ms ending around +800ms.
- **Hold**: until dismissed. No auto-timeout (this is a peak moment, not wayfinding).
- **Exit**: opacity 1→0 over 300ms.
- **Edge — missing player**: if `roster[eliminatedId]` is missing, skip reveal silently (log to Sentry breadcrumb). Do not crash. Do not render an empty overlay.
- **Edge — reconnect mid-game with queued elimination**: still fires. Player missed the moment; reveal tells them what happened.
- **Reduced motion**: cross-fade only (no scale, no grayscale animation — jump to grayscale final state).

### WinnerReveal
- **Fires**: `useRevealQueue` yields `{ kind: 'winner' }` and `winner` is present in store.
- **Entry**: photo fades (200ms) + gold tint layer, crown lands at +300ms with spring, narrator at +400ms, confetti at +500ms.
- **Hold**: until dismissed (peak moment).
- **Exit**: opacity 1→0 over 300ms.
- **Edge — missing winner player**: render a generic "Someone takes the crown" line and the crown icon without a photo (defensive; shouldn't happen).
- **Reduced motion**: no spring on crown, no confetti; static gold overlay + cross-fade.

### PhaseTransition
- **Fires**: when `phase` changes and the new value maps to a known phase.
- **Entry**: ticker slot slides in from right (300ms), narrator line present.
- **Hold**: 1.5s.
- **Exit**: slides out left (300ms) back to normal ticker.
- **Edge — catch-up coalescing**: if multiple phase changes within 2s, only the latest renders.
- **Edge — unknown phase**: no takeover; fall back to normal ticker silently.
- **Reduced motion**: instant appear/disappear, no slide. Hold duration unchanged.

## 6. Interaction Model

- **Elimination / Winner**: tap anywhere, Escape, Enter, or Space to dismiss. `role="dialog"`, `aria-modal="true"`. Focus trap on the container while open; focus returns to `document.body` or the element that held it pre-reveal.
- **PhaseTransition**: not interactive. No dismiss. `role="status"`, `aria-live="polite"`.
- **Announcement**: for elimination, `aria-live="assertive"` on the overlay mount so screen readers hear the narrator line + player name. For winner, `aria-live="polite"` (the celebration doesn't need to interrupt).

## 7. Content Requirements

### Narrator voice spec
- **Tense**: present or imperative ("Pack your bags", "Lights up").
- **Length**: ≤40 chars per line; one sentence; one beat.
- **Punctuation**: a period. Not an exclamation. Reality TV narrators don't shout.
- **Name-drop**: use persona name directly. No pronouns.

### Elimination line pool (10 lines, drawn by hash of `playerId + dayIndex`)
1. "Pack your bags, {name}."
2. "{name} — the tribe has spoken."
3. "{name} is out."
4. "The house votes {name} off."
5. "{name} takes the walk."
6. "That's a wrap for {name}."
7. "{name} leaves the game."
8. "The door closes behind {name}."
9. "{name} is sent home."
10. "Game over for {name}."

Context strip format: `Day {n} · {survivorCount} left · voted out {forVotes}–{againstVotes}`.
If vote tally unavailable (e.g. non-vote elimination): `Day {n} · {survivorCount} left`.

### Winner line pool (6 lines)
1. "{name} takes the crown."
2. "{name} wins the game."
3. "{name} is your winner."
4. "The crown belongs to {name}."
5. "{name} outlasted everyone."
6. "{name} — champion."

### Phase line pool (per phase, ~3 lines each for rotation)
- **morning**: "Lights up.", "Day {n} begins.", "Morning."
- **social**: "The house is open.", "Chat's live.", "Free time."
- **voting**: "Votes open.", "Decide.", "Cast your vote."
- **game**: "Game time.", "Play begins.", "Showtime."
- **activity**: "Speak your mind.", "Your turn.", "On the record."
- **elimination**: "Night falls.", "The house holds its breath.", "Results in."
- **finale**: "The finale."
- **game_over**: "Curtains.", "That's a wrap."
- **pregame**: "Doors about to open.", "Cast assembling.", "Places, everyone."

All lines ≤40 chars. Selection: deterministic hash of `(gameId, dayIndex, phase)` → stable per-player within a run, varied across runs.

### Copy NOT to use
- "Eliminated" as a label.
- "Winner!" as a label.
- "Tap to dismiss" (replace with no prompt; the surface is obviously dismissable, and if not, a small Phosphor `X` corner icon at `--pulse-text-3`).

## 8. Recommended References

For the implementing agent:
- `apps/client/src/shells/pulse/CLAUDE.md` — shell conventions (Phosphor Fill, Outfit, springs, z-index tiers).
- `apps/client/src/shells/pulse/pulse-theme.css` — tokens to extend (may need `--pulse-reveal-dim`, `--pulse-phase-accent-*`).
- `apps/client/src/shells/pulse/hooks/useRevealQueue.ts` — existing queue (already good).
- `apps/client/src/shells/pulse/icons.ts` — centralized Phosphor re-export (add Crown, SunHorizon, Moon, ChatCircle, Megaphone, GameController, PencilLine, Trophy, ConfettiBall if not present).
- Memory: `feedback_no_vivid_patterns.md`, `feedback_impeccable_skill_for_cartridges.md`, `reference_pulse_fonts_shipped_vs_aspirational.md`.
- ADR-138, ADR-139 for palette/input conventions.

During implementation, also consult these impeccable skills:
- `/bolder` — amplify from flat modals to full-bleed portraits.
- `/animate` — the elimination bloom-desat sequence and the crown-lands choreography.
- `/polish` — final token sweep + a11y.

## 8b. View Transitions API — overlay → chat card morph

When the elimination (or winner) overlay dismisses, the persona portrait should morph from full-bleed down to the chat narrator card's 72px portrait via the native View Transitions API. The photo is already the shared anchor in both surfaces — tagging both with the same `view-transition-name` lets the browser own the choreography.

**Implementation**:
- Overlay portrait: `style={{ viewTransitionName: \`elim-portrait-${eliminatedId}\` }}` (winner: `winner-portrait-${winnerId}`).
- Chat card portrait: same name. Apply only to the most-recent card per player to avoid duplicate-name collisions during scrollback.
- Dismiss handler: `'startViewTransition' in document ? document.startViewTransition(() => dismiss()) : dismiss()`.
- Feature-detect for browser support; fall back to the existing framer-motion cross-fade.

**Sequencing constraint**: the chat card MUST already be mounted in the DOM when the overlay dismisses, or VT has nothing to morph into. The natural order is safe — SYNC delivers the elimination fact before the overlay mounts (both come from the same event), so the card is rendered beneath the overlay from the start.

**Browser support**: Chrome 111+ (Mar 2023), Safari 18+ (Sep 2024), Firefox still in progress. Pulse PWA on modern mobile = mostly covered. Fallback degrades gracefully to the current cross-fade.

**Out of scope for VT**:
- Cast Strip chip → overlay (replay-via-tap) — no replay UX in this redesign.
- Winner → Cast Strip last-chip — marginal gain over a fade.
- Chat card arrival on its own — framer-motion fade-up is already correct.

## 9. Open Questions

1. **Ticker takeover API**: does the existing Pulse header ticker expose a controlled slot we can hijack, or does PhaseTransition need to introduce one? Needs a quick read of `components/header/` before implementation.
2. **Vote tally data source**: does the client have `forVotes` / `againstVotes` from SYNC at the moment of elimination? If not, the context strip falls back to `Day N · {survivorCount} left`. Needs a SYNC-payload check against `completedCartridges[voting]` snapshot.
3. **`eliminatedOnDay` reliability**: current `EliminationReveal.tsx:30` finds the eliminated player via `p.status === 'ELIMINATED' && eliminatedOnDay === current.dayIndex`. Is this always populated server-side? If not, the queue event itself should carry `eliminatedPlayerId` (cleaner).
4. **Focus management**: when reveal dismisses, where does focus return? Pulse is mostly tap-driven; a reasonable default is `document.body` but should verify it doesn't fight any active composer.
5. **Line pool selection — determinism**: hash `(gameId, dayIndex, phase)` so a given moment always shows the same line per run? Or random per fire (less annoying if missed)? Recommend: deterministic.
6. **Is there a spec for "pregame" / "game_over"** beats elsewhere in the codebase that we should defer to? Check `PulseShell.tsx` render paths.

---

## Confirmation

This brief is ready to hand to `/bolder` for visual amplification, `/animate` for the motion choreography, and `/polish` for the final token/a11y sweep. Reviewing it end-to-end:

- **In scope**: EliminationReveal + WinnerReveal + PhaseTransition redesign in the Pulse shell only.
- **Out of scope**: other shells' reveals, server-side fact payload changes (unless Open Question #3 forces one), the mainStage state machine.
- **Deliverable per session**: one skill pass, narrow and revertable.

Please confirm or flag what needs revision before we move to implementation.
