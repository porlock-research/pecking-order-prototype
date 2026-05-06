'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';

type SupportState =
  | { kind: 'checking' }
  | { kind: 'supported' }
  | { kind: 'unsupported'; reason: UnsupportedReason };

type UnsupportedReason =
  | 'brave-ios'
  | 'firefox-ios'
  | 'edge-ios'
  | 'no-push-manager'
  | 'no-service-worker'
  | 'brave-desktop';

async function detectSupport(): Promise<SupportState> {
  if (typeof window === 'undefined') return { kind: 'checking' };

  if (!('serviceWorker' in navigator)) {
    return { kind: 'unsupported', reason: 'no-service-worker' };
  }
  if (!('PushManager' in window)) {
    return { kind: 'unsupported', reason: 'no-push-manager' };
  }

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);

  let isBrave = false;
  try {
    const result = await (
      navigator as { brave?: { isBrave?: () => Promise<boolean> } }
    ).brave?.isBrave?.();
    isBrave = !!result;
  } catch {
    // navigator.brave not present → not Brave
  }

  // iOS non-Safari/Chrome: WebKit but A2HS+push unreliable through these browsers
  if (isIOS && isBrave) return { kind: 'unsupported', reason: 'brave-ios' };
  if (isIOS && /FxiOS/.test(ua)) return { kind: 'unsupported', reason: 'firefox-ios' };
  if (isIOS && /EdgiOS/.test(ua)) return { kind: 'unsupported', reason: 'edge-ios' };

  // Brave Desktop / Brave Android: requires user-toggling Brave's push setting AND OS-level perms
  if (isBrave) return { kind: 'unsupported', reason: 'brave-desktop' };

  return { kind: 'supported' };
}

function getReasonCopy(reason: UnsupportedReason): { title: string; body: string; primary: string; details?: string[] } {
  switch (reason) {
    case 'brave-ios':
      return {
        title: 'Brave on iOS isn’t supported',
        body: 'Pecking Order uses push notifications to tell you when it’s your turn to vote, when DMs arrive, and when game events drop. Brave on iOS doesn’t reliably support that.',
        primary: 'Open this invite in Safari',
        details: ['Tap the link below to copy it', 'Open Safari', 'Paste the link in the address bar'],
      };
    case 'firefox-ios':
      return {
        title: 'Firefox on iOS isn’t supported',
        body: 'Firefox on iOS doesn’t support push notifications, which Pecking Order needs for game events. Open this invite in Safari instead.',
        primary: 'Open this invite in Safari',
      };
    case 'edge-ios':
      return {
        title: 'Edge on iOS isn’t supported',
        body: 'Edge on iOS doesn’t reliably support the push notifications Pecking Order needs. Open this invite in Safari instead.',
        primary: 'Open this invite in Safari',
      };
    case 'brave-desktop':
      return {
        title: 'Brave needs extra setup',
        body: 'Brave blocks push notifications by default. Pecking Order needs them so you don’t miss votes, DMs, and game events. Easiest path: open this invite in Chrome, Safari, or Firefox.',
        primary: 'Copy invite link',
        details: [
          'Or to stay on Brave: open brave://settings/privacy → enable “Use Google services for push messaging”',
          'Then enable Brave in your OS notification settings',
          'Restart Brave and reload this page',
        ],
      };
    case 'no-push-manager':
    case 'no-service-worker':
      return {
        title: 'This browser can’t run Pecking Order',
        body: 'Pecking Order needs notifications and offline support that this browser doesn’t provide. Open this invite in a recent version of Chrome, Safari, Firefox, or Edge.',
        primary: 'Copy invite link',
      };
  }
}

interface Props {
  children: ReactNode;
}

export function BrowserSupportGate({ children }: Props) {
  const [state, setState] = useState<SupportState>({ kind: 'checking' });
  const [override, setOverride] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await detectSupport();
      if (!cancelled) setState(result);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('[BrowserSupportGate] clipboard write failed:', err);
    }
  }, []);

  // Render children optimistically while detecting (avoids flash for the common case).
  // Only swap to the warning UI if detection completes and finds an unsupported browser.
  if (state.kind === 'unsupported' && !override) {
    const copy = getReasonCopy(state.reason);
    return (
      <div className="min-h-dvh flex items-center justify-center bg-skin-deep px-5 py-8">
        <div className="relative w-full max-w-md space-y-6 text-center">
          <div className="space-y-3">
            <p className="text-[10px] font-display font-bold text-skin-gold uppercase tracking-[0.3em]">
              Pecking Order
            </p>
            <h1 className="font-display font-black text-skin-base leading-[1.05] text-2xl sm:text-3xl">
              {copy.title}
            </h1>
            <p className="text-sm text-skin-dim leading-relaxed">{copy.body}</p>
          </div>

          {copy.details && copy.details.length > 0 && (
            <ol className="text-xs text-[rgba(168,163,156,0.8)] bg-[rgba(10,10,10,0.5)] border border-white/10 rounded-lg px-4 py-3 space-y-1.5 text-left list-decimal list-inside">
              {copy.details.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleCopyLink}
              className="w-full max-w-xs px-6 py-3.5 rounded-xl bg-skin-pink text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-[rgba(215,38,56,0.2)] active:scale-[0.97] transition-transform"
            >
              {copied ? 'Link copied' : copy.primary}
            </button>
            <button
              onClick={() => setOverride(true)}
              className="text-xs text-[rgba(168,163,156,0.6)] hover:text-skin-dim transition-colors underline underline-offset-2"
            >
              Continue anyway (you may miss notifications)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
