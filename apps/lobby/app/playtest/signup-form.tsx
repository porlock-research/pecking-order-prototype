'use client';

import { useState, useRef, useEffect } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { handlePlaytestSignup } from './actions';
import { REFERRAL_SOURCES, REFERRAL_LABELS } from './constants';
import { ShareButtons } from './share-buttons';

const STORAGE_KEY = 'pecking-order-playtest';

export function SignupForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [email, setEmail] = useState('');
  const [referralSource, setReferralSource] = useState('FRIEND');
  const [referralDetail, setReferralDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [turnstileToken, setTurnstileToken] = useState('');

  // Check localStorage for returning users + read ?ref= param
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { referralCode: code } = JSON.parse(stored);
        if (code) setReferralCode(code);
      }
    } catch { /* ignore parse errors */ }

    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) setReferredBy(ref.toUpperCase().slice(0, 10));
  }, []);

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
      referralDetail: (referralSource === 'OTHER' || (referralSource === 'FRIEND' && !referredBy)) ? referralDetail : undefined,
      referredBy: referredBy || undefined,
      turnstileToken,
    });
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      turnstileRef.current?.reset();
      setTurnstileToken('');
    } else if (result.success) {
      if (result.referralCode) {
        setReferralCode(result.referralCode);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ referralCode: result.referralCode }));
        } catch { /* storage full or blocked */ }
      } else {
        // Fallback: success without code (shouldn't happen, but show success anyway)
        setReferralCode('');
      }
    }
  }

  // Returning user or just signed up — show share screen
  if (referralCode !== null) {
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
          <p className="text-skin-dim text-sm">
            We'll reach out when the next playtest is ready.
          </p>
        </div>

        {/* Referral code display */}
        {referralCode && (
          <div className="text-center py-3 bg-skin-deep/40 rounded-xl border border-skin-gold/15">
            <p className="text-[10px] font-bold text-skin-dim uppercase tracking-[0.2em] mb-1.5 font-display">
              Your Referral Code
            </p>
            <p className="text-2xl font-mono font-bold text-skin-gold tracking-[0.3em]">
              {referralCode}
            </p>
          </div>
        )}

        <div className="pt-2 border-t border-skin-base/20">
          <ShareButtons emphasis referralCode={referralCode || undefined} />
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
          <option value="" disabled hidden>
            Select one...
          </option>
          {REFERRAL_SOURCES.map((src) => (
            <option key={src} value={src}>
              {REFERRAL_LABELS[src]}
            </option>
          ))}
        </select>
      </div>

      {referralSource === 'FRIEND' && !referredBy && (
        <div className="space-y-1.5">
          <label
            htmlFor="signup-referral-detail"
            className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display"
          >
            Who referred you?
            <span className="normal-case tracking-normal font-normal text-skin-dim/50 ml-1">optional</span>
          </label>
          <input
            id="signup-referral-detail"
            type="text"
            value={referralDetail}
            onChange={(e) => setReferralDetail(e.target.value)}
            placeholder="Their name or email"
            maxLength={200}
            className="w-full bg-skin-input text-skin-base border border-skin-base rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all text-sm placeholder:text-skin-dim/30"
          />
        </div>
      )}

      {referralSource === 'OTHER' && (
        <div className="space-y-1.5">
          <label
            htmlFor="signup-referral-detail-other"
            className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display"
          >
            Tell us more
          </label>
          <input
            id="signup-referral-detail-other"
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
              : 'bg-skin-gold text-skin-deep shadow-btn btn-press hover:brightness-110 active:scale-[0.99]'
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
