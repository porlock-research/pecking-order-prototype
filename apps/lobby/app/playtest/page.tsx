import { getDB, getEnv } from '@/lib/db';
import { Vote, Handshake, Sword, Crown } from 'lucide-react';
import { SignupForm } from './signup-form';
import { ShareButtons } from './share-buttons';

interface Persona {
  id: string;
  name: string;
  stereotype: string;
}

async function getRandomPersonas(count: number): Promise<Persona[]> {
  try {
    const db = await getDB();
    const { results } = await db
      .prepare(
        'SELECT id, name, stereotype FROM PersonaPool ORDER BY RANDOM() LIMIT ?',
      )
      .bind(count)
      .all<Persona>();
    return results;
  } catch {
    return [];
  }
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
      className={`relative overflow-hidden flex-shrink-0 transition-transform ${
        featured
          ? 'w-36 h-48 md:w-44 md:h-56 rounded-2xl ring-2 ring-skin-gold/50 shadow-[0_0_30px_rgba(251,191,36,0.2)]'
          : 'w-24 h-32 md:w-28 md:h-36 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)]'
      }`}
    >
      <img
        src={imgSrc}
        alt={persona.name}
        width={featured ? 176 : 112}
        height={featured ? 224 : 144}
        className="absolute inset-0 w-full h-full object-cover object-top"
        loading="eager"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 via-40% to-transparent" />
      <div className="absolute bottom-2.5 left-2.5 right-2.5">
        <p
          className={`font-display font-bold text-white leading-tight drop-shadow-lg ${
            featured ? 'text-sm' : 'text-[11px]'
          }`}
        >
          {persona.name}
        </p>
        {featured && (
          <p className="text-skin-gold text-[10px] font-semibold uppercase tracking-wider mt-0.5 drop-shadow">
            {persona.stereotype}
          </p>
        )}
      </div>
    </div>
  );
}

function TeaserBadge({ Icon, label }: { Icon: typeof Vote; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-12 h-12 rounded-full bg-skin-panel/80 border border-skin-gold/20 flex items-center justify-center shadow-[0_0_15px_rgba(251,191,36,0.1)]">
        <Icon size={20} className="text-skin-gold" strokeWidth={1.5} />
      </div>
      <span className="text-skin-dim text-[11px] font-semibold uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

export default async function PlaytestPage() {
  const [personas, env] = await Promise.all([
    getRandomPersonas(5),
    getEnv(),
  ]);

  const assetsUrl = (env.PERSONA_ASSETS_URL as string) || '';
  const turnstileSiteKey = (env.TURNSTILE_SITE_KEY as string) || '';

  return (
    <div className="min-h-screen bg-skin-deep bg-grid-pattern font-body text-skin-base selection:bg-skin-gold/30 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-skin-panel/60 via-skin-panel/20 to-transparent opacity-80 pointer-events-none" />

      {/* Hero */}
      <header className="relative pt-10 pb-6 px-6 text-center">
        {personas.length >= 3 && (
          <div className="flex justify-center items-end gap-3 md:gap-4 mb-10">
            <div className="-rotate-6 translate-y-3 hover:-translate-y-0 transition-transform duration-300">
              <PersonaCard persona={personas[0]} assetsUrl={assetsUrl} />
            </div>
            <div className="z-10 -translate-y-1 hover:-translate-y-3 transition-transform duration-300">
              <PersonaCard persona={personas[2]} assetsUrl={assetsUrl} featured />
            </div>
            <div className="rotate-6 translate-y-3 hover:-translate-y-0 transition-transform duration-300">
              <PersonaCard persona={personas[1]} assetsUrl={assetsUrl} />
            </div>
          </div>
        )}

        <h1 className="font-display font-black text-4xl md:text-6xl text-skin-gold tracking-tight text-glow mb-3">
          PECKING ORDER
        </h1>
        <p className="text-skin-dim text-sm md:text-lg font-light tracking-wide mb-5 max-w-md mx-auto">
          A social game of alliances, betrayal & strategy
        </p>
        <span className="inline-block bg-skin-gold/10 border border-skin-gold/30 rounded-full px-5 py-2 text-skin-gold text-xs font-bold uppercase tracking-[0.2em] animate-pulse-live">
          Playtesting Now
        </span>
      </header>

      {/* Form Card */}
      <main className="relative px-6 py-10 max-w-md mx-auto">
        <div className="bg-skin-panel/20 backdrop-blur-md border border-skin-base/20 rounded-3xl p-1 shadow-card">
          <div className="bg-skin-deep/70 rounded-[20px] p-7 md:p-8 border border-skin-base/10">
            <div className="text-center mb-7">
              <h2 className="font-display font-bold text-xl text-skin-base mb-1.5">
                Join the Next Playtest
              </h2>
              <p className="text-skin-dim text-sm">
                Be the first to know when we're ready for you.
              </p>
            </div>
            <SignupForm turnstileSiteKey={turnstileSiteKey} />
          </div>
        </div>
      </main>

      {/* Teaser Strip */}
      <section className="relative py-10 px-6">
        <div className="flex gap-8 md:gap-12 justify-center mb-4">
          <TeaserBadge Icon={Vote} label="Vote" />
          <TeaserBadge Icon={Handshake} label="Ally" />
          <TeaserBadge Icon={Sword} label="Betray" />
          <TeaserBadge Icon={Crown} label="Survive" />
        </div>
        <p className="text-center text-skin-dim/40 text-xs tracking-wide">
          Play from your phone. Games run over multiple days.
        </p>
      </section>

      {/* Share */}
      <section className="relative py-8 px-6 border-t border-skin-base/10">
        <ShareButtons />
      </section>

      {/* Footer */}
      <footer className="relative py-6 text-center">
        <a
          href="https://peckingorder.ca"
          className="text-skin-dim/30 text-xs hover:text-skin-dim transition-colors font-mono tracking-wider"
        >
          peckingorder.ca
        </a>
      </footer>
    </div>
  );
}
