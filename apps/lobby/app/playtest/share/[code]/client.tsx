'use client';

import { useEffect } from 'react';
import { ShareButtons } from '../../share-buttons';

const STORAGE_KEY = 'pecking-order-playtest';

export function SharePageClient({ code, playtestUrl }: { code: string; playtestUrl: string }) {
  const referralCode = code?.toUpperCase() || '';

  // Persist to localStorage so returning to /playtest shows share screen
  useEffect(() => {
    if (referralCode) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ referralCode }));
      } catch { /* storage full or blocked */ }
    }
  }, [referralCode]);

  return (
    <div className="min-h-dvh bg-skin-deep bg-grid-pattern font-body text-skin-base selection:bg-[rgba(215,38,56,0.3)] relative overflow-hidden flex items-center justify-center pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-gradient-radial from-[rgba(19,19,19,0.6)] via-[rgba(19,19,19,0.2)] to-transparent opacity-80 pointer-events-none" />

      <main className="relative px-5 py-10 max-w-md mx-auto w-full">
        <div className="bg-[rgba(10,10,10,0.7)] border border-skin-base rounded-3xl p-7 md:p-8 shadow-card">
          <div className="text-center space-y-3 mb-6">
            <h1 className="font-display font-black text-2xl md:text-3xl text-skin-base tracking-tight">
              PECKING ORDER
            </h1>
            <p className="text-skin-dim text-sm">
              Share your link to recruit players for the next playtest.
            </p>
          </div>

          {/* Brand verb-stack — same mantra as /playtest hero, gives the share
              surface its own typographic anchor instead of just listing chrome. */}
          <div className="text-center mb-6 font-display font-black uppercase leading-[0.95] tracking-tight" style={{ fontSize: 'clamp(1.75rem, 8vw, 2.5rem)' }}>
            <div className="text-skin-base">Vote.</div>
            <div className="text-skin-pink">Ally.</div>
            <div className="text-skin-base">Betray.</div>
            <div className="text-skin-pink">Survive.</div>
          </div>

          {/* Referral code display — mono is the right call here, this IS a code */}
          <div className="text-center py-3 mb-6 bg-[rgba(10,10,10,0.4)] rounded-xl border border-[rgba(215,38,56,0.15)]">
            <p className="text-[10px] font-display font-bold text-skin-dim uppercase tracking-[0.2em] mb-1.5">
              Your Referral Code
            </p>
            <p className="text-2xl font-mono font-bold text-skin-gold tracking-[0.3em]">
              {referralCode}
            </p>
          </div>

          <ShareButtons emphasis referralCode={referralCode} playtestUrl={playtestUrl} />
        </div>

        <footer className="mt-8 text-center">
          <a
            href="https://peckingorder.ca"
            className="text-skin-faint text-xs hover:text-skin-dim transition-colors tracking-wider"
          >
            peckingorder.ca
          </a>
        </footer>
      </main>
    </div>
  );
}
