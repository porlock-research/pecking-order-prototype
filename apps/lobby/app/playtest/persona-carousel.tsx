'use client';

import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';

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
      className={`relative overflow-hidden flex-shrink-0 transition-all duration-300 ${
        featured
          ? 'w-40 h-56 md:w-48 md:h-64 rounded-2xl shadow-[0_0_40px_rgba(251,191,36,0.2)] z-10'
          : 'w-28 h-40 md:w-32 md:h-44 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)]'
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

  const handlers = useSwipeable({
    onSwipedLeft: () => next(),
    onSwipedRight: () => prev(),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  function prev() {
    setActiveIndex((i) => (i === 0 ? personas.length - 1 : i - 1));
  }

  function next() {
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
        <button
          onClick={prev}
          className="-rotate-6 translate-y-4 -mr-4 hover:-translate-y-0 transition-all duration-300 cursor-pointer"
        >
          <PersonaCard persona={leftPersona} assetsUrl={assetsUrl} />
        </button>

        {/* Center (featured) card */}
        <div className="transition-all duration-300">
          <PersonaCard persona={centerPersona} assetsUrl={assetsUrl} featured />
        </div>

        {/* Right card */}
        <button
          onClick={next}
          className="rotate-6 translate-y-4 -ml-4 hover:-translate-y-0 transition-all duration-300 cursor-pointer"
        >
          <PersonaCard persona={rightPersona} assetsUrl={assetsUrl} />
        </button>
      </div>

      {/* Bio */}
      <p
        key={centerPersona.id}
        className="text-skin-dim text-sm text-center max-w-xs mx-auto font-display leading-relaxed"
      >
        &ldquo;{centerPersona.description}&rdquo;
      </p>

      {/* Dots */}
      <div className="flex gap-1.5 mt-4 justify-center">
        {personas.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setActiveIndex(i)}
            aria-label={`View ${p.name}`}
            className={`rounded-full transition-all duration-300 ${
              i === activeIndex
                ? 'w-5 h-1.5 bg-skin-gold'
                : 'w-1.5 h-1.5 bg-skin-dim/30 hover:bg-skin-dim/50'
            }`}
          />
        ))}
      </div>

    </div>
  );
}
