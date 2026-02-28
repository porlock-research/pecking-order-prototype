import { useState, useEffect, useRef, useCallback } from 'react';
import { Drawer } from 'vaul';
import { Bell, BellOff, Check } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import '@khmyznikov/pwa-install';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'pwa-install': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        'manifest-url'?: string;
        name?: string;
        description?: string;
        icon?: string;
        'install-description'?: string;
        'disable-close'?: boolean;
        'manual-apple'?: boolean;
        'manual-chrome'?: boolean;
      };
    }
  }
}

const DEFER_KEY = 'po_gate_deferred';

function isMobileDevice(): boolean {
  return navigator.maxTouchPoints > 0 && window.innerWidth < 1024;
}

function getDeniedResetInstructions(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'Go to Settings \u2192 Safari \u2192 Notifications \u2192 find this site \u2192 Allow';
  }
  return 'Tap the lock icon in the address bar \u2192 Site settings \u2192 Notifications \u2192 Allow';
}

interface PwaGateProps {
  token: string | null;
}

export function PwaGate({ token }: PwaGateProps) {
  const { permission, isSubscribed, isStandalone, subscribe } =
    usePushNotifications(token);
  const [deferred, setDeferred] = useState(
    () => sessionStorage.getItem(DEFER_KEY) === '1',
  );
  const [subscribeSuccess, setSubscribeSuccess] = useState(false);

  const isMobile = isMobileDevice();

  // Step 1: Install gate — mobile, not standalone, not deferred
  const showInstallGate = isMobile && !isStandalone && !deferred;

  // Step 2: Push gate — standalone, permission not granted, not already subscribed, not deferred
  const showPushDrawer =
    isStandalone &&
    permission !== 'granted' &&
    permission !== 'unsupported' &&
    !isSubscribed &&
    !deferred &&
    !subscribeSuccess;

  const handleDefer = useCallback(() => {
    sessionStorage.setItem(DEFER_KEY, '1');
    setDeferred(true);
  }, []);

  const handleSubscribe = useCallback(async () => {
    await subscribe();
    // Check if permission was actually granted after the subscribe call
    if (Notification.permission === 'granted') {
      setSubscribeSuccess(true);
      setTimeout(() => setSubscribeSuccess(false), 2000);
    }
  }, [subscribe]);

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
