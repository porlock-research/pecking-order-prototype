import { useState } from 'react';
import { X, Download, Share, Globe, ArrowRight } from 'lucide-react';

const DISMISS_KEY = 'po_a2hs_dismissed';

type Platform = 'ios-safari' | 'ios-chrome' | 'android' | 'other' | null;

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isCriOS = /CriOS/.test(ua);
  const isStandalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone;

  if (isStandalone) return null;

  const isMobile = navigator.maxTouchPoints > 0 && window.innerWidth < 1024;
  if (!isMobile) return null;

  if (isIOS && isCriOS) return 'ios-chrome';
  if (isIOS) return 'ios-safari';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

export function InstallBanner() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1',
  );

  const platform = detectPlatform();

  if (dismissed || !platform) return null;

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="relative bg-gradient-to-r from-skin-pink/20 via-skin-panel to-skin-pink/20 border-b-2 border-skin-pink/40">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-skin-dim/60 hover:text-skin-base transition-colors z-10"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>

      <div className="px-4 py-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-skin-pink/20 border border-skin-pink/30 flex items-center justify-center">
            <Download size={16} className="text-skin-pink" />
          </div>
          <div>
            <p className="text-sm font-bold text-skin-base">Install Pecking Order</p>
            <p className="text-[10px] text-skin-dim font-mono uppercase tracking-wider">
              Required for notifications
            </p>
          </div>
        </div>

        {/* Platform-specific instructions */}
        {platform === 'ios-safari' && (
          <div className="space-y-2">
            <Step number={1} icon={<Share size={14} />}>
              Tap the <span className="font-bold text-skin-base">Share</span> button in the toolbar below
            </Step>
            <Step number={2} icon={<span className="text-xs">+</span>}>
              Scroll down, tap <span className="font-bold text-skin-base">"Add to Home Screen"</span>
            </Step>
            <Step number={3} icon={<ArrowRight size={14} />}>
              Tap <span className="font-bold text-skin-base">"Add"</span> in the top right
            </Step>
          </div>
        )}

        {platform === 'ios-chrome' && (
          <div className="space-y-2.5">
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Globe size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200 leading-relaxed">
                <span className="font-bold">Chrome on iOS cannot install apps.</span>{' '}
                Open this page in <span className="font-bold text-skin-base">Safari</span> to install.
              </p>
            </div>
            <p className="text-[10px] text-skin-dim/60 text-center font-mono">
              Copy the URL from the address bar and paste it in Safari
            </p>
          </div>
        )}

        {platform === 'android' && (
          <div className="space-y-2">
            <Step number={1} icon={<span className="text-xs">&#8942;</span>}>
              Tap the <span className="font-bold text-skin-base">menu</span> (three dots) in your browser
            </Step>
            <Step number={2} icon={<Download size={14} />}>
              Tap <span className="font-bold text-skin-base">"Install app"</span> or <span className="font-bold text-skin-base">"Add to Home Screen"</span>
            </Step>
          </div>
        )}

        {platform === 'other' && (
          <div className="space-y-2">
            <Step number={1} icon={<span className="text-xs">&#8942;</span>}>
              Open your <span className="font-bold text-skin-base">browser menu</span>
            </Step>
            <Step number={2} icon={<Download size={14} />}>
              Tap <span className="font-bold text-skin-base">"Install app"</span> or <span className="font-bold text-skin-base">"Add to Home Screen"</span>
            </Step>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ number, icon, children }: { number: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-skin-pink/20 border border-skin-pink/30 shrink-0 mt-0.5">
        <span className="text-[10px] font-bold text-skin-pink">{number}</span>
      </div>
      <div className="flex items-start gap-1.5 text-xs text-skin-dim leading-relaxed">
        <span className="text-skin-pink shrink-0 mt-0.5">{icon}</span>
        <span>{children}</span>
      </div>
    </div>
  );
}
