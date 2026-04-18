import { useEffect, useState, type RefObject } from 'react';

/**
 * Tracks whether a horizontally-scrolling element has content that extends
 * past either edge. Used by PulseBar and CastStrip to conditionally render
 * an edge-fade affordance so players know there are more pills / chips
 * scrolled off-screen.
 *
 * Returns `{ left, right }` booleans — `left` means "can scroll further
 * left", `right` means "can scroll further right". Both false means the
 * content fits entirely or is scrolled to the end.
 *
 * Listens to scroll, resize (via ResizeObserver), and children mutations
 * (via MutationObserver) so pills arriving/leaving re-evaluate overflow.
 */
export function useHasOverflow(ref: RefObject<HTMLElement | null>) {
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft < maxScroll - 1;
      setOverflow(prev =>
        prev.left === left && prev.right === right ? prev : { left, right },
      );
    };

    measure();
    el.addEventListener('scroll', measure, { passive: true });
    // ResizeObserver and MutationObserver are guarded for jsdom — the test
    // env doesn't define ResizeObserver. Scroll listener is enough for tests
    // to pass; live browsers get the richer observer coverage.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(measure) : null;
    if (mo) mo.observe(el, { childList: true, subtree: false });

    return () => {
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [ref]);

  return overflow;
}
