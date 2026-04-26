'use client';

import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';

interface Persona {
  id: string;
  name: string;
  stereotype: string;
  description: string;
}

function PersonaCard({
  persona,
  assetsUrl,
  featured = false,
}: {
  persona: Persona;
  assetsUrl: string;
  featured?: boolean;
}) {
  const imgSrc = assetsUrl
    ? `${assetsUrl}/personas/${persona.id}/medium.png`
    : `/api/persona-image/${persona.id}/medium.png`;

  return (
    <div
      className={`relative overflow-hidden flex-shrink-0 ${
        featured
          ? 'w-40 h-56 md:w-48 md:h-64 rounded-2xl shadow-glow z-10'
          : 'w-28 h-40 md:w-32 md:h-44 rounded-2xl shadow-card'
      }`}
    >
      <img
        src={imgSrc}
        alt={persona.name}
        width={featured ? 192 : 128}
        height={featured ? 256 : 176}
        className="absolute inset-0 w-full h-full object-cover object-top"
        loading="eager"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 via-50% to-transparent" />
      <div className="absolute bottom-3 left-3 right-3">
        <p
          className={`font-display font-bold text-white leading-tight drop-shadow-lg ${
            featured ? 'text-base' : 'text-sm'
          }`}
        >
          {persona.name}
        </p>
        {featured && (
          <p className="text-skin-gold text-[11px] font-bold uppercase tracking-wider mt-0.5 drop-shadow">
            {persona.stereotype}
          </p>
        )}
      </div>
    </div>
  );
}

export function PersonaCarousel({
  personas,
  assetsUrl,
}: {
  personas: Persona[];
  assetsUrl: string;
}) {
  const [activeIndex, setActiveIndex] = useState(Math.floor(personas.length / 2));
  const [direction, setDirection] = useState(0);

  const handlers = useSwipeable({
    onSwipedLeft: () => next(),
    onSwipedRight: () => prev(),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  function prev() {
    setDirection(-1);
    setActiveIndex((i) => (i === 0 ? personas.length - 1 : i - 1));
  }

  function next() {
    setDirection(1);
    setActiveIndex((i) => (i === personas.length - 1 ? 0 : i + 1));
  }

  function getIndex(offset: number) {
    return (activeIndex + offset + personas.length) % personas.length;
  }

  const leftPersona = personas[getIndex(-1)];
  const centerPersona = personas[activeIndex];
  const rightPersona = personas[getIndex(1)];

  if (!centerPersona) return null;

  return (
    <div {...handlers} className="relative select-none">
      {/* Hand of cards */}
      <div className="flex justify-center items-end gap-0 mb-6">
        {/* Left card */}
        <motion.button
          key={`left-${leftPersona.id}`}
          onClick={prev}
          initial={{ opacity: 0, x: direction * -60, rotate: 0 }}
          animate={{ opacity: 1, x: 0, rotate: -6, y: 16 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="-mr-4 cursor-pointer"
        >
          <PersonaCard persona={leftPersona} assetsUrl={assetsUrl} />
        </motion.button>

        {/* Center (featured) card */}
        <motion.div
          key={`center-${centerPersona.id}`}
          initial={{ opacity: 0, x: direction * 80, scale: 0.85 }}
          animate={{ opacity: 1, x: 0, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <PersonaCard persona={centerPersona} assetsUrl={assetsUrl} featured />
        </motion.div>

        {/* Right card */}
        <motion.button
          key={`right-${rightPersona.id}`}
          onClick={next}
          initial={{ opacity: 0, x: direction * 60, rotate: 0 }}
          animate={{ opacity: 1, x: 0, rotate: 6, y: 16 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="-ml-4 cursor-pointer"
        >
          <PersonaCard persona={rightPersona} assetsUrl={assetsUrl} />
        </motion.button>
      </div>

      {/* Bio */}
      <AnimatePresence mode="wait">
        <motion.p
          key={centerPersona.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="text-skin-dim text-sm text-center max-w-xs mx-auto font-display leading-relaxed"
        >
          &ldquo;{centerPersona.description}&rdquo;
        </motion.p>
      </AnimatePresence>

      {/* Dots */}
      <div className="flex gap-2 mt-5 justify-center items-center">
        {personas.map((p, i) => (
          <button
            key={p.id}
            onClick={() => {
              setDirection(i > activeIndex ? 1 : -1);
              setActiveIndex(i);
            }}
            aria-label={`View ${p.name}`}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === activeIndex ? 24 : 8,
              height: 8,
              backgroundColor: i === activeIndex ? '#fbbf24' : 'rgba(251, 191, 36, 0.35)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
