# Pulse Shell

## Design Intent

Reality TV show, not a chat app. Characters ARE the game; UI chrome recedes so persona photos are the visual anchor. Every surface should feel aware of game state and respond to social moments.

## CSS

- Inline styles with `--pulse-*` CSS variables. Do NOT use Tailwind classes.
- Cartridge theme contract via `--po-*` variables for shell-agnostic cartridge rendering.
- Character photos provide visual richness — not gradients, not heavy chrome.

## Typography

Outfit font (300–900 weights), loaded in `pulse-theme.css`. Deliberately distinct from Vivid's Quicksand/DM Sans.

## Icons

Phosphor Icons (Fill weight) via `./icons.ts` — a centralized re-export so future icon-library swaps are a one-file change. Fill gives a chunky, playful aesthetic that reads well at small sizes and matches the reality-TV/Gen-Z target. Deliberately distinct from Vivid's Solar Icons.

## Motion

- Springs from `./springs.ts` — `PULSE_SPRING.bouncy | snappy | gentle | page | pop | exit`
- Do NOT use raw cubic-beziers or duration-only tweens at call sites
- Calm by default. Only pending invites pulse ambiently. Everything else is event-driven (brief animation → settles)

## Z-Index

- `./zIndex.ts` exports `PULSE_Z` tiers: `base → flow → elevated → popup → reactionBar → drawer → modal → reveal`
- Never invent numeric z-index values at call sites. Add a new tier to `PULSE_Z` if needed.
- Use `backdropFor(layer)` for scrims below each owning layer.

## Layout

Single primary surface + two overlay surfaces (DM sheet, Social panel). **No Today tab, no Cast tab.** Cast Strip (persona chips under the ticker) is the primary people surface — not a tab.

## Interaction Model (Approach A)

- **Reactions on messages:** tap ☺ trigger → floating emoji bar with Reply button
- **Actions on players:** tap avatar/portrait → popover with Silver / DM / Nudge
- **Proactive game actions:** `/` command or hint chip in input bar
- **Quick reply:** swipe-right on a message (60px threshold)
- Tap any persona anywhere → open the DM for that person (Cast Strip, @mention, message avatar — all consistent)

## No Long-Press on Scrollable Content

Players trigger long-press accidentally while scrolling. Use visible tap targets (e.g., the ☺ button on messages) instead.

## Cartridge Presentation

- Pills are doors at every lifecycle stage (upcoming, active, completed). No dead taps.
- Tap a pill → full-screen cartridge overlay
- Overlay owns all touches inside the sheet — **no swipe-down-to-dismiss anywhere**
- Dismiss via header `‹` button or the 40px scrim strip above the sheet
- Completed cartridges render a Pulse-native `CartridgeResultCard`, not Vivid's inline pattern

## Don't Port Vivid Patterns

Pulse must look visually distinct from Vivid. Reimplement chrome (ticker, reveals, phase splashes) from scratch rather than adapting Vivid components. When a rule or component exists in Vivid, verify it fits the Pulse design principles before reusing.

## State Placement

- `focusedCartridge`, `lastReadTimestamp`, `lastSeenCartridge`, `lastSeenSilverFrom`, `revealsSeen`, `pendingIntent` → store (shell-agnostic attention + unread state)
- `silverTarget`, `dmTarget`, `socialPanelOpen` → currently PulseShell-local state (transitional; may migrate to store in a future phase)
- Coordinates (origin rects for entry animations) → Pulse-local refs, **never** in the store

## Unread Vocabulary

One concept across surfaces: DM badge, pulse pill dot, silver chip pip all mean "new content you haven't acknowledged." Explicit seen triggers (opening the thing clears it). No viewport-inferred reads except the single MAIN-channel chat divider. Reveals fire once per device.

## localStorage Keys

Pulse store state persists with keys namespaced by `(gameId, playerId)`: `po-pulse-lastRead:${gameId}:${playerId}`, `po-pulse-lastSeenCartridge:${gameId}:${playerId}`, etc. Never ship an unnamespaced key — it leaks state across games.

## Key References

- `docs/superpowers/specs/2026-04-10-pulse-shell-design.md` — master Pulse spec
- `docs/superpowers/specs/2026-04-12-pulse-dm-cast-strip-design.md` — Phase 1.5 Cast Strip + unified DM (authoritative shell architecture)
- `docs/superpowers/specs/2026-04-13-pulse-dm-polish-design.md` + `...-pulse-dm-flow-extensions-design.md` — DM polish + 1:1 → group promotion
- `docs/superpowers/specs/2026-04-14-pulse-phase4-catchup-design.md` — catch-up & deep linking
- `docs/superpowers/specs/2026-04-14-pulse-cartridge-overlay-design.md` — cartridge overlay
- `docs/reports/pulse-mockups/` — interactive HTML prototypes (08 is the authoritative interaction reference)
