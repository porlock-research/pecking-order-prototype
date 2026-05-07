'use client';

import { useEffect, useRef, useState } from 'react';

interface CarouselArrowsProps {
  count: number;
  containerSelector: string;
  itemSelector: string;
}

/**
 * Edge-mounted prev/next arrows for horizontal-scroll carousels.
 * Sits absolutely over the carousel itself (not below it), so users see the
 * affordance immediately rather than relying on the "Swipe →" hint text.
 *
 * Mirrors the IntersectionObserver tracking that CarouselDots uses so the
 * disabled state of each arrow stays in sync with the actual scroll position.
 */
export function CarouselArrows({
  count,
  containerSelector,
  itemSelector,
}: CarouselArrowsProps) {
  const [active, setActive] = useState(0);
  const itemsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const container = document.querySelector(containerSelector);
    if (!container) return;

    const items = Array.from(
      container.querySelectorAll<HTMLElement>(itemSelector),
    );
    itemsRef.current = items;
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { index: number; ratio: number } = { index: 0, ratio: 0 };
        for (const entry of entries) {
          const idx = items.indexOf(entry.target as HTMLElement);
          if (idx === -1) continue;
          if (entry.intersectionRatio > best.ratio) {
            best = { index: idx, ratio: entry.intersectionRatio };
          }
        }
        if (best.ratio > 0) setActive(best.index);
      },
      {
        root: container,
        threshold: [0.25, 0.5, 0.75, 1],
      },
    );

    for (const item of items) observer.observe(item);
    return () => observer.disconnect();
  }, [containerSelector, itemSelector]);

  function step(delta: number) {
    const next = Math.max(0, Math.min(count - 1, active + delta));
    const item = itemsRef.current[next];
    if (!item) return;
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    item.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }

  const atStart = active === 0;
  const atEnd = active === count - 1;

  // Hidden when at edge; otherwise visible. Stays out of the snap-scroll target
  // by being position:absolute on the parent's relative wrapper.
  const baseBtn =
    'absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[rgba(10,10,10,0.7)] backdrop-blur-sm border border-[rgba(245,243,240,0.18)] text-skin-base shadow-lg transition-[opacity,transform] duration-200 hover:bg-skin-pink hover:border-skin-pink hover:scale-105 active:scale-95 disabled:opacity-0 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-pink';

  return (
    <>
      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => step(-1)}
        disabled={atStart}
        className={`${baseBtn} left-3 sm:left-5`}
      >
        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M9 2L4 7L9 12"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => step(1)}
        disabled={atEnd}
        className={`${baseBtn} right-3 sm:right-5`}
      >
        <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M5 2L10 7L5 12"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </>
  );
}
