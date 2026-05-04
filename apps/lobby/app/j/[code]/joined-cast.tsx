'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { JoinedPlayer } from './cast-helpers';

const TILTS = [-9, -3, 4, 10]; // fanning like a hand of cards

export function JoinedCast({
  players,
  assetsUrl,
  totalSlots,
}: {
  players: JoinedPlayer[];
  assetsUrl: string;
  /** Total seats in the game — used to render "X of Y joined" callout
      below the fan so the host can see how many slots remain. */
  totalSlots?: number;
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
            {/* Wider+darker scrim band so portrait labels read on bright skin
                tones. Was from-black/92 via-black/25 — the via-stop landed
                too high, leaving the label area exposed when the photo was
                bright. Bumped scrim density at the bottom 50%. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 via-30% to-transparent to-65%" />
            <div className="absolute bottom-2 left-2 right-2">
              {/* Was 11px name + 9px stereotype — both below WCAG-comfortable
                  on small phones. Bumped to 12px / 10px and tightened tracking. */}
              <p className="font-display font-black text-white text-xs leading-tight drop-shadow truncate">
                {p.displayLabel}
              </p>
              <p className="text-skin-gold/95 text-[10px] font-bold uppercase tracking-[0.08em] mt-0.5 drop-shadow truncate">
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
    {/* Slot-fill callout: tells the host how many seats remain (the question
        they actually have) instead of just "+N joined." Hidden if totalSlots
        wasn't passed. */}
    {totalSlots && totalSlots > 0 && (
      <p className="text-center text-xs font-display font-bold text-skin-base/70 uppercase tracking-[0.16em]">
        {players.length} of {totalSlots} joined
        {players.length < totalSlots && (
          <span className="text-skin-gold"> · {totalSlots - players.length} {totalSlots - players.length === 1 ? 'seat' : 'seats'} left</span>
        )}
      </p>
    )}
    </div>
  );
}
