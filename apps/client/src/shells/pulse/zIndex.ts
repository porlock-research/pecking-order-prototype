/**
 * Canonical z-index scale for the Pulse shell.
 *
 * Use named tiers — do not invent new numeric values at call sites. If a
 * component doesn't fit any tier, add one here first.
 *
 * Stacking order (low → high):
 *   base → flow → elevated → popup → reactionBar → drawer → modal → reveal
 *
 * Rationale:
 *  - `drawer` covers the app chrome so it feels like a route change.
 *  - `modal` sits above drawers because modals are triggered FROM drawers
 *    (e.g., silver transfer from a DM). A modal that rendered below its
 *    source would be dead UI.
 *  - `reveal` is reserved for game-critical moments (elimination, phase
 *    change, winner) that MUST cover everything, including drawers.
 *  - Each tier is separated by ≥10, leaving room for a backdrop just below
 *    its owning layer via `backdropFor()`.
 */
export const PULSE_Z = {
  /** Ambient background (vignette, grid). */
  base: 0,
  /** In-flow app chrome: header, cast strip, pulse bar, input. */
  flow: 10,
  /** Sticky in-flow elements above chat (day dividers, unread marker). */
  elevated: 20,
  /** Inline popups: mention autocomplete, slash-command picker. */
  popup: 40,
  /** Reaction picker bar anchored to a message. */
  reactionBar: 50,
  /** Persistent drawers/sheets: DM sheet, social panel. */
  drawer: 60,
  /** Transient modals triggered from drawers/content: send silver, nudge. */
  modal: 70,
  /** Dramatic reveals: elimination, phase transition, winner. */
  reveal: 80,
} as const;

/** Backdrop sits immediately below its owning layer (same stacking context). */
export const backdropFor = (layer: number): number => layer - 1;
