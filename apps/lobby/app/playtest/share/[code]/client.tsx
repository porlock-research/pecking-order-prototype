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
    <div className="min-h-screen bg-skin-deep bg-grid-pattern font-body text-skin-base selection:bg-skin-gold/30 relative overflow-hidden flex items-center justify-center">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[700px] bg-gradient-radial from-skin-panel/60 via-skin-panel/20 to-transparent opacity-80 pointer-events-none" />

      <main className="relative px-5 py-10 max-w-md mx-auto w-full">
        <div className="bg-skin-panel/30 backdrop-blur-sm rounded-3xl p-7 md:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
          <div className="text-center space-y-3 mb-6">
            <h1 className="font-display font-black text-2xl md:text-3xl text-skin-gold tracking-tight text-glow">
              PECKING ORDER
            </h1>
            <p className="text-skin-dim text-sm font-display">
              Share your link to recruit players for the next playtest.
            </p>
          </div>

          {/* Referral code display */}
          <div className="text-center py-3 mb-6 bg-skin-deep/40 rounded-xl border border-skin-gold/15">
            <p className="text-[10px] font-bold text-skin-dim uppercase tracking-[0.2em] mb-1.5 font-display">
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
            className="text-skin-dim/30 text-xs hover:text-skin-dim transition-colors font-mono tracking-wider"
          >
            peckingorder.ca
          </a>
        </footer>
      </main>
    </div>
  );
}
