import { getDB, getEnv } from '@/lib/db';
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

function PersonaCard({ persona, assetsUrl }: { persona: Persona; assetsUrl: string }) {
  const imgSrc = assetsUrl
    ? `${assetsUrl}/personas/${persona.id}/headshot.png`
    : `/api/persona-image/${persona.id}/headshot.png`;

  return (
    <div className="w-20 h-24 rounded-xl overflow-hidden border border-skin-base/30 shadow-lg flex-shrink-0">
      <img
        src={imgSrc}
        alt={persona.name}
        width={80}
        height={96}
        className="w-full h-full object-cover"
        loading="eager"
      />
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
    <div className="min-h-screen bg-skin-deep font-body text-skin-base selection:bg-skin-gold/30">
      {/* Hero */}
      <header className="bg-gradient-to-b from-skin-deep to-skin-panel pt-10 pb-8 px-6 text-center">
        {personas.length > 0 && (
          <div className="flex justify-center gap-2 mb-6">
            {personas.slice(0, 3).map((p, i) => (
              <div
                key={p.id}
                className={
                  i === 1
                    ? '-translate-y-2'
                    : i === 0
                      ? '-rotate-3'
                      : 'rotate-3'
                }
              >
                <PersonaCard persona={p} assetsUrl={assetsUrl} />
              </div>
            ))}
          </div>
        )}

        <h1 className="font-display font-black text-3xl md:text-5xl text-skin-gold tracking-tight text-glow mb-2">
          PECKING ORDER
        </h1>
        <p className="text-skin-dim text-sm md:text-base font-light tracking-wide mb-4">
          A social game of alliances, betrayal & strategy
        </p>
        <span className="inline-block bg-skin-gold/15 border border-skin-gold/30 rounded-full px-4 py-1.5 text-skin-gold text-xs font-semibold uppercase tracking-widest">
          Playtesting Now
        </span>
      </header>

      {/* Form */}
      <main className="px-6 py-8 max-w-md mx-auto">
        <div className="text-center mb-6">
          <h2 className="font-display font-bold text-lg text-skin-base mb-1">
            Join the Next Playtest
          </h2>
          <p className="text-skin-dim text-sm">
            Be the first to know when we're ready for you.
          </p>
        </div>

        <SignupForm turnstileSiteKey={turnstileSiteKey} />
      </main>

      {/* Teaser Strip */}
      <section className="bg-skin-panel/60 py-6 px-6">
        <div className="flex gap-6 justify-center mb-3">
          {[
            { icon: '\u{1F5F3}\uFE0F', label: 'Vote' },
            { icon: '\u{1F91D}', label: 'Ally' },
            { icon: '\u{1F5E1}\uFE0F', label: 'Betray' },
            { icon: '\u{1F451}', label: 'Survive' },
          ].map(({ icon, label }) => (
            <div key={label} className="text-center">
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-skin-dim text-xs font-medium">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-center text-skin-dim/50 text-xs">
          Play from your phone. Games run over multiple days.
        </p>
      </section>

      {/* Share */}
      <section className="py-6 px-6 border-t border-skin-base/10">
        <ShareButtons />
      </section>

      {/* Footer */}
      <footer className="bg-skin-deep/80 py-5 text-center">
        <a
          href="https://peckingorder.ca"
          className="text-skin-dim/40 text-xs hover:text-skin-dim transition-colors"
        >
          peckingorder.ca
        </a>
      </footer>
    </div>
  );
}
