import { useState } from 'react';
import { X, Download } from 'lucide-react';

const DISMISS_KEY = 'po_a2hs_dismissed';

function getInstallInstructions(): string | null {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isCriOS = /CriOS/.test(ua);
  const isStandalone =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone;

  if (isStandalone) return null;

  // Only show on mobile-ish devices
  const isMobile = navigator.maxTouchPoints > 0 && window.innerWidth < 1024;
  if (!isMobile) return null;

  if (isIOS && isCriOS) return 'Open in Safari to install as app';
  if (isIOS) return 'Tap Share \u229B then "Add to Home Screen"';
  return 'Use browser menu \u2192 "Install app"';
}

export function InstallBanner() {
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1',
  );

  const instructions = getInstallInstructions();

  if (dismissed || !instructions) return null;

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-skin-panel border-b border-white/[0.06] text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <Download size={14} className="text-skin-gold shrink-0" />
        <span className="text-skin-dim truncate">
          <span className="text-skin-base font-medium">Install Pecking Order</span>
          {' \u2014 '}
          {instructions}
        </span>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-0.5 text-skin-dim/60 hover:text-skin-base transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
