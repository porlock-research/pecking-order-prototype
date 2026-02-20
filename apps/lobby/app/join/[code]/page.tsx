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

// Directional slide variants — hero carousel (full-width swipe)
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

// Directional slide variants — step transitions (slightly less dramatic)
const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '80%' : '-80%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-80%' : '80%',
    opacity: 0,
  }),
};

const LEFT_EDGE_IGNORE = 30;

// Per-step background blur + opacity
const STEP_BG: Record<number, { blur: number; opacity: number }> = {
  1: { blur: 10, opacity: 0.55 },
  2: { blur: 2, opacity: 1 },
  3: { blur: 8, opacity: 0.45 },
};

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

  // Hero carousel direction tracking — derived synchronously during render
  const prevIndexRef = useRef(0);
  const directionRef = useRef(0);

  if (activeIndex !== prevIndexRef.current) {
    directionRef.current = activeIndex > prevIndexRef.current ? 1 : -1;
    prevIndexRef.current = activeIndex;
  }

  // Step direction tracking — same pattern
  const prevStepRef = useRef<number>(1);
  const stepDirectionRef = useRef(0);

  if (step !== prevStepRef.current) {
    stepDirectionRef.current = step > prevStepRef.current ? 1 : -1;
    prevStepRef.current = step;
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
      <div className="h-screen h-dvh bg-skin-deep bg-grid-pattern flex items-center justify-center font-body text-skin-base">
        <div className="text-skin-dim font-mono text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="h-screen h-dvh bg-skin-deep bg-grid-pattern flex flex-col items-center justify-center p-4 font-body text-skin-base">
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

  const activePersona = personas[activeIndex];

  // Background persona: browse-mode on step 1, locked-in persona on steps 2/3
  const bgPersona = step === 1 ? activePersona : selectedPersona;
  const bgConfig = STEP_BG[step] || STEP_BG[1];

  return (
    <div className="h-screen h-dvh flex flex-col bg-skin-deep bg-grid-pattern font-body text-skin-base relative selection:bg-skin-gold/30 overflow-hidden">
      {/* Blurred full-body background — crossfades with persona, blur/opacity varies by step */}
      <AnimatePresence mode="popLayout">
        {bgPersona && (
          <motion.img
            key={bgPersona.id}
            src={bgPersona.fullImageUrl}
            alt=""
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: bgConfig.opacity }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 w-full h-full object-cover object-top scale-110 pointer-events-none transition-[filter] duration-500"
            style={{ filter: `blur(${bgConfig.blur}px)` }}
          />
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-skin-deep/60 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-skin-panel/40 to-transparent opacity-60 pointer-events-none" />

      {/* Content area — fills viewport above the bottom bar */}
      <div className="flex-1 min-h-0 flex flex-col relative z-10 max-w-lg w-full mx-auto px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* Header — fixed, never slides */}
        <header className="text-center space-y-0.5 flex-shrink-0">
          <h1 className="text-3xl md:text-5xl font-display font-black tracking-tighter text-skin-gold text-glow">
            PECKING ORDER
          </h1>
          <p className="text-sm text-skin-dim font-mono">
            Invite Code: <span className="text-skin-gold font-bold tracking-wider">{code}</span>
          </p>
        </header>

        {/* Already Joined */}
        {alreadyJoined && (
          <div className="flex-1 flex items-center justify-center">
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
          </div>
        )}

        {/* Character Select Wizard */}
        {!alreadyJoined && game.status === 'RECRUITING' && (
          <div className="flex-1 min-h-0 flex flex-col pt-2 gap-2">
            {/* Step indicator — fixed, animated fill bars */}
            <div className="flex items-center justify-center flex-shrink-0">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-display font-bold transition-all duration-300
                      ${step >= s ? 'bg-skin-gold text-skin-deep' : 'bg-skin-input text-skin-dim/40'}`}
                  >
                    {step > s ? '\u2713' : s}
                  </div>
                  {s < 3 && (
                    <div className="w-10 h-0.5 bg-skin-input relative overflow-hidden">
                      <motion.div
                        className="absolute inset-0 bg-skin-gold origin-left"
                        animate={{ scaleX: step > s ? 1 : 0 }}
                        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Step content — slides left/right on step change */}
            <div className="flex-1 min-h-0 relative overflow-hidden">
              <AnimatePresence initial={false} custom={stepDirectionRef.current} mode="popLayout">
                {/* Step 1 — Persona Select */}
                {step === 1 && (
                  <motion.div
                    key="step-1"
                    custom={stepDirectionRef.current}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={SPRING_SWIPE}
                    className="h-full flex flex-col gap-3"
                  >
                    <div className="text-center flex-shrink-0">
                      <div className="text-base font-display font-black text-skin-gold text-glow uppercase tracking-widest">
                        Choose Your Persona
                      </div>
                    </div>

                    {isDrawing || personas.length === 0 ? (
                      <div className="flex-1 min-h-0 flex flex-col gap-2">
                        {/* Skeleton hero */}
                        <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden">
                          <div className="absolute inset-0 bg-skin-input/20 animate-pulse" />
                          <div className="absolute inset-0 bg-gradient-to-t from-skin-deep/90 via-transparent to-transparent pointer-events-none" />
                          <div className="absolute bottom-5 left-5 right-5 space-y-2">
                            <div className="h-7 w-44 bg-skin-input/30 rounded animate-pulse" />
                            <div className="h-3 w-28 bg-skin-input/20 rounded animate-pulse" />
                            <div className="h-3 w-56 bg-skin-input/15 rounded animate-pulse mt-1" />
                            <div className="h-3 w-40 bg-skin-input/15 rounded animate-pulse" />
                          </div>
                        </div>
                        {/* Skeleton thumbnails */}
                        <div className="flex-shrink-0 flex justify-center gap-4">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="flex flex-col items-center gap-1">
                              <div className="w-14 h-14 rounded-full bg-skin-input/20 animate-pulse" />
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
                        className="flex-1 min-h-0 flex flex-col gap-2"
                      >
                        {/* Hero Image Area — swipeable, fills remaining space */}
                        <div
                          {...swipeHandlers}
                          className="flex-1 min-h-0 relative rounded-2xl overflow-hidden glow-breathe"
                          style={{ touchAction: 'pan-y' }}
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
                              <div className="absolute inset-0 bg-gradient-to-t from-skin-deep via-skin-deep/50 via-40% to-transparent pointer-events-none" />
                              <div className="absolute bottom-5 left-5 right-5 pointer-events-none space-y-1">
                                <div className="text-2xl font-display font-black text-skin-base text-glow leading-tight">
                                  {activePersona?.name}
                                </div>
                                <div className="text-xs font-display font-bold text-skin-gold uppercase tracking-[0.2em]">
                                  {activePersona?.stereotype}
                                </div>
                                <p className="text-sm text-skin-dim/80 leading-snug pt-1">
                                  {activePersona?.description}
                                </p>
                              </div>
                            </motion.div>
                          </AnimatePresence>

                          {activeIndex > 0 && (
                            <button
                              onClick={() => setActiveIndex((i) => i - 1)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-skin-deep/60 backdrop-blur-sm flex items-center justify-center text-skin-dim/80 hover:text-skin-base transition-colors"
                              aria-label="Previous character"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Thumbnail Strip */}
                        <div className="flex-shrink-0 flex justify-center gap-4">
                          {personas.map((persona, idx) => (
                            <motion.button
                              key={persona.id}
                              onClick={() => setActiveIndex(idx)}
                              className="flex flex-col items-center gap-1"
                              whileTap={{ scale: 0.95 }}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.08, duration: 0.3 }}
                            >
                              <div
                                className={`w-14 h-14 rounded-full overflow-hidden transition-all duration-200 ${
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
                  </motion.div>
                )}

                {/* Step 2 — Bio Authoring */}
                {step === 2 && selectedPersona && (
                  <motion.div
                    key="step-2"
                    custom={stepDirectionRef.current}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={SPRING_SWIPE}
                    className="h-full flex flex-col overflow-y-auto"
                  >
                    <div className="my-auto space-y-4 py-2">
                      <div className="text-center flex-shrink-0">
                        <div className="text-base font-display font-black text-skin-gold text-glow uppercase tracking-widest">
                          Write Your Catfish Bio
                        </div>
                        <p className="text-xs text-skin-dim/60 mt-1">This is what other players will see</p>
                      </div>

                      {/* Persona identity — prominent, no card (blurred bg IS the card) */}
                      <div className="text-center space-y-1">
                        <div className="text-xl font-display font-black text-skin-base text-glow leading-tight">
                          {selectedPersona.name}
                        </div>
                        <div className="text-xs font-display font-bold text-skin-gold uppercase tracking-[0.2em]">
                          {selectedPersona.stereotype}
                        </div>
                      </div>

                      {/* Bio textarea with glass effect */}
                      <div className="space-y-2">
                        <textarea
                          value={customBio}
                          onChange={(e) => setCustomBio(e.target.value.slice(0, 280))}
                          placeholder="Write your catfish bio... Who are you pretending to be?"
                          rows={4}
                          className="w-full px-4 py-3 backdrop-blur-sm rounded-xl text-base font-bold text-skin-gold text-glow placeholder:text-skin-dim placeholder:font-normal focus:outline-none resize-none"
                          style={{ backgroundColor: 'rgba(44, 0, 62, 0.8)', border: '1px solid var(--po-gold)' }}
                        />
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-skin-dim/40">Max 280 characters</span>
                          <span className={customBio.length > 260 ? 'text-skin-pink' : 'text-skin-dim/40'}>
                            {customBio.length}/280
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3 — Confirm & Join */}
                {step === 3 && selectedPersona && (
                  <motion.div
                    key="step-3"
                    custom={stepDirectionRef.current}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={SPRING_SWIPE}
                    className="h-full flex flex-col overflow-y-auto"
                  >
                    <div className="my-auto space-y-3 py-2">
                      <div className="text-center flex-shrink-0">
                        <div className="text-base font-display font-black text-skin-gold text-glow uppercase tracking-widest">
                          Confirm Your Identity
                        </div>
                        <p className="text-xs text-skin-dim/60 mt-1">This is who you'll be in the game</p>
                      </div>

                      <div className="bg-skin-panel/30 border border-skin-gold/30 rounded-2xl overflow-hidden">
                        <div className="aspect-[16/9] bg-skin-input/30 relative overflow-hidden">
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar — pinned to viewport bottom, buttons crossfade between steps */}
      {!alreadyJoined && game.status === 'RECRUITING' && (
        <div className="flex-shrink-0 relative z-20 bg-gradient-to-b from-skin-deep/0 to-skin-deep pt-3 px-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-lg mx-auto">
            {error && (
              <div className="p-3 mb-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm font-mono text-center">
                {error}
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="btns-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
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
                      className="px-5 py-4 border border-skin-base text-skin-dim rounded-xl font-display font-bold text-sm uppercase tracking-widest hover:bg-skin-input/30 transition-all disabled:opacity-40 disabled:cursor-wait"
                    >
                      Redraw
                    </button>
                    <button
                      onClick={() => {
                        setError(null);
                        setStep(2);
                      }}
                      disabled={!selectedPersona}
                      className={`flex-1 py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all
                        ${
                          !selectedPersona
                            ? 'bg-skin-input text-skin-dim/40 cursor-not-allowed'
                            : 'bg-skin-pink text-skin-base shadow-btn hover:brightness-110 active:scale-[0.99]'
                        }`}
                    >
                      {selectedPersona ? 'Lock In' : 'Select a Character'}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="btns-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
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
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="btns-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

function personaHeadshotUrl(id: string): string {
  return `/api/persona-image/${id}/headshot.png`;
}
