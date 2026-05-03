import { useState, useEffect, useRef, useCallback } from 'react';
import { Drawer } from 'vaul';
import { Bell, BellOff, Check, Copy, ShieldAlert } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import '@khmyznikov/pwa-install';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // @ts-ignore — conflicts with @khmyznikov/pwa-install's own JSX declaration
      'pwa-install': any;
    }
  }
}

const DEFER_KEY = 'po_gate_deferred';
// Issue #44: was sessionStorage — every cold-launch (iOS evicts standalone
// webviews aggressively) re-prompted, hammering returning players. Switching
// to localStorage with a 24h TTL fixes the per-cold-launch reprompt without
// becoming permanent silence (push is the engagement engine — see memory
// `feedback_push_is_engagement_engine`; if a player defers in pregame they
// should still see the gate next day when notifications actually matter).
const DEFER_TTL_MS = 24 * 60 * 60 * 1000;

function isDeferredFresh(): boolean {
  try {
    const raw = localStorage.getItem(DEFER_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    if (Date.now() - ts >= DEFER_TTL_MS) {
      localStorage.removeItem(DEFER_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isMobileDevice(): boolean {
  return navigator.maxTouchPoints > 0 && window.innerWidth < 1024;
}

function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** True if iOS AND a non-Safari/Chrome browser (Brave, Firefox, Edge, etc).
 *  These browsers use WebKit but don't reliably support our A2HS+push flow on iOS. */
function isIOSUnsupportedBrowser(): boolean {
  if (!isIOS()) return false;
  const ua = navigator.userAgent;
  // Firefox iOS and Edge iOS have explicit UA tokens
  if (/FxiOS|EdgiOS/.test(ua)) return true;
  // Brave is detected separately via navigator.brave (async); the caller passes it in
  return false;
}

function getOSPlatform(): 'macos' | 'windows' | 'linux' | 'android' | 'ios' | 'unknown' {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac/.test(ua)) return 'macos';
  if (/Windows/.test(ua)) return 'windows';
  if (/Linux/.test(ua)) return 'linux';
  return 'unknown';
}

function getDeniedResetInstructions(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'Go to Settings \u2192 Safari \u2192 Notifications \u2192 find this site \u2192 Allow';
  }
  return 'Tap the lock icon in the address bar \u2192 Site settings \u2192 Notifications \u2192 Allow';
}

function getBraveOSPermissionInstruction(): string {
  switch (getOSPlatform()) {
    case 'macos': return 'System Settings \u2192 Notifications \u2192 Brave \u2192 allow notifications';
    case 'android': return 'Android Settings \u2192 Apps \u2192 Brave \u2192 Notifications \u2192 enable';
    case 'windows': return 'Windows Settings \u2192 System \u2192 Notifications \u2192 Brave \u2192 enable';
    case 'linux': return 'Your desktop environment\u2019s notification settings \u2192 enable for Brave';
    default: return 'Your OS notification settings \u2192 enable for Brave';
  }
}

interface PwaGateProps {
  token: string | null;
}

export function PwaGate({ token }: PwaGateProps) {
  // Skip PWA flow entirely when unauthenticated (e.g. demo mode)
  if (!token) return null;

  return <PwaGateInner token={token} />;
}

function PwaGateInner({ token }: { token: string }) {
  const { permission, isSubscribed, isStandalone, ready, subscribe, subscribeError } =
    usePushNotifications(token);
  const [deferred, setDeferred] = useState(() => isDeferredFresh());
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isBrave, setIsBrave] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await (navigator as { brave?: { isBrave?: () => Promise<boolean> } }).brave?.isBrave?.();
        setIsBrave(!!result);
      } catch {
        // navigator.brave not present — non-Brave browser
      }
    })();
  }, []);

  const isMobile = isMobileDevice();

  // Step 1: Install gate — mobile, not standalone, not deferred
  const showInstallGate = isMobile && !isStandalone && !deferred;

  // Step 2: Push gate — anyone who hasn't subscribed yet (standalone, desktop, or mobile-deferred)
  // Skips the install gate scenario (mobile non-standalone with gate active)
  // Waits for the hook to finish its initial check (ready) to avoid flash
  const showPushDrawer =
    ready &&
    !showInstallGate &&
    permission !== 'unsupported' &&
    !isSubscribed &&
    !deferred &&
    !subscribeSuccess;

  const handleDefer = useCallback(() => {
    try {
      localStorage.setItem(DEFER_KEY, Date.now().toString());
    } catch {
      // Storage may be denied (private mode); deferred-state lives in React only
    }
    setDeferred(true);
  }, []);

  const handleSubscribe = useCallback(async () => {
    const ok = await subscribe();
    // Only flash success if the subscription actually completed end-to-end.
    // Brave can grant Notification.permission but throw AbortError on
    // pushManager.subscribe — that's a failure, not a success.
    if (ok) {
      setSubscribeSuccess(true);
      setTimeout(() => setSubscribeSuccess(false), 2000);
    }
  }, [subscribe]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.warn('[PwaGate] clipboard write failed:', err);
    }
  }, []);

  if (!showInstallGate && !showPushDrawer && !subscribeSuccess) return null;

  return (
    <>
      {showInstallGate && (
        <InstallGate onDefer={handleDefer} />
      )}

      <Drawer.Root
        open={showPushDrawer || subscribeSuccess}
        dismissible={false}
        modal={true}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-[60]" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-2xl bg-skin-fill/95 backdrop-blur-xl border-t border-white/[0.08] outline-none">
            <Drawer.Title className="sr-only">Enable Notifications</Drawer.Title>

            <div className="px-6 pt-8 pb-10 flex flex-col items-center text-center gap-5 pb-safe">
              {subscribeSuccess ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center">
                    <Check size={32} className="text-emerald-400" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-black font-display text-skin-base">
                      You're all set!
                    </h2>
                    <p className="text-sm text-skin-dim leading-relaxed max-w-xs">
                      You'll receive notifications for important game events.
                    </p>
                  </div>
                </>
              ) : (subscribeError === 'aborted' || subscribeError === 'unknown') ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center">
                    <ShieldAlert size={32} className="text-amber-400" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-black font-display text-skin-base">
                      {isBrave ? 'Brave Blocked Push Notifications' : "Browser Can't Send Notifications"}
                    </h2>
                    {isBrave ? (
                      <>
                        <p className="text-sm text-skin-dim leading-relaxed max-w-xs">
                          Brave allowed the notification permission, but its privacy shield is blocking the push service that actually delivers them.
                        </p>
                        <p className="text-xs text-skin-dim/80 leading-relaxed max-w-xs">
                          Easiest: open this game in Chrome, Safari, or Firefox.
                        </p>
                        <p className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 leading-relaxed text-left">
                          Or to stay on Brave:<br/>
                          1. Open <span className="underline">brave://settings/privacy</span> &rarr; enable "Use Google services for push messaging"<br/>
                          2. {getBraveOSPermissionInstruction()}<br/>
                          3. Restart Brave, then reload this page
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-skin-dim leading-relaxed max-w-xs">
                          Your browser is blocking push notifications. Pecking Order needs them so you don't miss votes, DMs, and game events.
                        </p>
                        <p className="text-xs text-skin-dim/80 leading-relaxed max-w-xs">
                          Open this game in Chrome, Safari, or Firefox to play with reminders.
                        </p>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="w-full max-w-xs px-6 py-3.5 rounded-xl bg-skin-pink text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-skin-pink/20 active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
                  >
                    {linkCopied ? (
                      <><Check size={16} /> Link copied</>
                    ) : (
                      <><Copy size={16} /> Copy game link</>
                    )}
                  </button>
                  <button
                    onClick={handleSubscribe}
                    className="text-xs text-skin-dim/70 hover:text-skin-dim transition-colors underline underline-offset-2"
                  >
                    Try again
                  </button>
                  <button
                    onClick={handleDefer}
                    className="text-xs text-skin-dim/50 hover:text-skin-dim transition-colors underline underline-offset-2"
                  >
                    I'll do this later
                  </button>
                </>
              ) : permission === 'denied' ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center">
                    <BellOff size={32} className="text-amber-400" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-black font-display text-skin-base">
                      Notifications Blocked
                    </h2>
                    <p className="text-sm text-skin-dim leading-relaxed max-w-xs">
                      You previously blocked notifications. To fix this:
                    </p>
                    <p className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 leading-relaxed">
                      {getDeniedResetInstructions()}
                    </p>
                  </div>
                  <button
                    onClick={handleDefer}
                    className="text-xs text-skin-dim/50 hover:text-skin-dim transition-colors underline underline-offset-2 mt-2"
                  >
                    I'll do this later
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-skin-pink/20 border-2 border-skin-pink/40 flex items-center justify-center">
                    <Bell size={32} className="text-skin-pink" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-black font-display text-skin-base">
                      Enable Notifications
                    </h2>
                    <p className="text-sm text-skin-dim leading-relaxed max-w-xs">
                      Get notified when it's your turn to vote, when you receive
                      DMs, and for important game events.
                    </p>
                  </div>
                  <button
                    onClick={handleSubscribe}
                    className="w-full max-w-xs px-6 py-3.5 rounded-xl bg-skin-pink text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-skin-pink/20 active:scale-[0.97] transition-transform"
                  >
                    Allow Notifications
                  </button>
                  <button
                    onClick={handleDefer}
                    className="text-xs text-skin-dim/50 hover:text-skin-dim transition-colors underline underline-offset-2"
                  >
                    I'll do this later
                  </button>
                </>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

function InstallGate({ onDefer }: { onDefer: () => void }) {
  const pwaRef = useRef<any>(null);
  const [showGate, setShowGate] = useState(true);

  // Show dialog on mount
  useEffect(() => {
    const el = pwaRef.current;
    if (!el) return;
    // pwa-install needs a tick to initialize
    const timer = setTimeout(() => {
      el.showDialog?.();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Re-open dialog if user manages to dismiss via backdrop tap
  useEffect(() => {
    const el = pwaRef.current;
    if (!el || !showGate) return;

    const reopen = () => {
      if (el.isDialogHidden && showGate) {
        setTimeout(() => el.showDialog?.(), 300);
      }
    };

    const observer = new MutationObserver(reopen);
    observer.observe(el, { attributes: true });
    return () => observer.disconnect();
  }, [showGate]);

  return (
    <>
      {/* @ts-ignore — pwa-install library types conflict with boolean attrs */}
      <pwa-install
        ref={pwaRef}
        name="Pecking Order"
        description="Keep your friends close..."
        icon="/icons/icon-192.png"
        install-description="Install to enable push notifications and play the game"
        disable-close
        manual-apple
        manual-chrome
      />
      {/* Escape hatch overlay — rendered behind the pwa-install dialog */}
      {showGate && (
        <div className="fixed bottom-4 left-0 right-0 z-[55] flex justify-center pointer-events-none">
          <button
            onClick={() => {
              setShowGate(false);
              onDefer();
            }}
            className="pointer-events-auto text-xs text-white/40 hover:text-white/60 transition-colors underline underline-offset-2"
          >
            I'll do this later
          </button>
        </div>
      )}
    </>
  );
}
