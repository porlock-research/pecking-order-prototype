'use client';

import { useEffect, useRef, useState } from 'react';

interface CarouselDotsProps {
  count: number;
  containerSelector: string;
  itemSelector: string;
  label: string;
}

/**
 * Visual swipe indicator for horizontal-scroll carousels — dots only.
 * Edge arrows are rendered separately by CarouselArrows so they overlay
 * the carousel itself (more discoverable than the dot row below it).
 */
export function CarouselDots({
  count,
  containerSelector,
  itemSelector,
  label,
}: CarouselDotsProps) {
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

  function jumpTo(index: number) {
    const item = itemsRef.current[index];
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

  return (
    <div
      role="tablist"
      aria-label={label}
      className="mt-6 flex items-center justify-center gap-2"
    >
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === active;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Go to slide ${i + 1} of ${count}`}
            onClick={() => jumpTo(i)}
            className={`h-2 rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-pink ${
              isActive
                ? 'w-8 bg-skin-pink'
                : 'w-2 bg-[rgba(245,243,240,0.55)] hover:bg-[rgba(245,243,240,0.85)]'
            }`}
          />
        );
      })}
    </div>
  );
}
