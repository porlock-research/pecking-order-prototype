'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { JoinedPlayer } from './cast-helpers';

const TILTS = [-9, -3, 4, 10]; // fanning like a hand of cards

export function JoinedCast({
  players,
  assetsUrl,
}: {
  players: JoinedPlayer[];
  assetsUrl: string;
}) {
  const reduceMotion = useReducedMotion();

  if (players.length === 0) return null;

  const visible = players.slice(0, 4);
  const overflow = Math.max(0, players.length - visible.length);

  return (
    <div className="space-y-3">
    {/* aria-hidden: the socialLine paragraph below the cast already reads
        "Maya, Lior, and Zane are in." — repeating persona names via image
        alts would be noisy for screen readers. */}
    <div
      aria-hidden
      className="relative mx-auto flex items-end justify-center select-none"
    >
      {visible.map((p, i) => {
        const tilt = TILTS[i % TILTS.length];
        const imgSrc = assetsUrl
          ? `${assetsUrl}/personas/${p.personaId}/headshot.png`
          : `/api/persona-image/${p.personaId}/headshot.png`;
        const isLast = i === visible.length - 1 && overflow > 0;
        const overlapClass = i === 0 ? '' : '-ml-6 sm:-ml-5';

        // Respect prefers-reduced-motion: render cards in their final
        // position with no entrance animation.
        const initial = reduceMotion
          ? { opacity: 1, y: 0, rotate: tilt }
          : { opacity: 0, y: 24, rotate: 0 };
        const animate = { opacity: 1, y: 0, rotate: tilt };

        return (
          <motion.div
            key={p.personaId}
            initial={initial}
            animate={animate}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    type: 'spring',
                    stiffness: 280,
                    damping: 22,
                    delay: 0.05 + i * 0.08,
                  }
            }
            className={`relative w-[84px] h-[120px] sm:w-[110px] sm:h-[156px] rounded-[14px] overflow-hidden shadow-card ring-[1.5px] ring-skin-base/85 ${overlapClass}`}
            style={{
              // Neutral dark fill behind the image. If the CDN 404s the
              // onError handler below hides the <img>, leaving this fill
              // visible instead of the browser's broken-image icon.
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.3))',
            }}
          >
            <img
              src={imgSrc}
              alt=""
              width={220}
              height={312}
              loading="eager"
              draggable={false}
              onError={(e) => {
                e.currentTarget.style.opacity = '0';
              }}
              // Per lobby brief Cast-fan pattern: slight desaturation
              // contrast(1.1) saturate(0.85) so faces feel printed, not
              // photographic. Was missing — added in the bolder pass to
              // align with the canonical visual reference (mockup 05).
              style={{ filter: 'contrast(1.1) saturate(0.85)' }}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
            {/* Tighter scrim band: name-strip only sits over the bottom
                ~30%, so the scrim doesn't need to climb past 50%. Was
                via-black/55 to-65% which dimmed the upper face area. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 via-22% to-transparent to-50%" />
            <div className="absolute bottom-2 left-2 right-2">
              {/* Per lobby brief: single-line name strip — name only.
                  Stereotype was retired here (it lives in /join step 1
                  where it has a job to do). Letting the name own the
                  strip makes the cast fan louder by removing competing
                  text. Name bumped 12 → 13px display-black for the
                  bolder pass; on a small phone it now reads as a
                  reality-TV chyron, not a thumbnail caption. */}
              <p className="font-display font-black text-white text-[13px] leading-[1.05] drop-shadow truncate">
                {p.displayLabel}
              </p>
            </div>

            {isLast && (
              <div className="absolute inset-0 bg-skin-deep/70 flex items-center justify-center">
                <span className="font-display font-black text-white text-2xl drop-shadow">
                  +{overflow + 1}
                </span>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
    </div>
  );
}
