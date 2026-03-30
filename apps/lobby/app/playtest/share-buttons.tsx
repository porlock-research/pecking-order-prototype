'use client';

import { useState } from 'react';

const PLAYTEST_URL = 'https://playtest.peckingorder.ca';
const SHARE_TEXT =
  'Check out Pecking Order — a social game of alliances, betrayal & strategy. Sign up for the next playtest!';

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function ShareButtons({ emphasis = false }: { emphasis?: boolean }) {
  const [copiedBtn, setCopiedBtn] = useState<'discord' | 'link' | null>(null);

  function shareTwitter() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(PLAYTEST_URL)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function shareDiscord() {
    navigator.clipboard.writeText(`${SHARE_TEXT}\n${PLAYTEST_URL}`);
    setCopiedBtn('discord');
    setTimeout(() => setCopiedBtn(null), 2000);
  }

  function copyLink() {
    navigator.clipboard.writeText(PLAYTEST_URL);
    setCopiedBtn('link');
    setTimeout(() => setCopiedBtn(null), 2000);
  }

  const btnBase = emphasis
    ? 'rounded-xl px-5 py-3 text-sm font-bold'
    : 'rounded-lg px-4 py-2.5 text-xs font-semibold';

  return (
    <div className="text-center">
      {emphasis ? (
        <>
          <p className="text-skin-gold font-display font-bold text-base mb-1">
            Help us find more players!
          </p>
          <p className="text-skin-dim text-sm mb-4">
            The more players, the better the game.
          </p>
        </>
      ) : (
        <p className="text-skin-dim text-sm mb-3">Know someone who'd play?</p>
      )}
      <div className="flex gap-3 justify-center">
        <button
          onClick={shareTwitter}
          className={`${btnBase} bg-skin-input text-skin-dim hover:text-skin-base transition-colors flex items-center gap-2`}
        >
          <TwitterIcon />
          Twitter
        </button>
        <button
          onClick={shareDiscord}
          className={`${btnBase} bg-[#5865F2] text-white hover:brightness-110 transition-all flex items-center gap-2`}
        >
          <DiscordIcon />
          {copiedBtn === 'discord' ? 'Copied!' : 'Discord'}
        </button>
        <button
          onClick={copyLink}
          className={`${btnBase} bg-skin-input text-skin-dim hover:text-skin-base transition-colors flex items-center gap-2`}
        >
          <LinkIcon />
          {copiedBtn === 'link' ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
