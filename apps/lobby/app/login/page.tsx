'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { requestMagicLink } from './actions';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';
  const [email, setEmail] = useState('');
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function isLikelyEmail(value: string): boolean {
    // Loose validation — server-side enforces the real rules. This is just
    // enough to keep "tap the button to find out what's wrong" honest.
    return /^\S+@\S+\.\S+$/.test(value.trim());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMagicLink(null);
    setEmailSent(false);

    if (!isLikelyEmail(email)) {
      setError('That email looks off. Double-check and try again.');
      return;
    }

    setIsLoading(true);
    const result = await requestMagicLink(email, next);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.sent) {
      setEmailSent(true);
    } else if (result.link) {
      setMagicLink(result.link);
    }
  }

  function handleReset() {
    setMagicLink(null);
    setEmailSent(false);
    setEmail('');
    setError(null);
  }

  return (
    <div className="bg-skin-deep/70 border border-skin-base rounded-3xl p-7 sm:p-8 shadow-card space-y-6">

      {!magicLink && !emailSent ? (
        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="space-y-3">
            <label htmlFor="email" className="block text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@example.com"
              className="w-full bg-skin-input text-skin-base border border-skin-base rounded-xl px-5 py-4 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all text-base placeholder:text-skin-faint"
            />
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading}
            className={`group w-full py-5 font-display font-bold text-sm tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-3 relative overflow-hidden
              ${isLoading
                ? 'bg-skin-input text-skin-faint cursor-wait'
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
      ) : emailSent ? (
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-skin-green font-display font-bold text-sm uppercase tracking-widest">
              Check Your Email
            </h2>
            <p className="text-skin-dim text-sm">
              We sent a login link to <span className="text-skin-base font-bold">{email}</span>
            </p>
            <p className="text-skin-faint text-xs">
              Check your inbox (and spam folder). The link expires in 5 minutes.
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="block w-full py-3 text-center text-skin-dim text-xs hover:text-skin-base transition-colors disabled:opacity-40 underline-offset-4 hover:underline"
          >
            {isLoading ? 'Sending…' : "Didn't receive it? Resend"}
          </button>

          <button
            onClick={handleReset}
            className="w-full py-3 text-center text-skin-dim text-xs hover:text-skin-base transition-colors underline-offset-4 hover:underline"
          >
            Try different email
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <h2 className="text-skin-green font-display font-bold text-sm uppercase tracking-widest">
              Link Generated
            </h2>
            <p className="text-skin-dim text-sm">
              In production this would be emailed. For now, click below:
            </p>
          </div>

          <a
            href={magicLink!}
            className="block w-full py-4 text-center bg-skin-green/10 text-skin-green border border-skin-green/30 rounded-xl font-display font-bold uppercase tracking-widest text-sm hover:bg-skin-green/20 transition-all"
          >
            Click to Sign In
          </a>

          <button
            onClick={handleReset}
            className="w-full py-3 text-center text-skin-dim text-xs hover:text-skin-base transition-colors underline-offset-4 hover:underline"
          >
            Try different email
          </button>
        </div>
      )}

    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh bg-skin-deep bg-grid-pattern flex flex-col items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] font-body text-skin-base relative selection:bg-skin-gold/30">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-skin-panel/40 to-transparent opacity-60 pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        <header className="text-center mb-10 sm:mb-12 space-y-4">
          <h1 className="font-display font-black tracking-tighter text-skin-gold text-glow leading-[0.9]" style={{ fontSize: 'clamp(2.5rem, 11vw, 4rem)' }}>
            PECKING ORDER
          </h1>
          <p className="text-lg text-skin-dim font-light tracking-wide">
            Sign in to continue
          </p>
        </header>

        <Suspense fallback={
          <div className="bg-skin-deep/70 border border-skin-base rounded-3xl p-8 flex items-center justify-center shadow-card">
            <span className="text-skin-faint text-sm">Pulling your session…</span>
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
