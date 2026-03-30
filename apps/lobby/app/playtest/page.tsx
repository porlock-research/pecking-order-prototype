import { getDB, getEnv } from '@/lib/db';
import { Vote, Handshake, Sword, Crown } from 'lucide-react';
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

function TeaserBadge({ Icon, label }: { Icon: typeof Vote; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-14 h-14 rounded-full bg-skin-gold/10 flex items-center justify-center">
        <Icon size={24} className="text-skin-gold" strokeWidth={1.5} />
      </div>
      <span className="text-skin-dim text-[11px] font-bold uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

export default async function PlaytestPage() {
  const [personas, env] = await Promise.all([
    getRandomPersonas(7),
    getEnv(),
  ]);

  const assetsUrl = (env.PERSONA_ASSETS_URL as string) || '';
  const turnstileSiteKey = (env.TURNSTILE_SITE_KEY as string) || '';

  return (
    <div className="min-h-screen bg-skin-deep bg-grid-pattern font-body text-skin-base selection:bg-skin-gold/30 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-gradient-radial from-skin-panel/60 via-skin-panel/20 to-transparent opacity-80 pointer-events-none" />

      {/* Hero */}
      <header className="relative pt-8 pb-2 px-4 text-center">
        <h1 className="font-display font-black text-4xl md:text-6xl text-skin-gold tracking-tight text-glow mb-2">
          PECKING ORDER
        </h1>
        <p className="text-skin-dim text-base md:text-lg font-display font-light tracking-wide mb-4 max-w-sm mx-auto">
          A social game of alliances, betrayal & strategy
        </p>
        <span className="inline-block bg-skin-gold/10 rounded-full px-5 py-2 text-skin-gold text-xs font-bold uppercase tracking-[0.2em] animate-pulse-live mb-8">
          Playtesting Now
        </span>

        {/* Persona Carousel */}
        {personas.length > 0 && (
          <div className="max-w-sm mx-auto px-6">
            <PersonaCarousel personas={personas} assetsUrl={assetsUrl} />
          </div>
        )}
      </header>

      {/* Form */}
      <main className="relative px-5 py-10 max-w-md mx-auto">
        <div className="bg-skin-panel/30 backdrop-blur-sm rounded-3xl p-7 md:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
          <div className="text-center mb-7">
            <h2 className="font-display font-bold text-xl text-skin-base mb-1.5">
              Join the Next Playtest
            </h2>
            <p className="text-skin-dim text-sm font-display">
              Be the first to know when we're ready for you.
            </p>
          </div>
          <SignupForm turnstileSiteKey={turnstileSiteKey} />
        </div>
      </main>

      {/* Teaser Strip */}
      <section className="relative py-10 px-6">
        <div className="flex gap-6 md:gap-10 justify-center mb-4">
          <TeaserBadge Icon={Vote} label="Vote" />
          <TeaserBadge Icon={Handshake} label="Ally" />
          <TeaserBadge Icon={Sword} label="Betray" />
          <TeaserBadge Icon={Crown} label="Survive" />
        </div>
        <p className="text-center text-skin-dim/40 text-xs tracking-wide font-display">
          Play from your phone. Games run over multiple days.
        </p>
      </section>

      {/* Share */}
      <section className="relative py-8 px-6">
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
