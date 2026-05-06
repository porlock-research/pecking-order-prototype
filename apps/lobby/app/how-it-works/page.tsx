import Link from 'next/link';
import { getEnv } from '@/lib/db';
import { StickyCta } from './sticky-cta';

export default async function HowItWorksPage() {
  const env = await getEnv();
  // Relative path keeps in-page CTAs portable across staging/prod without
  // env wiring. PLAYTEST_URL env override is honored if explicitly set
  // (e.g., for cross-host marketing campaigns).
  const playtestUrl = (env.PLAYTEST_URL as string) || '/playtest';

  return (
    <div className="min-h-screen bg-skin-deep font-body text-skin-base selection:bg-[rgba(215,38,56,0.3)]">
      <Masthead />

      <main>
        <Hero playtestUrl={playtestUrl} />
        {/* Day rhythm moved up to position 2 — format-curious visitors who
            clicked "How it works" want to see what a day looks like FIRST,
            before they look at screenshots. */}
        <DayRhythm />
        <VisualProof />
        <DifferentFromOrgs />
        <Catfish />
        <WhatsThereWhatsNot />
        <MidCta playtestUrl={playtestUrl} />
        <Faq />
        <FinalCta playtestUrl={playtestUrl} />
        <Footer />
      </main>

      <StickyCta
        playtestUrl={playtestUrl}
        hideWhenInViewSelectors={['#mid-cta', '#final-cta']}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Masthead                                                          */
/* ------------------------------------------------------------------ */

function Masthead() {
  return (
    <header className="border-b-2 border-skin-base px-5 py-3 max-w-[960px] mx-auto">
      <Link
        href="/"
        className="font-display font-black text-xl tracking-tight uppercase text-skin-base inline-flex items-center py-2.5 -my-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-pink"
      >
        Pecking Order
      </Link>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  §1 Hero                                                           */
/* ------------------------------------------------------------------ */

function Hero({ playtestUrl }: { playtestUrl: string }) {
  return (
    <section
      data-sticky-cta-show-after
      className="relative px-5 pt-10 pb-14 max-w-[640px] mx-auto"
    >
      <h1
        className="font-display font-black uppercase leading-[0.9] tracking-tight text-skin-base"
        style={{ fontSize: 'clamp(3rem, 11vw, 6rem)' }}
      >
        <span className="text-skin-pink">Catfish.</span>{' '}
        <span>Scheme.</span> <span>Vote.</span>
      </h1>

      <p
        className="mt-3 font-display font-bold uppercase leading-[1.05] tracking-tight text-skin-base"
        style={{ fontSize: 'clamp(1.25rem, 4vw, 1.75rem)' }}
      >
        No host. No application. Join when you want.
      </p>

      {/* Specs block — newsprint receipt. Trimmed to 3 most-load-bearing
          rows: time commitment, server-run (vs host-run ORGs), magic-link
          join (vs audition). Format/casts redundant with title + sticky CTA. */}
      <dl className="mt-7 border-y border-[rgba(245,243,240,0.25)] py-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[15px]">
        <SpecRow label="Time" value="5–10 min / day, on your phone" />
        <SpecRow label="Host" value="None — server-run" />
        <SpecRow label="Join" value="Magic-link, no application" />
      </dl>

      <div className="mt-8 flex flex-col gap-3">
        <CtaButton href={playtestUrl}>Get cast →</CtaButton>
        <p className="text-[12px] text-skin-faint text-center tracking-wide">
          Free during playtest. Email-only signup.
        </p>
      </div>

      <nav
        aria-label="Jump to section"
        className="mt-10 flex flex-col sm:flex-row gap-2.5 sm:gap-3 text-[12px] sm:text-[13px] tracking-[0.16em] uppercase font-display font-bold"
      >
        <a
          href="#a-game-looks-like-this"
          className="group inline-flex items-center gap-2.5 px-4 py-3 sm:py-2.5 rounded-md border border-[rgba(245,243,240,0.4)] text-skin-base bg-transparent hover:bg-skin-base hover:text-skin-deep hover:border-skin-base transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-pink"
        >
          <span aria-hidden className="text-skin-pink group-hover:text-skin-pink transition-transform motion-safe:group-hover:translate-y-0.5">↓</span>
          A day looks like this
        </a>
        <a
          href="#faq"
          className="group inline-flex items-center gap-2.5 px-4 py-3 sm:py-2.5 rounded-md border border-[rgba(245,243,240,0.4)] text-skin-base bg-transparent hover:bg-skin-base hover:text-skin-deep hover:border-skin-base transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-pink"
        >
          <span aria-hidden className="text-skin-pink group-hover:text-skin-pink transition-transform motion-safe:group-hover:translate-y-0.5">↓</span>
          Common questions
        </a>
      </nav>
    </section>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-mono uppercase text-[11px] tracking-[0.18em] text-skin-faint pt-0.5">
        {label}
      </dt>
      <dd className="text-skin-base font-body">{value}</dd>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  §2 Visual proof                                                   */
/* ------------------------------------------------------------------ */

function VisualProof() {
  const shots: ScreenshotProps[] = [
    {
      src: '/screenshots/cohort-timeline.png',
      alt: 'Day 1 social feed with six-player cast strip and group chat',
      caption: 'The cast.',
      sub: 'Personas across the top. Group chat below. Watch it shrink each day.',
    },
    {
      src: '/screenshots/dm-distrust.png',
      alt: 'Private DM with Tiffany Jewel showing scheming chat',
      caption: 'The DM.',
      sub: "Tap a face, open a 1:1. The real game lives here.",
    },
    {
      src: '/screenshots/vote-majority.png',
      alt: 'Day 1 voting open with four of six votes cast',
      caption: 'The vote.',
      sub: "Today's mechanic: Majority. Four of six already locked in.",
    },
    {
      src: '/screenshots/player-elimination.png',
      alt: 'Full-screen elimination splash with the narrator line "The group turns on Tiffany Jewel"',
      caption: 'The reveal.',
      sub: 'When it happens to you, your portrait fills the screen. The cohort moves on.',
    },
  ];

  return (
    <section
      id="a-game-looks-like-this"
      className="px-5 py-16 border-t border-skin-rule"
    >
      <div className="max-w-[960px] mx-auto">
        <Eyebrow>What you&apos;ll see</Eyebrow>
        <SectionHeading>A game looks like this</SectionHeading>
        <p className="mt-5 max-w-[55ch] text-skin-dim text-[17px] leading-relaxed">
          Real screenshots from a six-player playtest — no mockups. A cast
          strip up top, scoped chat below (main feed, 1:1 DMs, group DMs), and
          a daily vote that always sends someone home. No install, no app
          store, no Discord setup.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-12">
          {shots.map((s) => (
            <Screenshot key={s.src} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

interface ScreenshotProps {
  src: string;
  alt: string;
  caption: string;
  sub: string;
}

function Screenshot({ src, alt, caption, sub }: ScreenshotProps) {
  return (
    <figure className="motion-safe:hover:-rotate-1 transition-transform duration-300">
      <div className="w-fit mx-auto">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="block w-auto max-h-[70vh] rounded-[2rem] border border-skin-base shadow-card bg-skin-input"
        />
      </div>
      <figcaption className="mt-4 px-1">
        <p className="font-display font-black uppercase tracking-tight text-skin-base text-[20px] leading-tight">
          {caption}
        </p>
        <p className="mt-1 font-body italic text-skin-dim text-[14px] leading-snug">
          {sub}
        </p>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/*  §3 Day rhythm                                                     */
/* ------------------------------------------------------------------ */

function DayRhythm() {
  const steps = [
    {
      verb: 'Morning briefing',
      body: (
        <>
          Game Master posts the day's lineup. Cast catches up on what
          happened overnight.
        </>
      ),
    },
    {
      verb: 'Social hour',
      body: (
        <>
          DMs open. You get a daily allowance of partners and characters; pick
          where to spend them.
        </>
      ),
    },
    {
      verb: "The day's mini-game",
      body: (
        <>
          One of 25 — <Mono>Quick Math</Mono>, <Mono>Stacker</Mono>,{' '}
          <Mono>Blind Auction</Mono>, <Mono>King's Ransom</Mono>,{' '}
          <Mono>Reaction Time</Mono>, <Mono>Snake</Mono>. Earn silver — the
          in-game currency you spend on perks and gifts.
        </>
      ),
    },
    {
      verb: 'The prompt',
      body: (
        <>
          One of six — <Mono>Hot Take</Mono>, <Mono>Would You Rather</Mono>,{' '}
          <Mono>Confession</Mono>, <Mono>Guess Who</Mono>. Anonymous answers,
          public reveal.
        </>
      ),
    },
    {
      verb: 'The vote',
      body: (
        <>
          One of 8 mechanics — <Mono>Majority</Mono>, <Mono>Bubble</Mono>,{' '}
          <Mono>Trust Pairs</Mono>, <Mono>Podium Sacrifice</Mono>,{' '}
          <Mono>Executioner</Mono>, <Mono>Shield</Mono>,{' '}
          <Mono>Second-to-Last</Mono>. Each shapes who gets out and how.
        </>
      ),
    },
    {
      verb: 'The reveal',
      body: <>Server tabulates. Someone leaves. Tomorrow opens.</>,
    },
  ];

  return (
    <section className="px-5 py-16 border-t border-skin-rule bg-[rgba(19,19,19,0.3)]">
      <div className="max-w-[960px] mx-auto">
        <Eyebrow>Each day</Eyebrow>
        <SectionHeading>A day looks like this</SectionHeading>
        <p className="mt-5 max-w-[55ch] text-skin-dim text-[17px] leading-relaxed">
          Every game day moves through morning briefing, social hour, a
          mini-game, the vote, and the reveal — plus an activity or dilemma
          most days. The lineup changes daily.
        </p>

        <ol className="mt-10 max-w-[640px] space-y-8 relative">
          <span
            aria-hidden
            className="absolute left-[14px] top-3 bottom-3 w-px bg-[rgba(245,243,240,0.2)]"
          />
          {steps.map((s, i) => (
            <li key={s.verb} className="relative pl-12">
              <span className="absolute left-0 top-0 w-7 h-7 rounded-full bg-skin-deep border border-skin-base flex items-center justify-center font-mono text-[11px] tracking-wider text-skin-dim">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="font-display font-bold uppercase tracking-tight text-skin-base text-[22px] sm:text-[26px] leading-tight">
                {s.verb}
              </h3>
              <p className="mt-1.5 text-skin-dim text-[16px] leading-relaxed">
                {s.body}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-[55ch] text-skin-faint italic text-[15px] leading-relaxed">
          Phases stay open for hours, not minutes. Push notifications carry
          the heads-up. 5–10 minutes total per day if you're casual; longer
          if you're scheming.
        </p>
      </div>
    </section>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[0.92em] text-[rgba(245,243,240,0.95)] bg-[rgba(29,29,29,0.6)] px-1 py-px rounded">
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  §4 Different from ORGs?                                           */
/* ------------------------------------------------------------------ */

function DifferentFromOrgs() {
  const bullets = [
    {
      label: 'Days, not weeks.',
      body: 'A game runs ~5 days for a 6-player cast, longer for bigger ones. Plays during your normal week, not as a season-long commitment.',
    },
    {
      label: 'One cast, not three tribes.',
      body: 'No tribe split, no merge. Casts typically 6–12 players in the sweet spot — smaller gets tighter, larger gets noisier.',
    },
    {
      label: 'Server-handled ops.',
      body: 'Vote tabulation, phase clocks, push notifications. No host-spreadsheet at 2am.',
    },
    {
      label: 'Magic-link join.',
      body: "No application, no audition, no Discord setup. Click a link, you're in.",
    },
    {
      label: 'Play on demand.',
      body: 'Casts open continuously as players sign up. Not gated by a season calendar.',
    },
    {
      label: 'Persona-based.',
      body: 'You play a character, not yourself. (More on this below.)',
    },
  ];

  return (
    <section className="px-5 py-16 border-t border-skin-rule">
      <div className="max-w-[960px] mx-auto">
        <Eyebrow>For ORG players</Eyebrow>
        <SectionHeading>Different from ORGs?</SectionHeading>
        <p className="mt-5 max-w-[60ch] text-skin-dim text-[17px] leading-relaxed">
          Yes, by design. SRorgs is a 6–10 week multi-tribe arc with custom
          challenges, hidden idols, and the operational depth that comes from
          a host putting 100+ hours into a season. PO is a different shape:
        </p>

        <ul className="mt-8 max-w-[640px] divide-y divide-skin-rule">
          {bullets.map((b) => (
            <li key={b.label} className="py-4">
              <p className="font-body font-semibold text-skin-base text-[17px]">
                {b.label}
              </p>
              <p className="mt-1 text-skin-dim text-[15px] leading-relaxed">
                {b.body}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-[55ch] italic text-[rgba(245,243,240,0.85)] text-[17px] leading-relaxed">
          Best case: PO fills the gap{' '}
          <span className="text-skin-pink not-italic font-semibold">
            between SRorgs seasons
          </span>
          . Both formats, different week.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  §5 Catfish                                                        */
/* ------------------------------------------------------------------ */

function Catfish() {
  return (
    <section className="px-5 py-16 border-t border-skin-rule bg-[rgba(19,19,19,0.3)]">
      <div className="max-w-[960px] mx-auto">
        <Eyebrow>The format</Eyebrow>
        <h2
          className="mt-3 font-display font-black uppercase leading-[0.95] tracking-tight text-skin-base"
          style={{ fontSize: 'clamp(2rem, 6vw, 3.25rem)' }}
        >
          You play a persona.{' '}
          <span className="text-skin-pink">You catfish.</span>
        </h2>

        <div className="mt-8 max-w-[60ch] space-y-5 text-skin-base text-[17px] leading-relaxed">
          <p>
            Every player is handed a character when they join — portrait,
            name, a starter premise. You write a short bio for them, in
            character. Then you play through the cast as them.
          </p>
        </div>

        {/* Pull quote */}
        <blockquote className="mt-10 max-w-[42ch] border-l-4 border-skin-pink pl-6">
          <p
            className="font-body italic font-medium text-skin-base leading-[1.3]"
            style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2rem)' }}
          >
            The persona is your costume. The{' '}
            <span className="text-skin-pink not-italic font-bold">
              catfishing
            </span>{' '}
            is the sport.
          </p>
        </blockquote>

        <div className="mt-10 max-w-[60ch] space-y-5 text-skin-dim text-[17px] leading-relaxed">
          <p>
            Other players see your character; nobody knows who's behind which
            face until the reveal at the end. Closer to Mafia or Werewolf than
            to a true-self ORG — you adopt a role and you commit to it.
          </p>
        </div>

        <p className="mt-8 max-w-[55ch] italic text-skin-faint text-[15px] leading-relaxed">
          SRorgs nails the players-as-themselves format. PO is a different
          shape.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  §6 What's there / what's not                                      */
/* ------------------------------------------------------------------ */

function WhatsThereWhatsNot() {
  const here = [
    {
      label: '42 cartridge variants',
      body: '8 voting mechanics, 6 prompts, 3 dilemmas, 25 mini-games. Every day uses a different mix.',
    },
    {
      label: 'Server-run',
      body: 'no human host. Phase clocks, vote tabulation, push notifications all automatic.',
    },
    {
      label: 'Real-time chat in scoped channels',
      body: 'main feed, 1:1 DMs, group DMs with mutable membership, game-scoped channels during live cartridges.',
    },
    {
      label: 'Per-day economy',
      body: 'DM characters and partners are limited. Silver currency carries influence into voting.',
    },
    {
      label: 'Confession booth',
      body: 'periodic anonymous-handle posting. Nobody knows who said what.',
    },
    {
      label: 'Click-to-join',
      body: 'magic link, no application, no audition.',
    },
    {
      label: 'Continuous casts',
      body: 'new games open as players sign up.',
    },
    {
      label: 'Phone-first PWA',
      body: 'no app store, no install.',
    },
  ];

  const notYet = [
    'Custom challenge designer (you pick from the 25 mini-game cartridges)',
    'Hidden idols, advantages, vote steals',
    'Multi-tribe Survivor structure (single cast only)',
    'Host narration tools (recap posts, custom storyline arcs)',
    'Years of polish (we’re in playtest, bugs exist)',
  ];

  return (
    <section className="px-5 py-16 border-t border-skin-rule">
      <div className="max-w-[960px] mx-auto">
        <Eyebrow>Honest</Eyebrow>
        <SectionHeading>What's there. What's not.</SectionHeading>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Here today */}
          <div className="border border-skin-base rounded-2xl p-6">
            <h3 className="font-display font-black uppercase tracking-[0.18em] text-skin-pink text-[13px] mb-4">
              Here today
            </h3>
            <ul className="space-y-3.5">
              {here.map((item) => (
                <li key={item.label} className="text-[15px] leading-relaxed">
                  <span className="font-body font-semibold text-skin-base">
                    {item.label}:
                  </span>{' '}
                  <span className="text-skin-dim">{item.body}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Not yet */}
          <div className="border border-[rgba(245,243,240,0.5)] rounded-2xl p-6">
            <h3 className="font-display font-black uppercase tracking-[0.18em] text-skin-faint text-[13px] mb-4">
              Not yet
            </h3>
            <ul className="space-y-3.5">
              {notYet.map((item) => (
                <li key={item} className="text-skin-dim text-[15px] leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-10 max-w-[60ch] italic text-[rgba(245,243,240,0.85)] text-[17px] leading-relaxed">
          If anything in the &ldquo;not yet&rdquo; column is a dealbreaker,
          that's fair. Sign up anyway and tell us, or{' '}
          <span className="text-skin-pink not-italic font-semibold">
            play SRorgs
          </span>
          {' '}— both work.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  §7 Mid CTA                                                        */
/* ------------------------------------------------------------------ */

function MidCta({ playtestUrl }: { playtestUrl: string }) {
  return (
    <section
      id="mid-cta"
      className="px-5 py-16 border-t border-skin-rule text-center"
    >
      <div className="max-w-[640px] mx-auto">
        <p className="font-body text-skin-base text-[20px] leading-snug mb-6">
          Sign up if curious.
        </p>
        <CtaButton href={playtestUrl}>Get cast →</CtaButton>
        <p className="mt-3 text-[12px] text-skin-faint tracking-wide">
          Free during playtest. Email-only signup.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  §8 FAQ                                                            */
/* ------------------------------------------------------------------ */

function Faq() {
  const items = [
    {
      q: 'How long is a game?',
      a: 'Roughly 1 day per player. A 6-player cast runs ~5 days; a 12-player cast runs ~11. The last day is always Finals.',
    },
    {
      q: 'How much time per day?',
      a: "5–10 minutes if you're casual. Longer if you're scheming, or if today's mini-game is one you're competitive at.",
    },
    {
      q: 'What if I miss a phase?',
      a: 'Most phases stay open for hours, not minutes. Push notifications fire when one opens. Missing a vote auto-abstains; the rest of the cast still decides. Missing a chat just means you’re quieter that day.',
    },
    {
      q: 'How do timezones work?',
      a: "Phases run on a fixed schedule. Push notifications fire when one opens, so you don't need to keep checking. We pick game start times that work for cross-timezone players.",
    },
    {
      q: 'What devices does it work on?',
      a: 'Phone, tablet, desktop. It’s a web app — no install, no app store. Works on iOS Safari, Android Chrome, desktop browsers. iOS push requires adding to home screen (one tap from the share menu).',
    },
    {
      q: 'Can I play with friends?',
      a: 'Not as a formal feature. After signup you get a referral code — friends who sign up via your link may land in the same cast, but we don’t guarantee it.',
    },
    {
      q: 'How do you handle cheating or collusion?',
      a: 'All in-game messages are scoped to channels — main, DMs, group DMs. The server logs every event. We’re not naive about meta-DMing on Discord; casts that abuse it get flagged and removed.',
    },
    {
      q: 'What data do you collect?',
      a: 'Email (so we can email when your cast starts). Phone optional (for SMS reminders). PII is encrypted at rest. We don’t sell anything. Privacy + Terms at /privacy and /terms.',
    },
    {
      q: 'Is it free?',
      a: 'Yes during playtest. No credit card.',
    },
    {
      q: 'How do I get cast?',
      a: 'Sign up with your email. We email you when a cast opens — currently rolling, as enough players sign up.',
    },
  ];

  return (
    <section id="faq" className="px-5 py-16 border-t border-skin-rule bg-[rgba(19,19,19,0.3)] scroll-mt-8">
      <div className="max-w-[960px] mx-auto">
        <Eyebrow>Questions</Eyebrow>
        <SectionHeading>FAQ</SectionHeading>

        <dl className="mt-8 max-w-[680px] divide-y divide-skin-rule">
          {items.map((item) => (
            <div key={item.q} className="py-5">
              <dt className="flex gap-3">
                <span className="font-display font-bold text-skin-pink text-[18px] flex-shrink-0">
                  Q.
                </span>
                <span className="font-body font-semibold text-skin-base text-[18px] leading-snug">
                  {item.q}
                </span>
              </dt>
              <dd className="mt-2 ml-7 text-skin-dim text-[16px] leading-relaxed">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  §9 Final CTA + Footer                                             */
/* ------------------------------------------------------------------ */

function FinalCta({ playtestUrl }: { playtestUrl: string }) {
  return (
    <section
      id="final-cta"
      className="px-5 py-16 border-t border-skin-rule text-center"
    >
      <div className="max-w-[680px] mx-auto">
        <h2
          className="font-display font-black uppercase leading-[0.95] tracking-tight text-skin-base"
          style={{ fontSize: 'clamp(2rem, 6vw, 3rem)' }}
        >
          <span className="text-skin-pink">Catfish</span> your way
          <br />
          through a cast.
        </h2>
        <p className="mt-4 text-skin-dim text-[17px] leading-relaxed">
          Last <span className="text-skin-pink font-semibold">catfish</span>{' '}
          wins. Free in playtest.
        </p>

        <div className="mt-8">
          <CtaButton href={playtestUrl}>Get cast →</CtaButton>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-5 py-10 border-t border-skin-rule pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="max-w-[960px] mx-auto flex flex-col items-center gap-4">
        <Link
          href="/"
          className="font-display font-black text-base tracking-tight uppercase text-skin-base"
        >
          Pecking Order
        </Link>
        <nav className="flex items-center gap-5 text-[12px] text-skin-faint tracking-wider uppercase font-body">
          <Link href="/privacy" className="hover:text-skin-dim transition-colors">
            Privacy
          </Link>
          <span aria-hidden className="text-skin-rule">
            ·
          </span>
          <Link href="/terms" className="hover:text-skin-dim transition-colors">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared UI                                                         */
/* ------------------------------------------------------------------ */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display font-bold uppercase tracking-[0.22em] text-skin-pink text-[12px]">
      {children}
    </p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-3 font-display font-black uppercase leading-[0.95] tracking-tight text-skin-base"
      style={{ fontSize: 'clamp(2rem, 6vw, 3.25rem)' }}
    >
      {children}
    </h2>
  );
}

function CtaButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-block w-full sm:w-auto sm:min-w-[280px] py-4 px-6 text-center font-display font-bold text-sm tracking-widest uppercase rounded-xl bg-skin-pink text-skin-base shadow-btn hover:brightness-110 active:scale-[0.99] transition-all"
    >
      {children}
    </Link>
  );
}
