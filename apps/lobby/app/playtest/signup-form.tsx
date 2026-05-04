'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { handlePlaytestSignup, updatePlaytestOptionalFields } from './actions';
import { REFERRAL_SOURCES, REFERRAL_LABELS, MESSAGING_APPS, MESSAGING_LABELS } from './constants';
import { ShareButtons } from './share-buttons';

const STORAGE_KEY = 'pecking-order-playtest';

const inputClass =
  'w-full bg-skin-input text-skin-base border border-skin-base rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-skin-gold/50 focus:border-skin-gold/50 transition-all text-sm placeholder:text-skin-faint';

export function SignupForm({
  turnstileSiteKey,
  playtestUrl,
}: {
  turnstileSiteKey: string;
  playtestUrl: string;
}) {
  // Initial signup
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [turnstileToken, setTurnstileToken] = useState('');

  // UTM attribution captured from URL on mount; sent with signup payload so we
  // can answer "which subreddit / channel converted?" post-blitz.
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmContent, setUtmContent] = useState('');

  // Post-signup state. `null` = haven't signed up yet; '' = signed up (no code returned); 'XXX' = success with code.
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referredBy, setReferredBy] = useState<string | null>(null);
  // Captured at successful submit; used to authorize the optional-fields update call.
  // Empty until/unless the user signs up in the current session.
  const [submittedEmail, setSubmittedEmail] = useState('');

  // Optional post-signup fields
  const [phone, setPhone] = useState('');
  const [messagingApp, setMessagingApp] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [referralDetail, setReferralDetail] = useState('');
  const [optionalIsLoading, setOptionalIsLoading] = useState(false);
  const [optionalSaved, setOptionalSaved] = useState(false);
  const [optionalError, setOptionalError] = useState<string | null>(null);

  // Returning-user check + ?ref= param read
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { referralCode: code } = JSON.parse(stored);
        if (code) setReferralCode(code);
      }
    } catch {
      /* ignore parse errors */
    }

    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) setReferredBy(ref.toUpperCase().slice(0, 10));

    const utmSrc = params.get('utm_source')?.slice(0, 100);
    if (utmSrc) setUtmSource(utmSrc);
    const utmMed = params.get('utm_medium')?.slice(0, 100);
    if (utmMed) setUtmMedium(utmMed);
    const utmCam = params.get('utm_campaign')?.slice(0, 200);
    if (utmCam) setUtmCampaign(utmCam);
    const utmCon = params.get('utm_content')?.slice(0, 200);
    if (utmCon) setUtmContent(utmCon);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await handlePlaytestSignup({
      email,
      referredBy: referredBy || undefined,
      utm_source: utmSource || undefined,
      utm_medium: utmMedium || undefined,
      utm_campaign: utmCampaign || undefined,
      utm_content: utmContent || undefined,
      turnstileToken,
    });

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      turnstileRef.current?.reset();
      setTurnstileToken('');
      return;
    }

    if (result.success) {
      setSubmittedEmail(email);
      const code = result.referralCode || '';
      setReferralCode(code);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ referralCode: code }));
      } catch {
        /* storage full or blocked */
      }
    }
  }

  async function handleOptionalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOptionalError(null);
    setOptionalIsLoading(true);

    const result = await updatePlaytestOptionalFields({
      email: submittedEmail,
      referralCode: referralCode || '',
      phone: phone || undefined,
      messagingApp: messagingApp || undefined,
      referralSource: referralSource || undefined,
      referralDetail: referralDetail || undefined,
    });

    setOptionalIsLoading(false);

    if (result.error) {
      setOptionalError(result.error);
    } else {
      setOptionalSaved(true);
    }
  }

  const hasOptionalInput = !!(phone || messagingApp || referralSource || referralDetail);

  // Returning user OR just signed up — show share screen, plus optional fields if this session.
  if (referralCode !== null) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-skin-green/15 rounded-full flex items-center justify-center mx-auto">
            <svg
              viewBox="0 0 24 24"
              width="32"
              height="32"
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="font-display font-bold text-xl text-skin-green">You&apos;re Cast.</h2>
          <p className="text-skin-dim text-sm">
            We&apos;ll email when your cohort kicks off — bring your strategy.
          </p>
        </div>

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
          <ShareButtons
            emphasis
            referralCode={referralCode || undefined}
            playtestUrl={playtestUrl}
          />
        </div>

        {/* Optional reminders form — only when this session just signed up (we have the email + code in memory) */}
        {submittedEmail && !optionalSaved && (
          <div className="pt-6 border-t border-skin-base/20 space-y-4">
            <div className="text-center space-y-1.5">
              <p className="text-[11px] font-bold text-skin-dim uppercase tracking-widest font-display">
                One more thing — optional
              </p>
              <p className="text-sm text-skin-faint">
                Help us reach you when your cohort starts. All optional, all skippable.
              </p>
            </div>

            <form onSubmit={handleOptionalSubmit} className="space-y-4">
              <FieldRow label="Phone" hint="optional · for SMS reminders">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  maxLength={20}
                  autoComplete="tel"
                  className={inputClass}
                />
              </FieldRow>

              <FieldRow label="Preferred messaging app" hint="optional">
                <select
                  value={messagingApp}
                  onChange={(e) => setMessagingApp(e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="">Select one...</option>
                  {MESSAGING_APPS.map((app) => (
                    <option key={app} value={app}>
                      {MESSAGING_LABELS[app]}
                    </option>
                  ))}
                </select>
              </FieldRow>

              <FieldRow label="How did you hear about us?" hint="optional">
                <select
                  value={referralSource}
                  onChange={(e) => {
                    const next = e.target.value;
                    setReferralSource(next);
                    if (next !== 'FRIEND' && next !== 'OTHER') setReferralDetail('');
                  }}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="">Select one...</option>
                  {REFERRAL_SOURCES.map((src) => (
                    <option key={src} value={src}>
                      {REFERRAL_LABELS[src]}
                    </option>
                  ))}
                </select>
              </FieldRow>

              {referralSource === 'FRIEND' && !referredBy && (
                <FieldRow label="Who referred you?" hint="optional">
                  <input
                    type="text"
                    value={referralDetail}
                    onChange={(e) => setReferralDetail(e.target.value)}
                    placeholder="Their name or email"
                    maxLength={200}
                    className={inputClass}
                  />
                </FieldRow>
              )}

              {referralSource === 'OTHER' && (
                <FieldRow label="Tell us more">
                  <input
                    type="text"
                    value={referralDetail}
                    onChange={(e) => setReferralDetail(e.target.value)}
                    placeholder="Where did you find us?"
                    maxLength={200}
                    className={inputClass}
                  />
                </FieldRow>
              )}

              {optionalError && (
                <div className="p-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm">
                  {optionalError}
                </div>
              )}

              <button
                type="submit"
                disabled={optionalIsLoading || !hasOptionalInput}
                className={`w-full py-3 font-display font-bold text-xs tracking-widest uppercase rounded-xl transition-all ${
                  optionalIsLoading
                    ? 'bg-skin-input text-skin-faint cursor-wait'
                    : !hasOptionalInput
                      ? 'bg-skin-input text-skin-faint cursor-not-allowed'
                      : 'bg-skin-gold/85 text-skin-deep hover:brightness-110 active:scale-[0.99]'
                }`}
              >
                {optionalIsLoading ? 'Saving…' : 'Save'}
              </button>
            </form>
          </div>
        )}

        {optionalSaved && (
          <div className="pt-6 border-t border-skin-base/20 text-center">
            <p className="text-sm text-skin-dim">Thanks — saved.</p>
          </div>
        )}
      </div>
    );
  }

  // Initial: email-only waitlist signup
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
          autoComplete="email"
          className={inputClass}
        />
        <p className="text-[11px] text-skin-faint pl-1 leading-relaxed">
          No spam. Unsubscribe anytime. We only email about playtests.
        </p>
      </div>

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
          options={{ size: 'flexible' }}
        />
      )}

      <button
        type="submit"
        disabled={isLoading || !email || (!!turnstileSiteKey && !turnstileToken)}
        className={`w-full py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-3
          ${
            isLoading
              ? 'bg-skin-input text-skin-faint cursor-wait'
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
          'Reserve My Seat'
        )}
      </button>

      <p className="text-[11px] text-center text-skin-faint leading-relaxed px-2">
        By signing up, you agree to our{' '}
        <Link
          href="/terms"
          className="text-skin-dim hover:text-skin-gold underline-offset-2 hover:underline transition-colors"
        >
          Terms
        </Link>{' '}
        and{' '}
        <Link
          href="/privacy"
          className="text-skin-dim hover:text-skin-gold underline-offset-2 hover:underline transition-colors"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display block">
        {label}
        {hint && (
          <span className="normal-case tracking-normal font-normal text-skin-faint ml-1">
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
