'use client';

import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Persona {
  id: string;
  name: string;
  stereotype: string;
  description: string;
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
    onSwipedLeft: () =>
      setActiveIndex((i) => Math.min(i + 1, personas.length - 1)),
    onSwipedRight: () => setActiveIndex((i) => Math.max(i - 1, 0)),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  function prev() {
    setActiveIndex((i) => (i === 0 ? personas.length - 1 : i - 1));
  }

  function next() {
    setActiveIndex((i) => (i === personas.length - 1 ? 0 : i + 1));
  }

  const active = personas[activeIndex];
  if (!active) return null;

  const imgSrc = assetsUrl
    ? `${assetsUrl}/personas/${active.id}/medium.png`
    : `/api/persona-image/${active.id}/medium.png`;

  return (
    <div {...handlers} className="relative select-none">
      {/* Main card */}
      <div className="flex flex-col items-center">
        <div className="relative w-48 h-64 md:w-56 md:h-72 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(251,191,36,0.2)] mx-auto">
          <img
            key={active.id}
            src={imgSrc}
            alt={active.name}
            width={224}
            height={288}
            className="absolute inset-0 w-full h-full object-cover object-top"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 via-50% to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="font-display font-bold text-white text-lg leading-tight drop-shadow-lg">
              {active.name}
            </p>
            <p className="text-skin-gold text-xs font-bold uppercase tracking-wider mt-0.5 drop-shadow">
              {active.stereotype}
            </p>
          </div>
        </div>

        {/* Bio */}
        <p className="text-skin-dim text-sm text-center mt-4 max-w-xs font-display leading-relaxed px-2">
          &ldquo;{active.description}&rdquo;
        </p>

        {/* Dots */}
        <div className="flex gap-2 mt-5 justify-center">
          {personas.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setActiveIndex(i)}
              aria-label={`View ${p.name}`}
              className={`rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? 'w-6 h-2 bg-skin-gold'
                  : 'w-2 h-2 bg-skin-dim/30 hover:bg-skin-dim/50'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={prev}
        aria-label="Previous persona"
        className="absolute left-0 top-28 md:top-32 -translate-x-2 md:-translate-x-6 w-10 h-10 rounded-full bg-skin-deep/80 backdrop-blur-sm flex items-center justify-center text-skin-dim hover:text-skin-gold transition-colors"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={next}
        aria-label="Next persona"
        className="absolute right-0 top-28 md:top-32 translate-x-2 md:translate-x-6 w-10 h-10 rounded-full bg-skin-deep/80 backdrop-blur-sm flex items-center justify-center text-skin-dim hover:text-skin-gold transition-colors"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
