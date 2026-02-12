'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { requestMagicLink } from './actions';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const [email, setEmail] = useState('');
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMagicLink(null);
    setIsLoading(true);

    const result = await requestMagicLink(email, next);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.link) {
      setMagicLink(result.link);
    }
  }

  return (
    <div className="min-h-screen bg-skin-deep bg-grid-pattern flex flex-col items-center justify-center p-4 font-body text-skin-base relative selection:bg-skin-gold/30">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-skin-panel/40 to-transparent opacity-60 pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        <header className="text-center mb-12 space-y-4">
          <h1 className="text-5xl md:text-6xl font-display font-black tracking-tighter text-skin-gold mb-2 text-glow">
            PECKING ORDER
          </h1>
          <p className="text-lg text-skin-dim font-light tracking-wide">
            Sign in to continue
          </p>
        </header>

        <div className="bg-skin-panel/30 backdrop-blur-md border border-skin-base p-1 rounded-3xl shadow-card overflow-hidden">
          <div className="bg-skin-deep/60 rounded-[20px] p-8 border border-skin-base space-y-6">

            {!magicLink ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label htmlFor="email" className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="player@example.com"
                    required
                    className="w-full bg-skin-input text-skin-base border border-skin-base rounded-xl px-5 py-4 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all font-mono text-sm placeholder:text-skin-dim/30"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm font-mono">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className={`group w-full py-5 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transform transition-all flex items-center justify-center gap-3 relative overflow-hidden
                    ${isLoading
                      ? 'bg-skin-input text-skin-dim/40 cursor-wait'
                      : 'bg-skin-pink text-skin-base shadow-btn btn-press hover:brightness-110 active:scale-[0.99]'
                    }`}
                >
                  {isLoading ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-75"></span>
                      <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce delay-150"></span>
                    </>
                  ) : (
                    <>Send Magic Link</>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="text-skin-green font-display font-bold text-sm uppercase tracking-widest">
                    Link Generated
                  </div>
                  <p className="text-skin-dim text-sm">
                    In production this would be emailed. For now, click below:
                  </p>
                </div>

                <a
                  href={magicLink}
                  className="block w-full py-4 text-center bg-skin-green/10 text-skin-green border border-skin-green/30 rounded-xl font-mono text-sm hover:bg-skin-green/20 transition-all"
                >
                  Click to Sign In
                </a>

                <button
                  onClick={() => { setMagicLink(null); setEmail(''); }}
                  className="w-full py-3 text-center text-skin-dim text-xs font-mono hover:text-skin-base transition-colors"
                >
                  Try different email
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
