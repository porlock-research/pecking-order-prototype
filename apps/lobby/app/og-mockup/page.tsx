// TEMPORARY page for capturing /og-casting.png. Renders a 1200×630 tabloid
// magazine cover at /og-mockup. Open in Chrome at viewport 1200×630, screenshot,
// save as apps/lobby/public/og-casting.png. Delete this file once captured.
//
// Persona is randomized per request — refresh until a face you like comes up.

import { getDB, getEnv } from '@/lib/db';
import { Permanent_Marker } from 'next/font/google';

const scrawl = Permanent_Marker({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
});

interface Persona {
  id: string;
  name: string;
  stereotype: string;
}

// Persona locked to Barry Bumbling / The Accidental Contestant. The
// confused-game-show-contestant read pairs perfectly with the "LIAR?"
// tabloid scrawl, and the stereotype caption ("The Accidental Contestant")
// signals the game's light-hearted reality-TV tone — better than a generic
// model shot. Captured locally and committed to public/og-casting.png.
const LOCKED_PERSONA_ID = 'persona-37';

async function getLockedPersona(): Promise<Persona | null> {
  try {
    const db = await getDB();
    const { results } = await db
      .prepare(
        'SELECT id, name, stereotype FROM PersonaPool WHERE id = ?',
      )
      .bind(LOCKED_PERSONA_ID)
      .all<Persona>();
    return results[0] ?? null;
  } catch {
    return null;
  }
}

export default async function OgMockupPage() {
  const [persona, env] = await Promise.all([getLockedPersona(), getEnv()]);
  const assetsUrl = (env.PERSONA_ASSETS_URL as string) || '';
  const portraitSrc = persona
    ? assetsUrl
      ? `${assetsUrl}/personas/${persona.id}/medium.png`
      : `/api/persona-image/${persona.id}/medium.png`
    : null;

  return (
    <div
      className="relative bg-skin-deep overflow-hidden font-body text-skin-base"
      style={{ width: 1200, height: 630 }}
    >
      {/* Hide Next.js dev tools, etc. so the screenshot is clean. */}
      <style>{`
        nextjs-portal, [data-nextjs-toast], #__next-build-watcher,
        #__next-prerender-indicator, [data-nextjs-dialog-overlay],
        [data-nextjs-dev-tools-button], [data-next-mark],
        [data-nextjs-router-announcer] { display: none !important; }
        body { margin: 0; padding: 0; overflow: hidden; }
      `}</style>

      {/* Subtle paper-grain texture overlay */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(245,243,240,0.6) 0%, transparent 50%), radial-gradient(circle at 85% 70%, rgba(215,38,56,0.4) 0%, transparent 55%)',
        }}
      />

      {/* RIGHT — persona + tabloid suspect drama */}
      {persona && portraitSrc ? (
        <div className="absolute right-0 top-0 bottom-0" style={{ width: 540 }}>
          <img
            src={portraitSrc}
            alt=""
            className="w-full h-full object-cover object-top"
            style={{ filter: 'contrast(1.15) saturate(0.75)' }}
          />
          {/* Left-side scrim — fades to deep ink so text stays clean */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to right, #0a0a0a 0%, rgba(10,10,10,0.85) 10%, rgba(10,10,10,0.4) 28%, rgba(10,10,10,0.05) 55%, transparent 100%)',
            }}
          />

          {/* "CLAIMS:" suspect label — fake-bio framing makes viewer wonder
              if the persona is even real. */}
          <p
            className="absolute font-mono uppercase tracking-[0.18em] text-[12px] z-10"
            style={{
              top: 36,
              left: 36,
              right: 28,
              textShadow: '0 1px 6px rgba(0,0,0,0.95)',
            }}
          >
            <span className="text-skin-pink">Claims:</span>{' '}
            <span className="text-skin-base">{persona.stereotype}</span>
          </p>

          {/* TABLOID SCRAWL — diagonal red "Liar?" overlay. The mystery hook —
              instantly tells viewer this game is about deception. */}
          <span
            aria-hidden
            className={`${scrawl.className} absolute text-skin-pink select-none pointer-events-none`}
            style={{
              top: '32%',
              right: '4%',
              fontSize: 168,
              transform: 'rotate(-9deg)',
              textShadow:
                '0 0 24px rgba(0,0,0,0.55), 0 6px 14px rgba(0,0,0,0.7)',
              letterSpacing: '-0.01em',
              lineHeight: 0.9,
              opacity: 0.97,
            }}
          >
            Liar?
          </span>

        </div>
      ) : (
        // Empty-state fallback: solid ink panel with mark text. Only fires if
        // PersonaPool DB query fails — never on production where the table is
        // populated. Keeps the OG capture from rendering broken-image.
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center justify-center"
          style={{
            width: 540,
            background:
              'linear-gradient(135deg, #1d1d1d 0%, #0a0a0a 100%)',
          }}
        >
          <span
            className="font-mono uppercase tracking-[0.3em] text-skin-faint text-[13px]"
          >
            [ Cast Awaits ]
          </span>
        </div>
      )}

      {/* LEFT — text column */}
      <div
        className="relative z-10 flex flex-col h-full"
        style={{ padding: '50px 64px', width: 660 }}
      >
        {/* "You're invited" badge — direct address to the recipient. This OG
            card is shared peer-to-peer (one player invites another), so the
            invite-language framing matches the channel. */}
        <div className="inline-flex items-center gap-2 self-start bg-skin-pink px-3.5 py-1.5 rounded-sm shadow-md">
          <span
            aria-hidden
            className="block w-1.5 h-1.5 rounded-full bg-skin-base"
          />
          <span className="font-display font-bold uppercase tracking-[0.2em] text-skin-base text-[12px]">
            You&apos;re Invited
          </span>
        </div>

        {/* spacer */}
        <div className="flex-1" />

        {/* PECKING ORDER wordmark — DOMINATES */}
        <h1
          className="font-display font-black uppercase text-skin-base"
          style={{
            fontSize: 124,
            lineHeight: 0.84,
            letterSpacing: '-0.025em',
          }}
        >
          <span className="block">Pecking</span>
          <span className="block">Order</span>
        </h1>

        {/* Tagline — short, brand-on. Catfishing/survival in red carry the
            visual load now that the red rule is gone (the two red pills
            already bookend, no need for an additional separator). */}
        <p
          className="font-display font-bold uppercase text-skin-base"
          style={{
            fontSize: 26,
            lineHeight: 1.05,
            letterSpacing: '-0.005em',
            maxWidth: 540,
            marginTop: 22,
          }}
        >
          A game of <span className="text-skin-pink">catfishing</span>,
          betrayal &amp; <span className="text-skin-pink">survival</span>.
        </p>

        {/* CTA — bookends the "You're invited" pill at the top with a matching
            red action pill at the bottom. Big, display-bold, uppercase — this
            is the loudest action element on the card. The recipient knows
            exactly what to do (RSVP) and where (peckingorder.ca). */}
        <div
          className="inline-flex items-center self-start bg-skin-pink rounded-md shadow-md"
          style={{
            padding: '14px 22px',
            marginTop: 22,
            gap: 14,
          }}
        >
          <span
            className="font-display font-black uppercase tracking-[0.06em] text-skin-base"
            style={{ fontSize: 26, lineHeight: 1 }}
          >
            RSVP
          </span>
          <span
            aria-hidden
            className="font-display font-black text-skin-base"
            style={{ fontSize: 26, lineHeight: 1, opacity: 0.7 }}
          >
            →
          </span>
          <span
            className="font-mono uppercase tracking-[0.16em] text-skin-base"
            style={{ fontSize: 18, lineHeight: 1 }}
          >
            peckingorder.ca
          </span>
        </div>
      </div>
    </div>
  );
}
