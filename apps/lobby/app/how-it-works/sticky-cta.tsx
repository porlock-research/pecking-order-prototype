'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface StickyCtaProps {
  playtestUrl: string;
  // CSS selectors for sentinel elements that, when in viewport,
  // hide the sticky CTA to avoid double-CTA stacking.
  hideWhenInViewSelectors: string[];
}

export function StickyCta({ playtestUrl, hideWhenInViewSelectors }: StickyCtaProps) {
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const inViewRef = useRef<Set<Element>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', onChange);

    const heroSentinel = document.querySelector('[data-sticky-cta-show-after]');
    const hideSentinels = hideWhenInViewSelectors
      .flatMap((sel) => Array.from(document.querySelectorAll(sel)));

    if (!heroSentinel) {
      mq.removeEventListener('change', onChange);
      return;
    }

    let heroPassed = false;

    const recompute = () => {
      setVisible(heroPassed && inViewRef.current.size === 0);
    };

    const heroObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Hero is "passed" once it leaves the top of the viewport
          heroPassed = !entry.isIntersecting;
        }
        recompute();
      },
      { rootMargin: '0px 0px -100% 0px', threshold: 0 },
    );
    heroObserver.observe(heroSentinel);

    const hideObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            inViewRef.current.add(entry.target);
          } else {
            inViewRef.current.delete(entry.target);
          }
        }
        recompute();
      },
      { threshold: 0.1 },
    );
    for (const el of hideSentinels) hideObserver.observe(el);

    return () => {
      heroObserver.disconnect();
      hideObserver.disconnect();
      mq.removeEventListener('change', onChange);
    };
  }, [hideWhenInViewSelectors]);

  // Carry UTM params from the current URL through to /playtest so attribution
  // continues if visitors land on /how-it-works first then convert.
  const [href, setHref] = useState(playtestUrl);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
    const carry = new URLSearchParams();
    for (const k of utm) {
      const v = params.get(k);
      if (v) carry.set(k, v);
    }
    setHref(carry.toString() ? `${playtestUrl}?${carry.toString()}` : playtestUrl);
  }, [playtestUrl]);

  return (
    <div
      aria-hidden={!visible}
      className={[
        'fixed inset-x-0 bottom-0 z-40 sm:hidden',
        'bg-[rgba(10,10,10,0.95)] backdrop-blur-sm border-t border-skin-base',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 px-4',
        'transition-all',
        reduceMotion ? 'duration-0' : 'duration-[240ms] ease-out',
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-full pointer-events-none',
      ].join(' ')}
    >
      <Link
        href={href}
        className="block w-full py-3 text-center font-display font-bold text-sm tracking-widest uppercase rounded-xl bg-skin-pink text-skin-base shadow-btn active:translate-y-0.5 active:brightness-95 transition-[transform,filter] duration-150 ease-out"
      >
        Get cast →
      </Link>
    </div>
  );
}
