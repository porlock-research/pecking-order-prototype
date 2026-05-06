import Link from 'next/link';
import { getDB, getEnv } from '@/lib/db';
import { CarouselDots } from './carousel-dots';
import { CarouselArrows } from './carousel-arrows';
import { QUESTION_POOL } from '@/app/join/[code]/questions-pool';
import { StickyCta } from '../how-it-works/sticky-cta';

interface Persona {
  id: string;
  name: string;
  stereotype: string;
  description: string;
}

async function getPersonas(): Promise<Persona[]> {
  try {
    const db = await getDB();
    const { results } = await db
      .prepare(
        'SELECT id, name, stereotype, description FROM PersonaPool ORDER BY RANDOM()',
      )
      .all<Persona>();
    return results;
  } catch {
    return [];
  }
}

export default async function CastingPage() {
  const [personas, env] = await Promise.all([getPersonas(), getEnv()]);

  const assetsUrl = (env.PERSONA_ASSETS_URL as string) || '';
  // Relative path for in-page CTAs (works across staging/prod without env
  // wiring). Override via PLAYTEST_URL env if cross-host marketing needs it.
  const playtestUrl = (env.PLAYTEST_URL as string) || '/playtest';

  const totalCount = personas.length;

  return (
    <div className="min-h-screen bg-skin-deep font-body text-skin-base selection:bg-[rgba(215,38,56,0.3)]">
      <main>
        <Hero totalCount={totalCount} playtestUrl={playtestUrl} />

        <CartridgePreview />

        {personas.length > 0 && (
          <PersonaSpotlight personas={personas} assetsUrl={assetsUrl} />
        )}

        {personas.length > 0 && (
          <PersonaCollage personas={personas} assetsUrl={assetsUrl} />
        )}

        <FinalCta playtestUrl={playtestUrl} />
      </main>

      <Footer />

      <StickyCta
        playtestUrl={playtestUrl}
        hideWhenInViewSelectors={['#final-cta']}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero — typographic title card. Brand mark dominates; 3-noun        */
/*  tagline carries the pitch. Staggered rise-in on load (CSS).        */
/* ------------------------------------------------------------------ */

function Hero({
  totalCount,
  playtestUrl,
}: {
  totalCount: number;
  playtestUrl: string;
}) {
  return (
    <section
      data-sticky-cta-show-after
      className="text-center px-5 sm:px-8 max-w-[920px] mx-auto pt-12 sm:pt-20 pb-14 sm:pb-20"
    >
      <p
        className="landing-rise font-display font-bold uppercase tracking-[0.32em] text-skin-pink text-[11px] sm:text-[13px]"
        style={{ animationDelay: '0ms' }}
      >
        Casting call
      </p>

      {/* PECKING ORDER — brand mark, dominates the fold */}
      <h1
        className="mt-5 sm:mt-6 font-display font-black uppercase leading-[0.84] tracking-[-0.025em] text-skin-base"
        style={{ fontSize: 'clamp(3.25rem, 14vw, 9rem)' }}
      >
        <span
          className="landing-rise block"
          style={{ animationDelay: '70ms' }}
        >
          Pecking
        </span>
        <span
          className="landing-rise block"
          style={{ animationDelay: '160ms' }}
        >
          Order
        </span>
      </h1>

      {/* Hairline divider — subtle tabloid rule */}
      <div
        className="landing-rise mx-auto mt-7 sm:mt-9 w-16 sm:w-20 h-px bg-skin-pink"
        style={{ animationDelay: '260ms' }}
        aria-hidden
      />

      {/* 3-noun tagline — the pitch. Stacked verb-rack pattern. */}
      <div
        className="mt-6 sm:mt-8 font-display font-black uppercase leading-[0.92] tracking-tight"
        style={{ fontSize: 'clamp(1.75rem, 5.5vw, 3.25rem)' }}
      >
        <p
          className="landing-rise font-display font-bold uppercase tracking-[0.18em] text-skin-dim text-[0.45em] mb-3"
          style={{ animationDelay: '340ms' }}
        >
          A game of
        </p>
        <p
          className="landing-rise text-skin-pink"
          style={{ animationDelay: '420ms' }}
        >
          Catfishing,
        </p>
        <p
          className="landing-rise text-skin-base"
          style={{ animationDelay: '500ms' }}
        >
          Betrayal
        </p>
        <p
          className="landing-rise text-skin-pink"
          style={{ animationDelay: '580ms' }}
        >
          &amp; Survival.
        </p>
      </div>

      {/* Specs row — mono badge */}
      <p
        className="landing-rise mt-8 sm:mt-10 font-mono uppercase tracking-[0.24em] text-skin-dim text-[10px] sm:text-[11px]"
        style={{ animationDelay: '680ms' }}
      >
        Multi-day · async · 5–10 min/day{totalCount > 0 ? ` · ${totalCount}+ characters` : ''}
      </p>

      {/* CTAs */}
      <div
        className="landing-rise mt-7 sm:mt-9 flex flex-col sm:flex-row gap-3 justify-center"
        style={{ animationDelay: '760ms' }}
      >
        <Link
          href={playtestUrl}
          className="inline-block w-full sm:w-auto sm:min-w-[220px] py-4 px-6 text-center font-display font-bold text-sm tracking-widest uppercase rounded-xl bg-skin-pink text-skin-base shadow-btn motion-safe:hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0.5 active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-pink transition-[transform,filter] duration-150 ease-out"
        >
          Sign up to play
        </Link>
        <Link
          href="/how-it-works"
          className="inline-block w-full sm:w-auto sm:min-w-[220px] py-4 px-6 text-center font-display font-bold text-sm tracking-widest uppercase rounded-xl border-2 border-skin-base text-skin-base hover:bg-skin-pink hover:text-skin-base hover:border-skin-pink active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-base transition-[background-color,color,border-color,transform] duration-150 ease-out"
        >
          How it works →
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Persona Spotlight — carousel of full-bleed magazine spreads       */
/* ------------------------------------------------------------------ */

interface SpotlightContent {
  stereotype: string;
  name: string;
  bio: string;
  qa: { q: string; a: string }[];
}

// Curated fallback questions when persona has < 3 specific answers in QUESTION_POOL.
const FALLBACK_Q_IDS = [
  'q-strategy',
  'q-biggest-red-flag',
  'q-hidden-talent',
  'q-morning-routine',
  'q-dealbreaker',
];

function buildSpotlight(persona: Persona): SpotlightContent {
  // Prefer questions where THIS persona has authored answers — feels in-character
  const withAnswers = QUESTION_POOL.filter(
    (q) => q.personaAnswers?.[persona.id],
  );
  const fallbacks = QUESTION_POOL.filter(
    (q) => FALLBACK_Q_IDS.includes(q.id) && !withAnswers.includes(q),
  );
  const picks = [...withAnswers, ...fallbacks].slice(0, 3);

  const qa = picks.map((q) => {
    const answers = q.personaAnswers?.[persona.id] ?? q.defaultAnswers;
    return { q: q.text, a: answers[0] ?? '[ — ]' };
  });

  return {
    stereotype: persona.stereotype,
    name: persona.name,
    bio: persona.description,
    qa,
  };
}

function PersonaSpotlight({
  personas,
  assetsUrl,
}: {
  personas: Persona[];
  assetsUrl: string;
}) {
  // Show 8 personas — full magazine spreads. The collage section below shows
  // ALL personas as portrait thumbnails for breadth.
  const final = personas.slice(0, 8);

  return (
    <section
      aria-label="A few of the characters you'll play"
      className="border-t border-skin-rule mt-8 sm:mt-12 pt-12 sm:pt-16"
    >
      <div className="px-5 sm:px-8 max-w-[1200px] mx-auto mb-6 flex justify-between items-baseline">
        <h2 className="font-display font-bold uppercase tracking-[0.22em] text-skin-pink text-[13px] sm:text-[14px]">
          A few of the characters you&apos;ll play
        </h2>
        <p className="font-mono uppercase tracking-[0.22em] text-skin-dim text-[10px]">
          Swipe →
        </p>
      </div>

      <div className="relative">
        <div
          data-carousel="spotlight"
          className="snap-x snap-mandatory overflow-x-auto cursor-grab active:cursor-grabbing scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex">
            {final.map((p, i) => {
              const content = buildSpotlight(p);
              return (
                <div
                  key={p.id}
                  data-carousel-slide
                  className="snap-start snap-always shrink-0 w-full"
                >
                  <div className="px-5 sm:px-8 max-w-[1200px] mx-auto">
                    <SpotlightSpread
                      persona={p}
                      content={content}
                      assetsUrl={assetsUrl}
                      featureNo={i + 1}
                      total={final.length}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <CarouselArrows
          count={final.length}
          containerSelector='[data-carousel="spotlight"]'
          itemSelector="[data-carousel-slide]"
        />
      </div>

      <CarouselDots
        count={final.length}
        containerSelector='[data-carousel="spotlight"]'
        itemSelector="[data-carousel-slide]"
        label="Spotlight personas"
      />
    </section>
  );
}

function SpotlightSpread({
  persona,
  content,
  assetsUrl,
  featureNo,
  total,
}: {
  persona: Persona;
  content: SpotlightContent;
  assetsUrl: string;
  featureNo: number;
  total: number;
}) {
  const imgSrc = assetsUrl
    ? `${assetsUrl}/personas/${persona.id}/medium.png`
    : `/api/persona-image/${persona.id}/medium.png`;

  const nameParts = content.name.split(' ');
  const firstName = nameParts[0] ?? content.name;
  const lastName = nameParts.slice(1).join(' ');

  return (
    <article className="relative">
      {/* COVER: full-bleed portrait + overlaid type incl. quiet GM bio.
          Only slide 1 loads eagerly (LCP candidate); 2-8 lazy-load. Saves
          ~5-7MB of off-screen image data on initial page load. */}
      <div className="relative w-full aspect-[3/4] sm:aspect-[16/10] overflow-hidden bg-skin-input">
        <img
          src={imgSrc}
          alt={content.name}
          className="absolute inset-0 w-full h-full object-cover object-top [filter:contrast(1.18)_saturate(0.8)]"
          loading={featureNo === 1 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={featureNo === 1 ? 'high' : 'auto'}
        />

        {/* Scrim layers */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-transparent pointer-events-none" />

        {/* Top folio + stereotype. Stereotype gets a solid red pill for
            guaranteed contrast against any portrait background. */}
        <p className="absolute top-5 sm:top-8 left-5 sm:left-8 font-mono uppercase tracking-[0.22em] text-[rgba(245,243,240,0.85)] text-[10px] [text-shadow:0_1px_4px_rgba(0,0,0,0.85)] z-10">
          № {String(featureNo).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </p>
        <p className="absolute top-5 sm:top-8 right-5 sm:right-8 bg-skin-pink text-skin-base font-display font-bold uppercase tracking-[0.18em] text-[10px] sm:text-[11px] px-2.5 py-1 rounded-sm shadow-md z-10">
          {content.stereotype}
        </p>

        {/* NAME — bottom-left overlay, massive */}
        <h3
          className="absolute bottom-[40%] sm:bottom-1/2 sm:translate-y-1/2 left-5 sm:left-10 right-5 sm:right-auto font-display font-black uppercase leading-[0.82] tracking-[-0.025em] text-skin-base z-10 [text-shadow:0_2px_24px_rgba(0,0,0,0.6)]"
          style={{ fontSize: 'clamp(3rem, 9vw, 6.5rem)' }}
        >
          <span className="block">{firstName}</span>
          {lastName && <span className="block">{lastName}</span>}
        </h3>

        {/* GM bio — pull-quote on cover. text-balance prevents orphans and
            mid-word breaks on small viewports; tracking relaxed so italic
            characters don't collide. */}
        <div className="absolute bottom-5 sm:bottom-8 left-5 sm:left-auto sm:right-8 right-5 sm:max-w-[32ch] z-10">
          <p
            className="font-body italic font-medium text-skin-base leading-[1.18] tracking-normal [text-wrap:balance] hyphens-auto [text-shadow:0_1px_10px_rgba(0,0,0,0.9)]"
            style={{ fontSize: 'clamp(1.0625rem, 2.2vw, 1.5rem)' }}
          >
            <span aria-hidden className="text-skin-pink font-display font-black not-italic mr-[0.05em] leading-[0]">
              &ldquo;
            </span>
            {content.bio}
            <span aria-hidden className="text-skin-pink font-display font-black not-italic ml-[0.05em] leading-[0]">
              &rdquo;
            </span>
          </p>
          <p className="mt-3 flex items-center gap-2 font-mono uppercase tracking-[0.24em] text-[rgba(245,243,240,0.9)] text-[10px] sm:text-[11px] [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 bg-skin-pink rounded-[1px] motion-safe:animate-pulse"
            />
            The Game Master
          </p>
        </div>
      </div>

      {/* INTERVIEW: Q&A below cover, full-width grid for breathing room.
          Each item has a subtle hover accent — quiet delight that signals
          the answers are content, not chrome. */}
      <div className="mt-10 sm:mt-14">
        <p className="font-mono uppercase tracking-[0.22em] text-skin-dim text-[10px] mb-6">
          Casting Q&amp;A · in character
        </p>
        <dl className="grid sm:grid-cols-3 gap-x-10 gap-y-10">
          {content.qa.map((qa) => (
            <div
              key={qa.q}
              className="group relative border-t border-skin-rule pt-5 transition-colors duration-300 hover:border-skin-pink"
            >
              <span
                aria-hidden
                className="absolute top-0 left-0 h-px w-0 bg-skin-pink transition-[width] duration-500 ease-out group-hover:w-12"
              />
              <dt className="font-mono uppercase tracking-[0.16em] text-[10px] sm:text-[11px] text-skin-pink leading-snug">
                {qa.q}
              </dt>
              <dd
                className="mt-3 font-body italic font-semibold text-skin-base leading-[1.22] tracking-normal [text-wrap:balance]"
                style={{ fontSize: 'clamp(1.125rem, 2.2vw, 1.5rem)' }}
              >
                {qa.a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Persona Collage — vertical-slice cards of all available personas  */
/* ------------------------------------------------------------------ */

function PersonaCollage({
  personas,
  assetsUrl,
}: {
  personas: Persona[];
  assetsUrl: string;
}) {
  return (
    <section
      aria-label="All available personas"
      className="border-t border-skin-rule mt-12 sm:mt-16 pt-12 sm:pt-16 pb-4"
    >
      <div className="px-5 sm:px-8 max-w-[1200px] mx-auto mb-6 flex justify-between items-baseline">
        <h2 className="font-display font-bold uppercase tracking-[0.22em] text-skin-pink text-[13px] sm:text-[14px]">
          All {personas.length} characters
        </h2>
        <p className="font-mono uppercase tracking-[0.22em] text-skin-dim text-[10px] sm:hidden">
          Swipe →
        </p>
      </div>
      <p className="px-5 sm:px-8 max-w-[1200px] mx-auto -mt-2 mb-8 font-body text-skin-dim text-[14px] sm:text-[15px] leading-snug max-w-[60ch]">
        Each game pulls a fresh cast from the pool — size varies. New
        characters added regularly. You won&apos;t know who you&apos;re playing
        until your cast is set.
      </p>

      {/* Mobile: horizontal scroll, each card ~62vw so faces are recognizable.
          Desktop: 4-col grid, denser. */}
      <div className="sm:hidden overflow-x-auto snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-3 px-5 pb-4">
          {personas.map((p) => (
            <li
              key={p.id}
              className="snap-center snap-always shrink-0 w-[62vw] max-w-[280px]"
            >
              <PersonaCard persona={p} assetsUrl={assetsUrl} />
            </li>
          ))}
        </ul>
      </div>
      <ul className="hidden sm:grid px-5 sm:px-8 max-w-[1200px] mx-auto grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {personas.map((p) => (
          <li key={p.id}>
            <PersonaCard persona={p} assetsUrl={assetsUrl} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PersonaCard({
  persona,
  assetsUrl,
}: {
  persona: Persona;
  assetsUrl: string;
}) {
  const imgSrc = assetsUrl
    ? `${assetsUrl}/personas/${persona.id}/headshot.png`
    : `/api/persona-image/${persona.id}/headshot.png`;
  return (
    <article className="group">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-skin-input border border-[rgba(245,243,240,0.1)]">
        <img
          src={imgSrc}
          alt={persona.name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-top [filter:contrast(1.12)_saturate(0.85)] transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
      </div>
      <p className="mt-2.5 font-display font-black uppercase text-skin-base text-[14px] sm:text-[15px] tracking-tight leading-tight">
        {persona.name}
      </p>
      <p className="font-mono uppercase tracking-[0.16em] text-skin-pink text-[9px] sm:text-[10px] mt-0.5">
        {persona.stereotype}
      </p>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Cartridge Preview — carousel of 6 cards                           */
/* ------------------------------------------------------------------ */

interface Screenshot {
  src: string;
  alt: string;
  title: string;
  desc: string;
}

// Real game captures from 6-player Pulse-shell sessions. The 6 scenes tell
// the social-deduction arc: cohort → DM scheme → confession → vote night →
// elimination → next-day cartridge.
const SCREENSHOTS: Screenshot[] = [
  {
    src: '/screenshots/cohort-timeline.png',
    alt: 'Day 1 social feed with six-player cast strip and group chat',
    title: 'Your cast, your day',
    desc: 'Personas across the top. Group chat unfolds below — gossip, suspicion, alliances forming.',
  },
  {
    src: '/screenshots/dm-distrust.png',
    alt: 'Private DM with Tiffany Jewel showing scheming chat',
    title: 'Schemes live in DMs',
    desc: 'Tap a face, open a 1:1. The real game is here — leverage, lies, late-night strategy.',
  },
  {
    src: '/screenshots/confession-booth.png',
    alt: 'Confession Booth with three anonymous cassette tapes about other players',
    title: 'Some nights, the booth opens',
    desc: 'Tapes go in anonymous. Everyone reads, no one knows who said what. The whisper economy.',
  },
  {
    src: '/screenshots/vote-majority.png',
    alt: 'Day 1 voting open with four of six votes cast',
    title: 'Vote night arrives',
    desc: 'A live tally. Four of six already locked in. The pressure to commit before the window closes.',
  },
  {
    src: '/screenshots/player-elimination.png',
    alt: 'Full-screen elimination splash — "The group turns on Tiffany Jewel"',
    title: "Sometimes it's you",
    desc: 'The narrator delivers the news. Your portrait fills the screen. The cohort moves on without you.',
  },
  {
    src: '/screenshots/cartridge-kings-ransom.png',
    alt: 'King’s Ransom cartridge with King and Steal/Protect decision',
    title: 'A different game every day',
    desc: 'King’s Ransom: side with the throne or split the vault. Eight votes, dozens of games, six prompts — the mix changes daily.',
  },
];

function CartridgePreview() {
  return (
    <section
      aria-label="What you'll see"
      className="border-t border-skin-rule mt-12 sm:mt-16 pt-12 sm:pt-16 pb-12"
    >
      <div className="px-5 sm:px-8 max-w-[1200px] mx-auto mb-8">
        <div className="flex justify-between items-baseline">
          <h2 className="font-display font-bold uppercase tracking-[0.22em] text-skin-pink text-[13px] sm:text-[14px]">
            What you&apos;ll see
            <span className="ml-2 text-skin-dim normal-case tracking-[0.16em] text-[10px] sm:text-[11px]">
              · in-game screenshots
            </span>
          </h2>
          <p className="font-mono uppercase tracking-[0.22em] text-skin-dim text-[10px]">
            Swipe →
          </p>
        </div>
        <p className="mt-2 font-body text-skin-dim text-[14px] sm:text-[15px] leading-snug max-w-[60ch]">
          Captured from a real six-player playtest. No mockups, no concept art.
        </p>
      </div>

      <div className="relative">
        <div
          data-carousel="screenshots"
          className="snap-x snap-mandatory overflow-x-auto cursor-grab active:cursor-grabbing scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex">
            {SCREENSHOTS.map((s, i) => (
              <li
                key={s.src}
                data-carousel-slide
                className="snap-center snap-always shrink-0 w-full px-5 sm:px-8"
              >
                <ScreenshotSlide screenshot={s} index={i} total={SCREENSHOTS.length} />
              </li>
            ))}
          </ul>
        </div>

        <CarouselArrows
          count={SCREENSHOTS.length}
          containerSelector='[data-carousel="screenshots"]'
          itemSelector="[data-carousel-slide]"
        />
      </div>

      <CarouselDots
        count={SCREENSHOTS.length}
        containerSelector='[data-carousel="screenshots"]'
        itemSelector="[data-carousel-slide]"
        label="Screenshot showcase"
      />

      <p className="mt-10 px-5 sm:px-8 max-w-[1200px] mx-auto text-center font-body text-skin-dim text-[14px] sm:text-[15px] [font-variant-numeric:tabular-nums]">
        8 voting mechanics · 25 mini-games · 6 prompts · 3 dilemmas — every day,
        a different mix.
      </p>
    </section>
  );
}

function ScreenshotSlide({
  screenshot,
  index,
  total,
}: {
  screenshot: Screenshot;
  index: number;
  total: number;
}) {
  return (
    <figure className="max-w-[1100px] mx-auto grid sm:grid-cols-[3fr_2fr] gap-8 sm:gap-12 items-center">
      <div className="w-fit mx-auto">
        <img
          src={screenshot.src}
          alt={screenshot.alt}
          loading={index === 0 ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={index === 0 ? 'high' : 'auto'}
          className="block w-auto max-h-[80vh] sm:max-h-[70vh] rounded-xl shadow-card transition-transform duration-500 motion-safe:hover:scale-[1.015]"
        />
      </div>
      <figcaption className="text-center sm:text-left">
        <p className="font-mono uppercase tracking-[0.22em] text-skin-dim text-[10px] sm:text-[11px]">
          № {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </p>
        <p
          className="mt-3 font-display font-black uppercase text-skin-base tracking-tight leading-[0.95]"
          style={{ fontSize: 'clamp(1.625rem, 3.5vw, 2.5rem)' }}
        >
          {screenshot.title}
        </p>
        <p className="mt-4 font-body text-skin-dim text-[15px] sm:text-[16px] leading-relaxed max-w-[40ch] mx-auto sm:mx-0">
          {screenshot.desc}
        </p>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  Final CTA — last conversion shot before footer                    */
/* ------------------------------------------------------------------ */

function FinalCta({ playtestUrl }: { playtestUrl: string }) {
  return (
    <section
      id="final-cta"
      aria-label="Sign up"
      className="border-t border-skin-rule mt-12 sm:mt-16 px-5 sm:px-8 py-14 sm:py-16 text-center"
    >
      <p className="font-mono uppercase tracking-[0.32em] text-skin-pink text-[11px] sm:text-[12px]">
        Casting open
      </p>
      <h2
        className="mt-4 font-display font-black uppercase leading-[0.92] tracking-tight text-skin-base max-w-[640px] mx-auto"
        style={{ fontSize: 'clamp(1.875rem, 4.5vw, 2.875rem)' }}
      >
        Get on the next cast.
      </h2>
      <p className="mt-3 font-body text-skin-dim text-[15px] sm:text-[16px] leading-relaxed max-w-[44ch] mx-auto">
        New casts open as players sign up. We&apos;ll email when yours starts.
      </p>
      <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href={playtestUrl}
          className="inline-block w-full sm:w-auto sm:min-w-[220px] py-4 px-6 text-center font-display font-bold text-sm tracking-widest uppercase rounded-xl bg-skin-pink text-skin-base shadow-btn motion-safe:hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0.5 active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-pink transition-[transform,filter] duration-150 ease-out"
        >
          Sign up to play
        </Link>
        <Link
          href="/how-it-works"
          className="inline-block w-full sm:w-auto sm:min-w-[220px] py-4 px-6 text-center font-display font-bold text-sm tracking-widest uppercase rounded-xl border-2 border-skin-base text-skin-base hover:bg-skin-pink hover:text-skin-base hover:border-skin-pink active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-base transition-[background-color,color,border-color,transform] duration-150 ease-out"
        >
          How it works →
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Footer                                                            */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="px-5 sm:px-8 py-8 border-t border-skin-rule pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="max-w-[1200px] mx-auto flex flex-col items-center gap-3">
        <Link
          href="/"
          className="font-display font-black text-base tracking-tight uppercase text-skin-base py-3 px-4 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-pink"
        >
          Pecking Order
        </Link>
        <nav className="flex items-center gap-2 text-[12px] text-skin-dim tracking-wider uppercase font-body">
          <Link
            href="/privacy"
            className="py-3 px-3 rounded-md hover:text-skin-pink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-pink"
          >
            Privacy
          </Link>
          <span aria-hidden className="text-skin-rule">
            ·
          </span>
          <Link
            href="/terms"
            className="py-3 px-3 rounded-md hover:text-skin-pink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-pink"
          >
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
