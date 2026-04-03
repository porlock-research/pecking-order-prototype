'use client';

import { useState } from 'react';

const SHARE_TEXT =
  'Check out Pecking Order — a social game of alliances, betrayal & strategy. Sign up for the next playtest!';

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function RedditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function ShareButtons({ emphasis = false, referralCode, playtestUrl }: { emphasis?: boolean; referralCode?: string; playtestUrl: string }) {
  const [copiedBtn, setCopiedBtn] = useState<'discord' | 'link' | null>(null);

  const shareUrl = referralCode ? `${playtestUrl}?ref=${referralCode}` : playtestUrl;

  function shareTwitter() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function shareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT}\n${shareUrl}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function shareReddit() {
    const url = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent('Pecking Order — A social game of alliances, betrayal & strategy')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function shareDiscord() {
    navigator.clipboard.writeText(
      `**Pecking Order** — A social game of alliances, betrayal & strategy\nSign up for the next playtest:\n${shareUrl}`,
    );
    setCopiedBtn('discord');
    setTimeout(() => setCopiedBtn(null), 2000);
  }

  function shareEmail() {
    const subject = encodeURIComponent('Check out Pecking Order');
    const body = encodeURIComponent(`${SHARE_TEXT}\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopiedBtn('link');
    setTimeout(() => setCopiedBtn(null), 2000);
  }

  const circleSize = emphasis ? 'w-12 h-12' : 'w-11 h-11';

  return (
    <div className="text-center">
      {emphasis ? (
        <>
          <p className="text-skin-gold font-display font-bold text-lg mb-1">
            Spread the word!
          </p>
          <p className="text-skin-dim text-sm font-display mb-5">
            Pecking Order is better with friends...or enemies.
          </p>
        </>
      ) : (
        <p className="text-skin-dim text-sm font-display mb-4">
          Pecking Order is better with friends...or enemies.
        </p>
      )}
      <div className="flex gap-3 justify-center items-center">
        <button
          onClick={shareTwitter}
          aria-label="Share on Twitter"
          className={`${circleSize} rounded-full bg-skin-panel/60 text-skin-dim hover:text-white hover:bg-skin-base/20 transition-all flex items-center justify-center hover:scale-110`}
        >
          <TwitterIcon />
        </button>
        <button
          onClick={shareWhatsApp}
          aria-label="Share on WhatsApp"
          className={`${circleSize} rounded-full bg-[#25D366] text-white hover:brightness-110 transition-all flex items-center justify-center hover:scale-110`}
        >
          <WhatsAppIcon />
        </button>
        <button
          onClick={shareDiscord}
          aria-label="Share on Discord"
          className={`${circleSize} rounded-full bg-[#5865F2] text-white hover:brightness-110 transition-all flex items-center justify-center hover:scale-110 relative`}
        >
          {copiedBtn === 'discord' ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <DiscordIcon />
          )}
        </button>
        <button
          onClick={shareReddit}
          aria-label="Share on Reddit"
          className={`${circleSize} rounded-full bg-[#FF4500] text-white hover:brightness-110 transition-all flex items-center justify-center hover:scale-110`}
        >
          <RedditIcon />
        </button>
        <button
          onClick={shareEmail}
          aria-label="Share via email"
          className={`${circleSize} rounded-full bg-skin-panel/60 text-skin-dim hover:text-white hover:bg-skin-base/20 transition-all flex items-center justify-center hover:scale-110`}
        >
          <EmailIcon />
        </button>
        <button
          onClick={copyLink}
          aria-label="Copy link"
          className={`${circleSize} rounded-full bg-skin-panel/60 text-skin-dim hover:text-white hover:bg-skin-base/20 transition-all flex items-center justify-center hover:scale-110`}
        >
          {copiedBtn === 'link' ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <LinkIcon />
          )}
        </button>
      </div>
    </div>
  );
}
