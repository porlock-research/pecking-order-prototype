'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { AnimatePresence, motion } from 'framer-motion';
import { getInviteInfo, getRandomPersonas, redrawPersonas, acceptInvite } from '../../actions';
import type { GameInfo, Persona } from '../../actions';
import { BrowserSupportGate } from '@/components/BrowserSupportGate';
import { selectQuestionsForPersona, resolveAnswers, type QuestionWithOptions, type QaSubmission } from './questions-pool';
import { QuestionStep } from './QuestionStep';

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

// STEP_BG (per-step blur/opacity for a persona full-bleed bg) was retired
// 2026-05-04. Variant A's signature visual interest is the cast face-tile
// grid in the body, not a grayscale-noir portrait under a scrim — see
// docs/reports/lobby-mockups/05-variant-a-welcome-v4.html. The wizard now
// uses the same paper + soft-red-radial bg as the welcome surface.

// Session-scoped persistence for in-flight wizard state. Survives the
// magic-link re-auth round-trip (case 6 in the harden batch) and the
// browser/OS Back gesture (case 4) — both navigate fully away and would
// otherwise drop the bio + Q&A the player just wrote. Keyed by invite
// code so two simultaneous wizards don't bleed into each other. 6h TTL
// so a wizard left open overnight doesn't haunt a return tomorrow.
const WIZARD_STATE_VERSION = 1;
const WIZARD_STATE_TTL_MS = 6 * 60 * 60 * 1000;

type SavedWizardState = {
  v: number;
  step: 1 | 2 | 3 | 4;
  selectedPersonaId: string | null;
  customBio: string;
  qaAnswersJson: string | null;
  savedAt: number;
};

function loadSavedWizardState(code: string): SavedWizardState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`wizard:${code}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedWizardState;
    if (parsed.v !== WIZARD_STATE_VERSION) return null;
    if (Date.now() - parsed.savedAt > WIZARD_STATE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveWizardState(code: string, state: Omit<SavedWizardState, 'v' | 'savedAt'>) {
  if (typeof window === 'undefined') return;
  try {
    const payload: SavedWizardState = { v: WIZARD_STATE_VERSION, savedAt: Date.now(), ...state };
    window.sessionStorage.setItem(`wizard:${code}`, JSON.stringify(payload));
  } catch {
    // Quota / private-mode — skip silently; wizard still works in-memory.
  }
}

function clearWizardState(code: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(`wizard:${code}`);
  } catch {}
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  // Game state
  const [game, setGame] = useState<GameInfo | null>(null);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Terminal "the host kicked off without you" state — separates the
  // host-started-mid-wizard case (#7) from a generic toast. Once true,
  // the wizard hides and a branded dead-end view takes over: no more
  // retries, no more lost-bio recovery, just a "back to home" CTA.
  const [gameStarted, setGameStarted] = useState(false);
  // Initial-load failure that should expose a Try-again CTA at page level
  // instead of "Back to Lobby" alone (case 6 — session expired, transient
  // network, etc.). Distinct from per-action `error` which surfaces inline.
  const [loadError, setLoadError] = useState<string | null>(null);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [personas, setPersonas] = useState<PersonaWithImage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedPersona, setSelectedPersona] = useState<PersonaWithImage | null>(null);
  const [customBio, setCustomBio] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawKey, setDrawKey] = useState(0);
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
  const [qaAnswersJson, setQaAnswersJson] = useState<string | null>(null);
  // Inline empty-deck state for step 1. The skeleton flow assumes the
  // draw is loading; this fires when the draw finished but came back
  // empty / errored, so step 1 can show a real "Try again" CTA instead
  // of looping the skeleton forever (case 1).
  const [drawError, setDrawError] = useState<string | null>(null);
  // Tracks whether we already attempted to restore from sessionStorage on
  // this code. Prevents the restore effect from re-firing if personas are
  // re-drawn (which would otherwise force the user back to a stale step).
  const restoredRef = useRef(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Restore in-flight wizard state once personas are drawn. We can only
  // restore the player's selectedPersona by id-match against the freshly
  // drawn set — if their picked persona isn't in the new draw (admin
  // edited the pool, or the draw rotated), we drop the saved state and
  // start fresh on step 1. Runs at most once per mount (restoredRef).
  useEffect(() => {
    if (restoredRef.current) return;
    if (personas.length === 0) return;
    const saved = loadSavedWizardState(code);
    if (!saved || !saved.selectedPersonaId) {
      restoredRef.current = true;
      return;
    }
    const matched = personas.find((p) => p.id === saved.selectedPersonaId);
    if (!matched) {
      clearWizardState(code);
      restoredRef.current = true;
      return;
    }
    const idx = personas.indexOf(matched);
    setActiveIndex(idx);
    prevIndexRef.current = idx;
    setSelectedPersona(matched);
    setCustomBio(saved.customBio);
    setQaAnswersJson(saved.qaAnswersJson);
    if (saved.step >= 2) setStep(saved.step);
    restoredRef.current = true;
  }, [code, personas]);

  // Persist on every meaningful change. sessionStorage writes are sync +
  // cheap; no debounce needed for a 280-char bio. Skip the empty-everything
  // initial state so we don't write a useless entry on every fresh mount.
  useEffect(() => {
    if (!selectedPersona && step === 1 && !customBio && !qaAnswersJson) return;
    saveWizardState(code, {
      step,
      selectedPersonaId: selectedPersona?.id ?? null,
      customBio,
      qaAnswersJson,
    });
  }, [code, step, selectedPersona?.id, customBio, qaAnswersJson]);

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
    setLoadError(null);
    let result: Awaited<ReturnType<typeof getInviteInfo>>;
    try {
      result = await getInviteInfo(code);
    } catch (err: any) {
      setIsLoading(false);
      setLoadError("Couldn't reach the server. Check your connection and try again.");
      return;
    }
    setIsLoading(false);

    if (result.success && result.game) {
      setGame(result.game);
      setAlreadyJoined(result.alreadyJoined ?? false);
      if (result.alreadyJoined) {
        // No reason to keep stale wizard scratch around once they're in.
        clearWizardState(code);
      }
      if (!result.alreadyJoined && result.game.status === 'RECRUITING') {
        drawPersonas();
      }
    } else {
      setLoadError(result.error || 'Failed to load game');
    }
  }

  async function drawPersonas() {
    setIsDrawing(true);
    setDrawError(null);
    let result: Awaited<ReturnType<typeof getRandomPersonas>>;
    try {
      result = await getRandomPersonas(code);
    } catch (err: any) {
      setIsDrawing(false);
      setDrawError("Couldn't draw the cast — check your connection.");
      return;
    }
    setIsDrawing(false);

    if (result.success && result.personas && result.personas.length > 0) {
      setPersonas(result.personas);
      setDrawKey((k) => k + 1);
      setActiveIndex(0);
      prevIndexRef.current = 0;
      directionRef.current = 0;
      setSelectedPersona(result.personas[0]);
      setStep(1);
    } else if (result.success) {
      // Server reported success but no personas came back. Surface as a
      // retryable empty deck rather than perpetual skeleton.
      setDrawError('No catfish available right now. Try drawing again.');
    } else {
      setDrawError(result.error || 'Failed to draw characters');
    }
  }

  async function handleJoin() {
    if (!selectedPersona || !customBio.trim()) return;
    setIsJoining(true);
    setError(null);

    let result: Awaited<ReturnType<typeof acceptInvite>>;
    try {
      result = await acceptInvite(code, selectedPersona.id, customBio.trim(), qaAnswersJson ?? undefined);
    } catch (err: any) {
      // Network / server-action exception (case 3). Without this catch,
      // the awaited promise rejects unhandled and `setIsJoining(false)`
      // never runs — UI stuck on the joining spinner forever.
      setIsJoining(false);
      setError("Couldn't reach the server. Check your connection and try again.");
      return;
    }
    setIsJoining(false);

    if (result.success) {
      clearWizardState(code);
      router.push(`/game/${code}/waiting`);
      return;
    }

    const msg = (result.error ?? '').toLowerCase();

    // Case 7: host kicked off mid-bio. Terminal — no retry, no reuse.
    if (msg.includes('already started') || msg.includes('not accepting players')) {
      clearWizardState(code);
      setGameStarted(true);
      return;
    }

    // Out-of-sync: server says we're already in this game. Recover by
    // routing to the waiting room treatment instead of looping a toast.
    if (msg.includes('already joined')) {
      clearWizardState(code);
      setAlreadyJoined(true);
      setError(null);
      return;
    }

    // Cases 5 + the original collision: persona just got taken or the
    // persona id is no longer valid server-side. Both want the same
    // recovery — kick to step 1, redraw, keep customBio so the player
    // doesn't lose their writing.
    const looksLikeCollision =
      msg.includes('already been picked') ||
      msg.includes('persona') ||
      msg.includes('character') ||
      msg.includes('no available slots');

    if (looksLikeCollision) {
      setError('That character was just taken — drawing fresh.');
      setSelectedPersona(null);
      setStep(1);
      setIsDrawing(true);
      let redrawResult: Awaited<ReturnType<typeof redrawPersonas>>;
      try {
        redrawResult = await redrawPersonas(code);
      } catch {
        setIsDrawing(false);
        setError("Couldn't draw new characters — try again from step 1.");
        return;
      }
      setIsDrawing(false);
      if (redrawResult.success && redrawResult.personas && redrawResult.personas.length > 0) {
        setPersonas(redrawResult.personas);
        setDrawKey((k) => k + 1);
        setActiveIndex(0);
        prevIndexRef.current = 0;
        directionRef.current = 0;
        setSelectedPersona(redrawResult.personas[0]);
        setError(null);
      } else {
        // Case 2: redraw itself failed. Don't strand the player at step 4
        // (which gates render on selectedPersona — they'd see only the
        // bottom action bar with a dead Take-the-seat button). Force them
        // back to step 1 and surface a Try-again via drawError there.
        setDrawError(redrawResult.error || "Couldn't draw new characters. Try again.");
        setError(null);
      }
      return;
    }

    // Generic: keep state, surface message, allow retry.
    setError(result.error || 'Failed to join — try again.');
  }

  if (isLoading) {
    return (
      <div className="h-dvh bg-skin-deep bg-grid-pattern flex items-center justify-center font-body text-skin-base">
        <div className="text-skin-dim text-sm animate-pulse">Pulling your cast…</div>
      </div>
    );
  }

  if (loadError && !game) {
    // Distinguish "couldn't load" from "invalid invite". Either way the
    // user gets a Try-again CTA in addition to the home escape — the
    // former covers transient network / session-expiry recovery (case 6),
    // the latter is the structural fallback. The wordmark stays text-
    // skin-gold/text-glow here because this block is *pre-redesign* and
    // a Bolder pass owns the visual refresh; harden is bug-shaped only.
    const isTransient = /reach the server|connection/i.test(loadError);
    return (
      <div className="h-screen h-dvh bg-skin-deep bg-grid-pattern flex flex-col items-center justify-center p-4 font-body text-skin-base">
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-4xl font-display font-black text-skin-gold text-glow">PECKING ORDER</h1>
          <div className="bg-[rgba(19,19,19,0.3)] border border-skin-base rounded-2xl p-8 space-y-4">
            <div className="text-skin-pink font-display font-bold text-sm uppercase tracking-widest">
              {isTransient ? 'Connection Trouble' : 'Invalid Invite'}
            </div>
            <p className="text-skin-dim text-sm">{loadError}</p>
            {isTransient && (
              <button
                onClick={() => loadInviteInfo()}
                className="block w-full py-3 text-center bg-skin-pink text-skin-base rounded-xl font-display font-bold text-sm uppercase hover:brightness-110 transition-all"
              >
                Try again
              </button>
            )}
            <a
              href="/"
              className={`block py-3 text-center rounded-xl font-display font-bold text-sm uppercase transition-all ${
                isTransient
                  ? 'border border-[rgba(245,243,240,0.4)] text-skin-dim hover:bg-[rgba(29,29,29,0.3)]'
                  : 'bg-skin-pink text-skin-base hover:brightness-110'
              }`}
            >
              Back to Lobby
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (gameStarted) {
    // Case 7 dead-end: the host launched while the player was finishing
    // their bio / Q&A. No retry — the cast is sealed. Mirrors the existing
    // error-block shell so the visual refresh swap can land in one pass
    // later. Copy uses the lobby brief's reality-TV register: catfish as
    // the load-bearing word, "missed the cast call" as the kicker beat.
    return (
      <div className="h-screen h-dvh bg-skin-deep bg-grid-pattern flex flex-col items-center justify-center p-4 font-body text-skin-base">
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-4xl font-display font-black text-skin-pink leading-none tracking-tight">
            PECKING ORDER
          </h1>
          <div className="bg-[rgba(19,19,19,0.3)] border border-skin-base rounded-2xl p-8 space-y-4">
            <div className="text-skin-pink font-display font-bold text-xs uppercase tracking-[0.22em]">
              You missed the cast call
            </div>
            <h2 className="font-display font-black text-skin-base uppercase leading-[0.92] tracking-tight" style={{ fontSize: 'clamp(1.75rem, 7vw, 2.5rem)' }}>
              They locked in without you.
            </h2>
            <p className="text-skin-dim text-sm leading-snug">
              The cast is sealed for this round. There&apos;ll be others.
            </p>
            <a
              href="/"
              className="block py-3 text-center bg-skin-pink text-skin-base rounded-xl font-display font-bold text-sm uppercase tracking-widest hover:brightness-110 transition-all"
            >
              Back to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!game) return null;

  const activePersona = personas[activeIndex];

  return (
    <BrowserSupportGate>
    <div className="h-dvh flex flex-col bg-skin-deep bg-grid-pattern font-body text-skin-base relative selection:bg-[rgba(247,197,46,0.3)] overflow-hidden">
      {/* Variant A wizard background — paper grid (on the wrapper) plus two
          soft red radial highlights. Per
          docs/reports/lobby-mockups/05-variant-a-welcome-v4.html. The
          earlier persona-as-grayscale-bg treatment from mockup 01 was
          retired: the welcome iterations decided against a portrait under
          a 65% ink scrim because (a) scrim opacity required so much
          dimming the photo stopped reading, and (b) face-tile cards in
          the body carry persona identity without competing for the
          headline's contrast. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 25% 30%, rgba(215,38,56,0.06) 0%, transparent 35%),
            radial-gradient(circle at 80% 75%, rgba(215,38,56,0.04) 0%, transparent 40%)
          `,
        }}
      />

      {/* Content area — fills viewport above the bottom bar */}
      <div className="flex-1 min-h-0 flex flex-col relative z-10 max-w-lg w-full mx-auto px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {/* Wizard header — centered red wordmark + invite-code subline.
            Matches docs/reports/lobby-mockups/01-palette-directions.html
            variant A. The masthead pattern (paper wordmark + tear-off
            receipt) is the WELCOME surface signature; the wizard runs
            a tighter, louder opener so the persona-browser body owns
            the visual weight. */}
        <header className="text-center flex-shrink-0 pt-1">
          <h1 className="font-display font-black text-skin-pink leading-none tracking-tight" style={{ fontSize: '28px', letterSpacing: '-0.01em' }}>
            PECKING ORDER
          </h1>
          <p className="text-[11px] text-skin-dim mt-0.5">
            Invite Code:<span className="text-skin-pink font-mono font-bold tracking-[0.1em] ml-1">{code}</span>
          </p>
        </header>

        {/* Already Joined */}
        {alreadyJoined && (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] rounded-2xl p-6 text-center space-y-3">
              <div className="text-skin-green font-display font-bold text-sm uppercase tracking-widest">
                You've Already Joined
              </div>
              <a
                href={`/game/${code}/waiting`}
                className="inline-block py-3 px-6 bg-[rgba(16,185,129,0.2)] text-skin-green border border-[rgba(16,185,129,0.4)] rounded-xl font-display font-bold text-sm uppercase hover:bg-[rgba(16,185,129,0.3)] transition-all"
              >
                Go to Waiting Room
              </a>
            </div>
          </div>
        )}

        {/* Character Select Wizard */}
        {!alreadyJoined && game.status === 'RECRUITING' && (
          <div className="flex-1 min-h-0 flex flex-col pt-2 gap-2">
            {/* Step indicator — pips at 44×44 hit area, 36×36 visible disc. */}
            <nav aria-label="Wizard progress" className="flex items-center justify-center flex-shrink-0 -mx-0.5">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className="w-11 h-11 flex items-center justify-center"
                    aria-current={step === s ? 'step' : undefined}
                  >
                    {/* Inactive pip \u2014 needs MEANINGFUL lift, not subtle.
                        Earlier attempts:
                          - bg-skin-input (#1d1d1d): ~7 points lighter than
                            page, too subtle.
                          - bg-[rgba(10,10,10,0.6)]: transparent wash, no lift.
                          - bg-skin-glass-elevated (rgba(paper,0.14)): paper
                            tone, ~#2c2c2c, but on the bg-grid-pattern page
                            user still reported "dark on dark, not readable."
                        Current: bg-[rgba(245,243,240,0.18)] solid 18% paper lift
                        (~#3b3b3a) with a /40 paper border + full text-skin-
                        base \u2014 readable at distance, no longer relying on
                        background-blend luck against the grid. */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-display font-bold transition-all duration-300
                        ${step >= s ? 'bg-skin-pink text-skin-base' : 'bg-[rgba(245,243,240,0.18)] border border-[rgba(245,243,240,0.4)] text-skin-base'}`}
                    >
                      {step > s ? '\u2713' : s}
                    </div>
                  </div>
                  {s < 4 && (
                    <div className="w-8 h-px bg-[rgba(245,243,240,0.2)] relative overflow-hidden">
                      <motion.div
                        className="absolute inset-0 bg-skin-pink origin-left"
                        animate={{ scaleX: step > s ? 1 : 0 }}
                        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </nav>

            {/* Time signal — sets expectation. CRO research shows even one
                line of "takes about a minute" reduces wizard abandonment.
                Skip on step 4 (already locked in, signal is no longer
                useful). */}
            {step < 4 && (
              <p className="text-center text-[11px] text-[rgba(245,243,240,0.65)] leading-snug -mt-0.5">
                About a minute · {4 - step} {4 - step === 1 ? 'step' : 'steps'} left
              </p>
            )}

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
                    <div className="text-center flex-shrink-0 space-y-1">
                      <h2 className="text-base font-display font-black text-skin-pink uppercase tracking-widest">
                        Choose Your Persona
                      </h2>
                      <p className="text-xs text-[rgba(245,243,240,0.75)] tracking-wide">
                        Swipe to browse. Tap one to lock in.
                      </p>
                    </div>

                    {drawError && !isDrawing ? (
                      // Empty-deck / draw-failure panel. Replaces the
                      // perpetual skeleton when the draw came back empty
                      // or errored (case 1). The user gets a clear "what
                      // happened + how to fix" instead of an infinite
                      // pulsing card.
                      <div className="flex-1 min-h-0 flex items-center justify-center px-2">
                        <div role="alert" className="max-w-sm w-full text-center space-y-4 p-6 rounded-2xl border border-[rgba(245,243,240,0.15)] bg-[rgba(29,29,29,0.4)]">
                          <div className="text-skin-pink font-display font-bold text-xs uppercase tracking-[0.22em]">
                            No cast yet
                          </div>
                          <p className="text-sm text-skin-base leading-snug">{drawError}</p>
                          <button
                            onClick={() => drawPersonas()}
                            className="w-full py-3 bg-skin-pink text-skin-base rounded-xl font-display font-bold text-sm uppercase tracking-widest shadow-btn hover:brightness-110 active:scale-[0.99] transition-all"
                          >
                            Try drawing again
                          </button>
                        </div>
                      </div>
                    ) : isDrawing || personas.length === 0 ? (
                      <div className="flex-1 min-h-0 flex flex-col gap-2">
                        {/* Skeleton hero */}
                        <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden">
                          <div className="absolute inset-0 bg-[rgba(29,29,29,0.2)] animate-pulse" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,10,10,0.9)] via-transparent to-transparent pointer-events-none" />
                          <div className="absolute bottom-5 left-5 right-5 space-y-2">
                            <div className="h-7 w-44 bg-[rgba(29,29,29,0.3)] rounded animate-pulse" />
                            <div className="h-3 w-28 bg-[rgba(29,29,29,0.2)] rounded animate-pulse" />
                            <div className="h-3 w-56 bg-[rgba(29,29,29,0.15)] rounded animate-pulse mt-1" />
                            <div className="h-3 w-40 bg-[rgba(29,29,29,0.15)] rounded animate-pulse" />
                          </div>
                        </div>
                        {/* Skeleton thumbnails */}
                        <div className="flex-shrink-0 flex justify-center gap-4">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="flex flex-col items-center gap-1">
                              <div className="w-14 h-14 rounded-full bg-[rgba(29,29,29,0.2)] animate-pulse" />
                              <div className="h-2.5 w-10 bg-[rgba(29,29,29,0.2)] animate-pulse rounded" />
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
                          className="flex-1 min-h-0 relative rounded-2xl overflow-hidden ring-1 ring-[rgba(245,243,240,0.1)]"
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
                              {/* Wider+denser scrim so name + stereotype + description
                                  read against any persona's skin tone. Was via-[rgba(10,10,10,0.5)]
                                  via-40% — too narrow a band. Now via-[rgba(10,10,10,0.85)] via-25%
                                  pulls the dark wash up to where the description starts. */}
                              <div className="absolute inset-0 bg-gradient-to-t from-skin-deep via-[rgba(10,10,10,0.85)] via-25% to-transparent to-60% pointer-events-none" />
                              <div className="absolute bottom-5 left-5 right-5 pointer-events-none space-y-1">
                                {/* Hero persona name — truncate on overflow.
                                    Dropped text-glow (gold-tinted shadow) since
                                    variant A is no-glow per /quieter pass. */}
                                <div className="text-2xl font-display font-black text-skin-base leading-tight truncate">
                                  {activePersona?.name}
                                </div>
                                <div className="text-xs font-display font-bold text-skin-pink uppercase tracking-[0.2em] truncate">
                                  {activePersona?.stereotype}
                                </div>
                                {/* Description: body font (Manrope), max 3 lines —
                                    long descriptions truncate gracefully via
                                    -webkit-line-clamp instead of pushing the hero
                                    composition off-screen on small phones. */}
                                <p
                                  className="text-sm font-body text-skin-base leading-snug pt-1 overflow-hidden"
                                  style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                  }}
                                >
                                  {activePersona?.description}
                                </p>
                              </div>
                            </motion.div>
                          </AnimatePresence>

                          {activeIndex > 0 && (
                            <button
                              onClick={() => setActiveIndex((i) => i - 1)}
                              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center text-[rgba(245,243,240,0.9)] hover:text-skin-base transition-colors"
                              aria-label="Previous character"
                            >
                              <span className="w-9 h-9 rounded-full bg-[rgba(10,10,10,0.85)] flex items-center justify-center shadow-card">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                                  <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </span>
                            </button>
                          )}
                          {activeIndex < personas.length - 1 && (
                            <button
                              onClick={() => setActiveIndex((i) => i + 1)}
                              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center text-[rgba(245,243,240,0.9)] hover:text-skin-base transition-colors"
                              aria-label="Next character"
                            >
                              <span className="w-9 h-9 rounded-full bg-[rgba(10,10,10,0.85)] flex items-center justify-center shadow-card">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                                  <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </span>
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
                                    ? 'ring-2 ring-skin-pink ring-offset-2 ring-offset-skin-deep scale-110'
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
                                  idx === activeIndex ? 'text-skin-pink' : 'text-skin-faint'
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
                    {/* Was my-auto: vertically-centered the content, leaving
                        a huge gap between the title and the persona card on
                        tall viewports. Drop the my-auto, let the layout
                        flow from the top so title → portrait → bio reads
                        as a tight vertical sequence. */}
                    <div className="space-y-4 pt-3 pb-2">
                      <div className="text-center flex-shrink-0">
                        <h2 className="text-base font-display font-black text-skin-pink uppercase tracking-widest">
                          Write Your Catfish Bio
                        </h2>
                        <p className="text-xs text-[rgba(245,243,240,0.75)] mt-1">First impression. Make it stick.</p>
                      </div>

                      {/* Persona identity — hero portrait card. Was full-
                          stretch with max-h-[320px] which under aspect-[4/5]
                          made the card 256px wide × 320px tall and rendered
                          left-aligned in the wider parent (user-flagged
                          weird position). Now: explicit max-w-xs (320px)
                          centered with mx-auto, no max-h — predictable 320×
                          400 portrait that anchors below the title. */}
                      <div className="relative overflow-hidden rounded-2xl mx-auto max-w-xs">
                        <div aria-hidden className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-skin-pink to-transparent z-10" />
                        <div className="aspect-[4/5] bg-[rgba(29,29,29,0.3)] relative overflow-hidden">
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
                          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,10,10,0.95)] via-[rgba(10,10,10,0.4)] via-30% to-transparent pointer-events-none" />
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <div className="text-2xl font-display font-black text-skin-base leading-[0.95] tracking-tight">
                              {selectedPersona.name}
                            </div>
                            <div className="text-[11px] font-display font-bold text-skin-pink uppercase tracking-[0.18em] mt-1">
                              {selectedPersona.stereotype}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bio textarea — solid input panel for legible contrast.
                          Was bg-[rgba(10,10,10,0.8)] over a blurred photo: when the photo
                          was bright, the overlay read as muddy tan and the gold
                          text became unreadable. Now: solid input bg, white text,
                          gold border as the single active-commit accent (principle 2).
                          Counter promoted to text-[rgba(245,243,240,0.7)] from text-skin-faint. */}
                      <div className="space-y-2">
                        <textarea
                          value={customBio}
                          onChange={(e) => setCustomBio(e.target.value.slice(0, 280))}
                          placeholder="Write your catfish bio... Who are you pretending to be?"
                          rows={4}
                          aria-label="Catfish bio"
                          className="w-full px-4 py-3 bg-skin-input border border-skin-pink rounded-xl text-base text-skin-base placeholder:text-[rgba(245,243,240,0.4)] focus:outline-none focus:ring-1 focus:ring-skin-pink resize-none"
                        />
                        <div className="flex justify-between text-xs">
                          <span className="text-[rgba(245,243,240,0.7)]">Max 280 characters</span>
                          <span className={customBio.length > 260 ? 'text-skin-pink font-mono tabular-nums' : 'text-[rgba(245,243,240,0.7)] font-mono tabular-nums'}>
                            {customBio.length}/280
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3 — Character Q&A */}
                {step === 3 && selectedPersona && (
                  <motion.div
                    key="step-3"
                    custom={stepDirectionRef.current}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={SPRING_SWIPE}
                    className="h-full"
                  >
                    <QuestionStep
                      questions={questions}
                      personaName={selectedPersona.name}
                      onComplete={(subs) => {
                        const resolved = resolveAnswers(questions, subs, {
                          name: selectedPersona!.name,
                          stereotype: selectedPersona!.stereotype,
                          description: selectedPersona!.description,
                        });
                        setQaAnswersJson(JSON.stringify(resolved));
                        setStep(4);
                      }}
                      onSkip={() => {
                        // Randomize defaults per question. Earlier code defaulted
                        // every skipped answer to selectedIndex 0, which made
                        // skippers cluster (every "skip" dossier looked identical
                        // and told other players "this person didn't engage").
                        const defaultSubs = questions.map(q => ({
                          questionId: q.id,
                          selectedIndex: Math.floor(Math.random() * Math.max(1, q.options.length)),
                        }));
                        const resolved = resolveAnswers(questions, defaultSubs, {
                          name: selectedPersona!.name,
                          stereotype: selectedPersona!.stereotype,
                          description: selectedPersona!.description,
                        });
                        setQaAnswersJson(JSON.stringify(resolved));
                        setStep(4);
                      }}
                    />
                  </motion.div>
                )}

                {/* Step 4 — Confirm & Join */}
                {step === 4 && selectedPersona && (
                  <motion.div
                    key="step-4"
                    custom={stepDirectionRef.current}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={SPRING_SWIPE}
                    className="h-full flex flex-col overflow-y-auto"
                  >
                    <div className="my-auto space-y-3 py-2">
                      <div className="text-center flex-shrink-0 space-y-1">
                        {/* Was 10px text-skin-faint w/ 0.3em tracking — looked
                            designed but unscannable. Bumped to 12px, tracking
                            0.16em, text-[rgba(245,243,240,0.6)] for legible eyebrow. */}
                        <p className="text-xs font-display font-bold text-[rgba(245,243,240,0.6)] uppercase tracking-[0.16em]">
                          You’ll be playing as
                        </p>
                        <h2
                          className="font-display font-black text-skin-base uppercase leading-[0.92] tracking-tight px-2 break-words"
                          style={{
                            fontSize: 'clamp(2.5rem, 11vw, 3.75rem)',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            hyphens: 'auto',
                          }}
                        >
                          <span className="sr-only">Confirm Your Identity. </span>
                          {selectedPersona.name}
                        </h2>
                        <p className="text-xs font-display font-bold text-skin-pink uppercase tracking-[0.2em]">
                          {selectedPersona.stereotype}
                        </p>
                      </div>

                      {/* One-card-per-page: was an outer rounded-2xl card with
                            border-[rgba(247,197,46,0.3)] wrapping a photo + bio sub-card +
                            Q&A sub-cards. That violated principle #5 "one opaque
                            card per page" — too many nested borders. The photo
                            now IS the card; bio + Q&A typeset directly on the
                            deep background below. Locked-In stamp + gold accent
                            stripe stay as the commitment-moment treatment. */}
                      <div className="relative overflow-hidden rounded-2xl">
                        <div aria-hidden className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-skin-pink to-transparent z-10" />
                        <div className="aspect-[16/9] bg-[rgba(29,29,29,0.3)] relative overflow-hidden">
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
                          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,10,10,0.8)] to-transparent" />

                          {/* Locked-in stamp — top-right, slightly skewed; reads as
                              tabloid press-stamp. Reinforces commitment moment without
                              relying on a banned side-stripe pattern. */}
                          <div
                            aria-hidden
                            className="absolute top-3 right-3 px-2.5 py-1 bg-skin-pink text-skin-base font-display font-black text-[10px] uppercase tracking-[0.18em] rounded-sm"
                            style={{ transform: 'rotate(3deg)' }}
                          >
                            Locked In
                          </div>
                        </div>
                      </div>
                      {/* Bio + Q&A typeset directly on the deep background below
                          the photo card — no outer wrapper, no nested cards. */}
                      <div className="space-y-4 px-1 pt-2">
                          <div>
                            <div className="text-xs font-display font-bold text-[rgba(245,243,240,0.6)] uppercase tracking-[0.16em] mb-2">
                              Your Bio
                            </div>
                            <p className="text-sm text-skin-base leading-relaxed">{customBio}</p>
                          </div>

                          {/* Q&A Answers Preview — numbered Q1/Q2/Q3 in red,
                              tabloid-magazine interview grammar. Replaces the
                              previous `border-l-2 gold-rule` pattern (banned per
                              impeccable absolute_bans — "no colored side
                              stripes >1px"). */}
                          {qaAnswersJson && (() => {
                            const answers: { question: string; answer: string }[] = JSON.parse(qaAnswersJson);
                            return answers.length > 0 ? (
                              <div>
                                <div className="text-xs font-display font-bold text-[rgba(245,243,240,0.6)] uppercase tracking-[0.16em] mb-2">
                                  Your Answers
                                </div>
                                <div className="space-y-2.5">
                                  {answers.map((qa, i) => (
                                    <div key={i} className="grid grid-cols-[28px_1fr] gap-3">
                                      <div className="font-display font-black text-skin-pink text-[11px] tracking-[0.16em] uppercase leading-none pt-1">
                                        Q{i + 1}
                                      </div>
                                      <div>
                                        <div className="text-[11px] text-skin-dim leading-snug uppercase tracking-[0.06em] font-bold">
                                          {qa.question}
                                        </div>
                                        <div className="text-sm text-skin-base font-medium leading-snug mt-1">
                                          {qa.answer}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null;
                          })()}
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
        <div className="flex-shrink-0 relative z-20 bg-gradient-to-b from-[rgba(10,10,10,0)] to-skin-deep pt-3 px-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-lg mx-auto">
            {error && (
              <div role="alert" className="p-3 mb-3 rounded-lg bg-[rgba(215,38,56,0.1)] border border-[rgba(215,38,56,0.3)] text-skin-pink text-sm text-center">
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
                        setDrawError(null);
                        let result: Awaited<ReturnType<typeof redrawPersonas>>;
                        try {
                          result = await redrawPersonas(code);
                        } catch {
                          setIsDrawing(false);
                          setDrawError("Couldn't reach the server. Try again.");
                          return;
                        }
                        setIsDrawing(false);
                        if (result.success && result.personas && result.personas.length > 0) {
                          setPersonas(result.personas);
                          setDrawKey((k) => k + 1);
                          setActiveIndex(0);
                          prevIndexRef.current = 0;
                          directionRef.current = 0;
                          setSelectedPersona(result.personas[0]);
                        } else {
                          setDrawError(result.error || 'Failed to redraw');
                        }
                      }}
                      disabled={isDrawing}
                      className="px-5 py-4 border border-skin-base text-skin-dim rounded-xl font-display font-bold text-sm uppercase tracking-widest hover:bg-[rgba(29,29,29,0.3)] transition-all disabled:opacity-40 disabled:cursor-wait"
                    >
                      Redraw
                    </button>
                    <button
                      onClick={() => {
                        setError(null);
                        if (!customBio && selectedPersona?.description) {
                          setCustomBio(selectedPersona.description);
                        }
                        setStep(2);
                      }}
                      disabled={!selectedPersona}
                      className={`flex-1 py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all
                        ${
                          !selectedPersona
                            ? 'bg-skin-input text-skin-faint cursor-not-allowed'
                            : 'bg-skin-pink text-skin-base shadow-btn hover:brightness-110 active:scale-[0.99]'
                        }`}
                    >
                      {selectedPersona ? `I'm ${selectedPersona.name.split(' ')[0]}` : 'Select a Character'}
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
                      className="px-6 py-4 border border-skin-base text-skin-dim rounded-xl font-display font-bold text-sm uppercase tracking-widest hover:bg-[rgba(29,29,29,0.3)] transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        if (selectedPersona) {
                          const seed = Date.now();
                          const qs = selectQuestionsForPersona(selectedPersona.id, seed);
                          setQuestions(qs);
                        }
                        setStep(3);
                      }}
                      disabled={!customBio.trim()}
                      className={`flex-1 py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all
                        ${
                          !customBio.trim()
                            ? 'bg-skin-input text-skin-faint cursor-not-allowed'
                            : 'bg-skin-pink text-skin-base shadow-btn hover:brightness-110 active:scale-[0.99]'
                        }`}
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="btns-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(3)}
                      className="px-6 py-4 border border-skin-base text-skin-dim rounded-xl font-display font-bold text-sm uppercase tracking-widest hover:bg-[rgba(29,29,29,0.3)] transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleJoin}
                      disabled={isJoining}
                      className={`flex-1 py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all flex items-center justify-center gap-3
                        ${
                          isJoining
                            ? 'bg-skin-input text-skin-faint cursor-wait'
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
                        <>Take the seat</>
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
    </BrowserSupportGate>
  );
}

function personaHeadshotUrl(id: string): string {
  return `/api/persona-image/${id}/headshot.png`;
}
