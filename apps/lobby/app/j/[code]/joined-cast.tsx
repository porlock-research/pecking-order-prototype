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
    // aria-hidden: the socialLine paragraph below the cast already reads
    // "Maya, Lior, and Zane are in." — repeating persona names via image
    // alts would be noisy for screen readers.
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
            className={`relative w-[84px] h-[120px] sm:w-[110px] sm:h-[156px] rounded-[14px] overflow-hidden shadow-card ring-1 ring-white/5 ${overlapClass}`}
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
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/25 to-transparent" />
            <div className="absolute bottom-2 left-2 right-2">
              <p className="font-display font-black text-white text-[11px] leading-tight drop-shadow truncate">
                {p.displayLabel}
              </p>
              <p className="text-skin-gold/90 text-[9px] font-bold uppercase tracking-[0.1em] mt-0.5 drop-shadow truncate">
                {p.personaStereotype}
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
  );
}
