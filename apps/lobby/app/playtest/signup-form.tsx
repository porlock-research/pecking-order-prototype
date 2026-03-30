'use client';

import { useState, useRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { handlePlaytestSignup } from './actions';
import { REFERRAL_SOURCES, REFERRAL_LABELS } from './constants';
import { ShareButtons } from './share-buttons';

export function SignupForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [email, setEmail] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [referralDetail, setReferralDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [turnstileToken, setTurnstileToken] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!turnstileToken && turnstileSiteKey) {
      setError('Please wait for verification to complete.');
      return;
    }

    setIsLoading(true);
    const result = await handlePlaytestSignup({
      email,
      referralSource,
      referralDetail: referralSource === 'OTHER' ? referralDetail : undefined,
      turnstileToken,
    });
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      turnstileRef.current?.reset();
      setTurnstileToken('');
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-skin-green/15 rounded-full flex items-center justify-center mx-auto">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="font-display font-bold text-xl text-skin-green">
            You're In!
          </h2>
          <p className="text-skin-dim text-sm">Check your inbox for a confirmation.</p>
          <p className="text-skin-dim/60 text-xs">
            We'll reach out when the next playtest is ready.
          </p>
        </div>
        <div className="pt-2 border-t border-skin-base/20">
          <ShareButtons emphasis />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label
          htmlFor="signup-email"
          className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display"
        >
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full bg-skin-input text-skin-base border border-skin-base rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all text-sm placeholder:text-skin-dim/30"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="signup-referral"
          className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display"
        >
          How did you hear about us?
        </label>
        <select
          id="signup-referral"
          value={referralSource}
          onChange={(e) => setReferralSource(e.target.value)}
          required
          className="w-full bg-skin-input text-skin-base border border-skin-base rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all text-sm appearance-none"
        >
          <option value="" disabled>
            Select one...
          </option>
          {REFERRAL_SOURCES.map((src) => (
            <option key={src} value={src}>
              {REFERRAL_LABELS[src]}
            </option>
          ))}
        </select>
      </div>

      {referralSource === 'OTHER' && (
        <div className="space-y-1.5">
          <label
            htmlFor="signup-referral-detail"
            className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display"
          >
            Tell us more
          </label>
          <input
            id="signup-referral-detail"
            type="text"
            value={referralDetail}
            onChange={(e) => setReferralDetail(e.target.value)}
            placeholder="Where did you find us?"
            maxLength={200}
            className="w-full bg-skin-input text-skin-base border border-skin-base rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all text-sm placeholder:text-skin-dim/30"
          />
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm">
          {error}
        </div>
      )}

      {turnstileSiteKey && (
        <Turnstile
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          onSuccess={setTurnstileToken}
          onError={() => setTurnstileToken('')}
          onExpire={() => setTurnstileToken('')}
          options={{ size: 'invisible' }}
        />
      )}

      <button
        type="submit"
        disabled={isLoading || !email || !referralSource}
        className={`w-full py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-3
          ${
            isLoading
              ? 'bg-skin-input text-skin-dim/40 cursor-wait'
              : 'bg-gradient-to-r from-skin-gold to-yellow-500 text-skin-deep shadow-btn btn-press hover:brightness-110 active:scale-[0.99]'
          }`}
      >
        {isLoading ? (
          <>
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:75ms]" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
          </>
        ) : (
          'Sign Me Up'
        )}
      </button>
    </form>
  );
}
