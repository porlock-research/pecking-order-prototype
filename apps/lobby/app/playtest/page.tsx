import Link from 'next/link';
import { getDB, getEnv } from '@/lib/db';
import { PersonaCarousel } from './persona-carousel';
import { SignupForm } from './signup-form';
import { ShareButtons } from './share-buttons';

interface Persona {
  id: string;
  name: string;
  stereotype: string;
  description: string;
}

async function getRandomPersonas(count: number): Promise<Persona[]> {
  try {
    const db = await getDB();
    const { results } = await db
      .prepare(
        'SELECT id, name, stereotype, description FROM PersonaPool ORDER BY RANDOM() LIMIT ?',
      )
      .bind(count)
      .all<Persona>();
    return results;
  } catch {
    return [];
  }
}

export default async function PlaytestPage() {
  const [personas, env] = await Promise.all([
    getRandomPersonas(10),
    getEnv(),
  ]);

  const assetsUrl = (env.PERSONA_ASSETS_URL as string) || '';
  const turnstileSiteKey = (env.TURNSTILE_SITE_KEY as string) || '';
  const lobbyHost = (env.LOBBY_HOST as string) || '';
  const playtestUrl = (env.PLAYTEST_URL as string) || `${lobbyHost}/playtest`;

  return (
    <div className="min-h-screen bg-skin-deep bg-grid-pattern font-body text-skin-base selection:bg-[rgba(215,38,56,0.3)] relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-gradient-radial from-[rgba(19,19,19,0.6)] via-[rgba(19,19,19,0.2)] to-transparent opacity-80 pointer-events-none" />

      {/* Hero */}
      <header className="relative pt-[max(2rem,env(safe-area-inset-top))] pb-2 px-4 text-center">
        <h1 className="font-display font-black text-skin-base tracking-tight mb-2 leading-[0.9]" style={{ fontSize: 'clamp(2.75rem, 12vw, 4.5rem)' }}>
          PECKING ORDER
        </h1>
        <p className="text-skin-dim text-base md:text-lg font-light tracking-wide mb-4 max-w-sm mx-auto">
          A multi-day social-deduction game. Sign up for the next cast.
        </p>
        <span className="inline-block bg-[rgba(215,38,56,0.12)] rounded-full px-5 py-2 text-skin-pink text-xs font-bold uppercase tracking-[0.2em] mb-3">
          Playtesting Now
        </span>
        <nav
          aria-label="About Pecking Order"
          className="mb-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3 text-[12px] sm:text-[13px] tracking-[0.16em] uppercase font-display font-bold"
        >
          <Link
            href="/casting"
            className="group inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-[rgba(245,243,240,0.4)] text-skin-base hover:bg-[var(--po-text)] hover:text-skin-inverted hover:border-[var(--po-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-pink"
          >
            <span aria-hidden className="text-skin-pink motion-safe:group-hover:-translate-x-0.5 transition-transform">←</span>
            What is this?
          </Link>
          <Link
            href="/how-it-works"
            className="group inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-[rgba(245,243,240,0.4)] text-skin-base hover:bg-[var(--po-text)] hover:text-skin-inverted hover:border-[var(--po-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-skin-pink"
          >
            How it works
            <span aria-hidden className="text-skin-pink motion-safe:group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </nav>

        {/* Persona Carousel */}
        {personas.length > 0 && (
          <div className="max-w-sm mx-auto px-6">
            <PersonaCarousel personas={personas} assetsUrl={assetsUrl} />
          </div>
        )}
      </header>

      {/* Form */}
      <main className="relative px-5 py-10 max-w-md mx-auto">
        <div className="bg-[rgba(10,10,10,0.7)] border border-skin-base rounded-3xl p-7 md:p-8 shadow-card">
          <div className="text-center mb-7">
            <h2 className="font-display font-black text-2xl text-skin-base mb-1.5 uppercase tracking-tight">
              Get on the next cast
            </h2>
            <p className="text-skin-dim text-sm">
              We&apos;ll email when your cast starts. New cohorts open continuously.
            </p>
          </div>
          <SignupForm turnstileSiteKey={turnstileSiteKey} playtestUrl={playtestUrl} />
        </div>
      </main>

      {/* What you'll do — typographic statement, not iconified card row */}
      <section className="relative py-12 px-6 max-w-md mx-auto text-center">
        <div className="font-display font-black uppercase leading-[0.95] tracking-tight text-skin-base" style={{ fontSize: 'clamp(2rem, 9vw, 3.25rem)' }}>
          <div>Vote.</div>
          <div className="text-skin-pink">Ally.</div>
          <div>Betray.</div>
          <div className="text-skin-pink">Survive.</div>
        </div>
        <p className="text-skin-faint text-xs tracking-wide mt-6">
          5–10 min / day · async · no install required
        </p>
      </section>

      {/* Share */}
      <section className="relative py-8 px-6">
        <ShareButtons playtestUrl={playtestUrl} />
      </section>

      {/* Footer */}
      <footer className="relative py-6 text-center pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <a
          href="https://peckingorder.ca"
          className="text-skin-faint text-xs hover:text-skin-dim transition-colors tracking-wider"
        >
          peckingorder.ca
        </a>
      </footer>
    </div>
  );
}
