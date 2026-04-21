'use client';

import { motion } from 'framer-motion';

export interface JoinedPlayer {
  personaId: string;
  personaName: string;
  personaStereotype: string;
  displayLabel: string; // display_name || contact_handle || persona first-name
}

const TILTS = [-9, -3, 4, 10]; // fanning like a hand of cards

export function JoinedCast({
  players,
  assetsUrl,
}: {
  players: JoinedPlayer[];
  assetsUrl: string;
}) {
  if (players.length === 0) return null;

  const visible = players.slice(0, 4);
  const overflow = Math.max(0, players.length - visible.length);

  return (
    <div className="relative mx-auto flex items-end justify-center select-none">
      {visible.map((p, i) => {
        const tilt = TILTS[i % TILTS.length];
        const imgSrc = assetsUrl
          ? `${assetsUrl}/personas/${p.personaId}/medium.png`
          : `/api/persona-image/${p.personaId}/medium.png`;
        const isLast = i === visible.length - 1 && overflow > 0;

        return (
          <motion.div
            key={p.personaId}
            initial={{ opacity: 0, y: 24, rotate: 0 }}
            animate={{ opacity: 1, y: 0, rotate: tilt }}
            transition={{
              type: 'spring',
              stiffness: 280,
              damping: 22,
              delay: 0.05 + i * 0.08,
            }}
            style={{ marginLeft: i === 0 ? 0 : -22 }}
            className="relative w-[96px] h-[136px] sm:w-[108px] sm:h-[152px] rounded-[14px] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-white/5"
          >
            <img
              src={imgSrc}
              alt={p.personaName}
              width={216}
              height={304}
              loading="eager"
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/25 to-transparent" />
            <div className="absolute bottom-2 left-2 right-2">
              <p className="font-display font-black text-white text-[11px] leading-tight drop-shadow">
                {p.displayLabel}
              </p>
              <p className="text-skin-gold/90 text-[9px] font-bold uppercase tracking-[0.1em] mt-0.5 drop-shadow">
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

export function displayLabelFor(p: {
  displayName: string | null;
  contactHandle: string | null;
  personaName: string;
}): string {
  if (p.displayName && p.displayName.trim()) return p.displayName.trim();
  if (p.contactHandle && p.contactHandle.trim()) return p.contactHandle.trim();
  return p.personaName.split(' ')[0];
}

export function buildSocialLine(labels: string[]): string {
  if (labels.length === 0) return 'Be the first in — don’t wait too long.';
  if (labels.length === 1) return `${labels[0]} is already in.`;
  if (labels.length === 2) return `${labels[0]} & ${labels[1]} are in.`;
  if (labels.length === 3) return `${labels[0]}, ${labels[1]}, and ${labels[2]} are in.`;
  return `${labels[0]}, ${labels[1]}, and ${labels.length - 2} others are in.`;
}
