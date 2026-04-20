/**
 * View Transitions API helpers for Pulse.
 *
 * Chromium-only as of early 2026. Always feature-detect — Safari / Firefox
 * fall through to the plain synchronous commit path (still correct, just
 * without the morph).
 *
 * Respect `prefers-reduced-motion: reduce` — users with the OS preference
 * set get the non-VT path even on supporting browsers, so morphs never
 * force motion on them. A defensive CSS rule in `pulse-theme.css` zeros
 * the browser's default VT animations as belt-and-suspenders.
 *
 * Naming namespace (keep tags unique across the shell):
 *   - `flying-tape`           — ConfessionBooth composer → cassette morph
 *   - `active-pill`           — tapped PulseBar pill → CartridgeOverlay chrome
 *   - `pill-${cartridgeId}`   — stable per-pill tag for list reorders
 *   - `chip-${playerId}`      — stable per-chip tag; doubles as DmHero portrait morph target
 */

export function supportsViewTransitions(): boolean {
  if (typeof document === 'undefined') return false;
  return typeof document.startViewTransition === 'function';
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Wrap a state-commit in a view transition when the browser supports it
 * AND the user hasn't opted into reduced motion. Otherwise runs `callback`
 * synchronously and returns a resolved promise.
 *
 * The callback should call `flushSync` for any React state updates that
 * must commit before the browser snapshots the "new" frame.
 */
export function runViewTransition(callback: () => void): Promise<void> {
  if (!supportsViewTransitions() || prefersReducedMotion()) {
    callback();
    return Promise.resolve();
  }
  const transition = document.startViewTransition!(callback);
  return transition.finished.catch(() => {
    // Skipped transitions (slow devices, interrupted) still commit the DOM
    // change — the rejection is only about the animation, not the state.
  });
}
