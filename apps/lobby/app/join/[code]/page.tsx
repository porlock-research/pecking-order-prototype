'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { AnimatePresence, motion } from 'framer-motion';
import { getInviteInfo, getRandomPersonas, redrawPersonas, acceptInvite } from '../../actions';
import type { GameInfo, Persona } from '../../actions';

type PersonaWithImage = Persona & { imageUrl: string; fullImageUrl: string };

// Spring physics matching client app (SPRING.swipe)
const SPRING_SWIPE = { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 };

// Directional slide variants — same pattern as client SwipeableTabs
const heroVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
  }),
};

// Softer variant for the text below the hero
const textVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
};

const LEFT_EDGE_IGNORE = 30;

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  // Game state
  const [game, setGame] = useState<GameInfo | null>(null);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [personas, setPersonas] = useState<PersonaWithImage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedPersona, setSelectedPersona] = useState<PersonaWithImage | null>(null);
  const [customBio, setCustomBio] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawKey, setDrawKey] = useState(0);

  // Direction tracking — derived synchronously during render (same pattern as SwipeableTabs)
  const prevIndexRef = useRef(0);
  const directionRef = useRef(0);

  if (activeIndex !== prevIndexRef.current) {
    directionRef.current = activeIndex > prevIndexRef.current ? 1 : -1;
    prevIndexRef.current = activeIndex;
  }

  // Keep selectedPersona in sync with activeIndex
  useEffect(() => {
    if (personas.length > 0) {
      setSelectedPersona(personas[activeIndex]);
    }
  }, [activeIndex, personas]);

  useEffect(() => {
    loadInviteInfo();
  }, [code]);

  // Swipe handlers via react-swipeable
  const swipeHandlers = useSwipeable({
    onSwipedLeft: (e) => {
      if (e.initial[0] < LEFT_EDGE_IGNORE) return;
      setActiveIndex((i) => Math.min(personas.length - 1, i + 1));
    },
    onSwipedRight: (e) => {
      if (e.initial[0] < LEFT_EDGE_IGNORE) return;
      setActiveIndex((i) => Math.max(0, i - 1));
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50,
    preventScrollOnSwipe: false,
    touchEventOptions: { passive: true },
  });

  async function loadInviteInfo() {
    setIsLoading(true);
    const result = await getInviteInfo(code);
    setIsLoading(false);

    if (result.success && result.game) {
      setGame(result.game);
      setAlreadyJoined(result.alreadyJoined ?? false);
      if (!result.alreadyJoined && result.game.status === 'RECRUITING') {
        drawPersonas();
      }
    } else {
      setError(result.error || 'Failed to load game');
    }
  }

  async function drawPersonas() {
    setIsDrawing(true);
    const result = await getRandomPersonas(code);
    setIsDrawing(false);

    if (result.success && result.personas) {
      setPersonas(result.personas);
      setDrawKey((k) => k + 1);
      setActiveIndex(0);
      prevIndexRef.current = 0;
      directionRef.current = 0;
      setSelectedPersona(result.personas[0]);
      setStep(1);
    } else {
      setError(result.error || 'Failed to draw characters');
    }
  }

  async function handleJoin() {
    if (!selectedPersona || !customBio.trim()) return;
    setIsJoining(true);
    setError(null);

    const result = await acceptInvite(code, selectedPersona.id, customBio.trim());
    setIsJoining(false);

    if (result.success) {
      router.push(`/game/${code}/waiting`);
    } else {
      if (result.error?.includes('already been picked')) {
        setError('That character was just taken! Drawing new characters...');
        setSelectedPersona(null);
        setCustomBio('');
        setIsDrawing(true);
        const redrawResult = await redrawPersonas(code);
        setIsDrawing(false);
        if (redrawResult.success && redrawResult.personas) {
          setPersonas(redrawResult.personas);
          setDrawKey((k) => k + 1);
          setActiveIndex(0);
          prevIndexRef.current = 0;
          directionRef.current = 0;
          setSelectedPersona(redrawResult.personas[0]);
          setStep(1);
        } else {
          setError(redrawResult.error || 'Failed to draw characters');
        }
      } else {
        setError(result.error || 'Failed to join');
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-skin-deep bg-grid-pattern flex items-center justify-center font-body text-skin-base">
        <div className="text-skin-dim font-mono text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="min-h-screen bg-skin-deep bg-grid-pattern flex flex-col items-center justify-center p-4 font-body text-skin-base">
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-4xl font-display font-black text-skin-gold text-glow">PECKING ORDER</h1>
          <div className="bg-skin-panel/30 border border-skin-base rounded-2xl p-8 space-y-4">
            <div className="text-skin-pink font-display font-bold text-sm uppercase tracking-widest">
              Invalid Invite
            </div>
            <p className="text-skin-dim text-sm">{error}</p>
            <a
              href="/"
              className="block py-3 text-center bg-skin-pink text-skin-base rounded-xl font-display font-bold text-sm uppercase hover:brightness-110 transition-all"
            >
              Back to Lobby
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const filledSlots = game.slots.filter((s) => s.acceptedBy);
  const activePersona = personas[activeIndex];

  return (
    <div className="min-h-screen bg-skin-deep bg-grid-pattern flex flex-col items-center p-4 py-8 font-body text-skin-base relative selection:bg-skin-gold/30 overflow-hidden">
      {/* Blurred full-body background — crossfades with active persona */}
      <AnimatePresence mode="popLayout">
        {activePersona && step === 1 && (
          <motion.img
            key={activePersona.id}
            src={activePersona.fullImageUrl}
            alt=""
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 w-full h-full object-cover object-top blur-[10px] scale-110 pointer-events-none"
          />
        )}
      </AnimatePresence>
      {/* Dark overlay to keep text readable over the blurred bg */}
      <div className="absolute inset-0 bg-skin-deep/60 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-skin-panel/40 to-transparent opacity-60 pointer-events-none" />

      <div className="max-w-lg w-full relative z-10 space-y-6">
        {/* Header */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-skin-gold text-glow">
            PECKING ORDER
          </h1>
          <p className="text-sm text-skin-dim font-mono">
            Invite Code: <span className="text-skin-gold font-bold tracking-wider">{code}</span>
          </p>
        </header>

        {/* Game Info Bar */}
        <div className="bg-skin-panel/30 backdrop-blur-md border border-skin-base rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-mono text-skin-base">
              {game.mode.replace(/_/g, ' ')} &middot; {game.dayCount} days &middot; {game.playerCount} players
            </div>
            <div className="text-xs font-mono text-skin-dim/60">
              {filledSlots.length}/{game.playerCount} joined
            </div>
          </div>
        </div>

        {/* Already Joined */}
        {alreadyJoined && (
          <div className="bg-skin-green/10 border border-skin-green/30 rounded-2xl p-6 text-center space-y-3">
            <div className="text-skin-green font-display font-bold text-sm uppercase tracking-widest">
              You've Already Joined
            </div>
            <a
              href={`/game/${code}/waiting`}
              className="inline-block py-3 px-6 bg-skin-green/20 text-skin-green border border-skin-green/40 rounded-xl font-display font-bold text-sm uppercase hover:bg-skin-green/30 transition-all"
            >
              Go to Waiting Room
            </a>
          </div>
        )}

        {/* Character Select Wizard */}
        {!alreadyJoined && game.status === 'RECRUITING' && (
          <>
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${
                      step === s
                        ? 'bg-skin-gold text-skin-deep'
                        : step > s
                          ? 'bg-skin-gold/30 text-skin-gold'
                          : 'bg-skin-input text-skin-dim/40'
                    }`}
                  >
                    {step > s ? '\u2713' : s}
                  </div>
                  {s < 3 && <div className={`w-8 h-px ${step > s ? 'bg-skin-gold/30' : 'bg-skin-input'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1 — Fighting-Game Character Select */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="text-lg font-display font-black text-skin-gold text-glow uppercase tracking-widest">
                    Choose Your Fighter
                  </div>
                </div>

                {isDrawing || personas.length === 0 ? (
                  <div className="space-y-5">
                    {/* Skeleton hero */}
                    <div
                      className="relative rounded-2xl overflow-hidden"
                      style={{ height: '55vh', minHeight: '360px', maxHeight: '520px' }}
                    >
                      <div className="absolute inset-0 bg-skin-input/20 animate-pulse" />
                      <div className="absolute inset-0 bg-gradient-to-t from-skin-deep/90 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute bottom-5 left-5 right-5 space-y-2">
                        <div className="h-7 w-44 bg-skin-input/30 rounded animate-pulse" />
                        <div className="h-3 w-28 bg-skin-input/20 rounded animate-pulse" />
                      </div>
                    </div>
                    {/* Skeleton description */}
                    <div className="h-[3.75rem] flex items-center justify-center">
                      <div className="h-4 w-52 bg-skin-input/20 animate-pulse rounded" />
                    </div>
                    {/* Skeleton thumbnails */}
                    <div className="flex justify-center gap-5">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="flex flex-col items-center gap-1.5">
                          <div className="w-16 h-16 rounded-full bg-skin-input/20 animate-pulse" />
                          <div className="h-2.5 w-10 bg-skin-input/20 animate-pulse rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <motion.div
                    key={`draw-${drawKey}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-5"
                  >
                    {/* Hero Image Area — swipeable with directional slide */}
                    <div
                      {...swipeHandlers}
                      className="relative rounded-2xl overflow-hidden glow-breathe"
                      style={{ height: '55vh', minHeight: '360px', maxHeight: '520px', touchAction: 'pan-y' }}
                    >
                      <AnimatePresence initial={false} custom={directionRef.current} mode="popLayout">
                        <motion.div
                          key={activeIndex}
                          custom={directionRef.current}
                          variants={heroVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={SPRING_SWIPE}
                          className="absolute inset-0"
                        >
                          {/* Full body image */}
                          <img
                            src={activePersona?.fullImageUrl}
                            alt={activePersona?.name}
                            className="absolute inset-0 w-full h-full object-cover object-top"
                            onError={(e) => {
                              const el = e.target as HTMLImageElement;
                              if (!el.dataset.fallback && activePersona) {
                                el.dataset.fallback = '1';
                                el.src = activePersona.imageUrl;
                              }
                            }}
                          />

                          {/* Bottom gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-skin-deep/90 via-skin-deep/30 to-transparent pointer-events-none" />

                          {/* Name + stereotype overlay */}
                          <div className="absolute bottom-5 left-5 right-5 pointer-events-none">
                            <div className="text-2xl font-display font-black text-skin-base text-glow leading-tight">
                              {activePersona?.name}
                            </div>
                            <div className="text-xs font-display font-bold text-skin-gold uppercase tracking-[0.2em] mt-1">
                              {activePersona?.stereotype}
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>

                      {/* Chevron buttons */}
                      {activeIndex > 0 && (
                        <button
                          onClick={() => setActiveIndex((i) => i - 1)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-skin-deep/60 backdrop-blur-sm flex items-center justify-center text-skin-dim/80 hover:text-skin-base transition-colors"
                          aria-label="Previous character"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M10 4L6 8L10 12"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}
                      {activeIndex < personas.length - 1 && (
                        <button
                          onClick={() => setActiveIndex((i) => i + 1)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-skin-deep/60 backdrop-blur-sm flex items-center justify-center text-skin-dim/80 hover:text-skin-base transition-colors"
                          aria-label="Next character"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                              d="M6 4L10 8L6 12"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Description — fixed height, slides with softer motion */}
                    <div className="relative overflow-hidden h-[3.75rem]">
                      <AnimatePresence initial={false} custom={directionRef.current} mode="popLayout">
                        <motion.p
                          key={activeIndex}
                          custom={directionRef.current}
                          variants={textVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{ ...SPRING_SWIPE, stiffness: 200 }}
                          className="absolute inset-0 text-base font-display font-bold text-skin-dim/80 text-center leading-snug px-4 flex items-center justify-center"
                        >
                          {activePersona?.description}
                        </motion.p>
                      </AnimatePresence>
                    </div>

                    {/* Thumbnail Strip */}
                    <div className="flex justify-center gap-5">
                      {personas.map((persona, idx) => (
                        <motion.button
                          key={persona.id}
                          onClick={() => setActiveIndex(idx)}
                          className="flex flex-col items-center gap-1.5"
                          whileTap={{ scale: 0.95 }}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.08, duration: 0.3 }}
                        >
                          <div
                            className={`w-16 h-16 rounded-full overflow-hidden transition-all duration-200 ${
                              idx === activeIndex
                                ? 'ring-2 ring-skin-gold ring-offset-2 ring-offset-skin-deep scale-110'
                                : 'opacity-50 grayscale hover:opacity-70'
                            }`}
                          >
                            <img
                              src={personaHeadshotUrl(persona.id)}
                              alt={persona.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <span
                            className={`text-[10px] font-display font-bold text-center transition-colors ${
                              idx === activeIndex ? 'text-skin-gold' : 'text-skin-dim/40'
                            }`}
                          >
                            {persona.name.split(' ')[0]}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm font-mono text-center">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={async () => {
                      setIsDrawing(true);
                      setError(null);
                      const result = await redrawPersonas(code);
                      setIsDrawing(false);
                      if (result.success && result.personas) {
                        setPersonas(result.personas);
                        setDrawKey((k) => k + 1);
                        setActiveIndex(0);
                        prevIndexRef.current = 0;
                        directionRef.current = 0;
                        setSelectedPersona(result.personas[0]);
                      } else {
                        setError(result.error || 'Failed to redraw');
                      }
                    }}
                    disabled={isDrawing}
                    className="px-5 py-5 border border-skin-base text-skin-dim rounded-xl font-display font-bold text-sm uppercase tracking-widest hover:bg-skin-input/30 transition-all disabled:opacity-40 disabled:cursor-wait"
                  >
                    Redraw
                  </button>
                  <button
                    onClick={() => {
                      setError(null);
                      setStep(2);
                    }}
                    disabled={!selectedPersona}
                    className={`flex-1 py-5 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all
                      ${
                        !selectedPersona
                          ? 'bg-skin-input text-skin-dim/40 cursor-not-allowed'
                          : 'bg-skin-pink text-skin-base shadow-btn hover:brightness-110 active:scale-[0.99]'
                      }`}
                  >
                    {selectedPersona ? 'Lock In' : 'Select a Character'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 — Bio Authoring */}
            {step === 2 && selectedPersona && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-xs font-display font-bold text-skin-dim uppercase tracking-widest">
                    Write Your Catfish Bio
                  </div>
                  <p className="text-xs text-skin-dim/60 mt-1">This is what other players will see</p>
                </div>

                {/* Selected persona preview */}
                <div className="flex items-center gap-4 bg-skin-panel/30 border border-skin-base rounded-xl p-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-skin-input/30 flex-shrink-0">
                    <img
                      src={personaHeadshotUrl(selectedPersona.id)}
                      alt={selectedPersona.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-skin-base">{selectedPersona.name}</div>
                    <div className="text-xs text-skin-gold font-display uppercase tracking-wider">
                      {selectedPersona.stereotype}
                    </div>
                  </div>
                </div>

                {/* Bio textarea */}
                <div className="space-y-2">
                  <textarea
                    value={customBio}
                    onChange={(e) => setCustomBio(e.target.value.slice(0, 280))}
                    placeholder="Write your catfish bio... Who are you pretending to be?"
                    rows={4}
                    className="w-full px-4 py-3 bg-skin-input/60 border border-skin-base rounded-xl text-sm text-skin-base placeholder:text-skin-dim/40 focus:outline-none focus:ring-1 focus:ring-skin-gold/40 resize-none"
                  />
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-skin-dim/40">Max 280 characters</span>
                    <span className={customBio.length > 260 ? 'text-skin-pink' : 'text-skin-dim/40'}>
                      {customBio.length}/280
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-4 border border-skin-base text-skin-dim rounded-xl font-display font-bold text-sm uppercase tracking-widest hover:bg-skin-input/30 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!customBio.trim()}
                    className={`flex-1 py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all
                      ${
                        !customBio.trim()
                          ? 'bg-skin-input text-skin-dim/40 cursor-not-allowed'
                          : 'bg-skin-gold text-skin-deep shadow-btn hover:brightness-110 active:scale-[0.99]'
                      }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Confirm & Join */}
            {step === 3 && selectedPersona && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-xs font-display font-bold text-skin-dim uppercase tracking-widest">
                    Confirm Your Identity
                  </div>
                  <p className="text-xs text-skin-dim/60 mt-1">This is who you'll be in the game</p>
                </div>

                {/* Identity card */}
                <div className="bg-skin-panel/30 border border-skin-gold/30 rounded-2xl overflow-hidden">
                  <div className="aspect-[4/3] sm:aspect-[16/9] bg-skin-input/30 relative overflow-hidden">
                    <img
                      src={selectedPersona.fullImageUrl}
                      alt={selectedPersona.name}
                      className="w-full h-full object-cover object-top"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        if (!el.dataset.fallback) {
                          el.dataset.fallback = '1';
                          el.src = selectedPersona.imageUrl;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-skin-deep/80 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="text-lg font-display font-black text-skin-base">{selectedPersona.name}</div>
                      <div className="text-xs text-skin-gold font-display uppercase tracking-wider">
                        {selectedPersona.stereotype}
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[10px] font-mono text-skin-dim/50 uppercase tracking-widest mb-2">
                      Your Bio
                    </div>
                    <p className="text-sm text-skin-base leading-relaxed">{customBio}</p>
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm font-mono text-center">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-4 border border-skin-base text-skin-dim rounded-xl font-display font-bold text-sm uppercase tracking-widest hover:bg-skin-input/30 transition-all"
                  >
                    Edit Bio
                  </button>
                  <button
                    onClick={handleJoin}
                    disabled={isJoining}
                    className={`flex-1 py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all flex items-center justify-center gap-3
                      ${
                        isJoining
                          ? 'bg-skin-input text-skin-dim/40 cursor-wait'
                          : 'bg-skin-pink text-skin-base shadow-btn hover:brightness-110 active:scale-[0.99]'
                      }`}
                  >
                    {isJoining ? (
                      <>
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></span>
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></span>
                      </>
                    ) : (
                      <>Join Game</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function personaHeadshotUrl(id: string): string {
  return `/api/persona-image/${id}/headshot.png`;
}
