import { useState } from 'react';
import { Bell, BellOff, BellRing, X } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

function getDeniedResetInstructions(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'Settings \u2192 Safari \u2192 Notifications \u2192 Allow';
  }
  return 'Settings \u2192 Site settings \u2192 Notifications \u2192 Allow';
}

export function PushPrompt({ token }: { token?: string | null }) {
  const { permission, isSubscribed, subscribe } = usePushNotifications(token);
  const [showTip, setShowTip] = useState(false);

  if (permission === 'unsupported') {
    return (
      <div className="relative">
        <button
          onClick={() => setShowTip(!showTip)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          title="Install the app to enable notifications"
        >
          <BellOff size={12} className="text-amber-400" />
          <span className="text-[9px] font-mono text-amber-400 uppercase tracking-widest font-bold">
            Install app
          </span>
        </button>
        {showTip && (
          <Tooltip onClose={() => setShowTip(false)}>
            Push notifications require the installed app. Look for the install
            instructions at the top of the screen.
          </Tooltip>
        )}
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="relative">
        <button
          onClick={() => setShowTip(!showTip)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          title="Notifications blocked — tap for help"
        >
          <BellOff size={12} className="text-amber-400" />
          <span className="text-[9px] font-mono text-amber-400 uppercase tracking-widest font-bold">
            Blocked
          </span>
        </button>
        {showTip && (
          <Tooltip onClose={() => setShowTip(false)}>
            Notifications are blocked. To fix: {getDeniedResetInstructions()}
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={subscribe}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-skin-pink/10 border border-skin-pink/20 hover:bg-skin-pink/20 transition-colors"
      title={isSubscribed ? 'Push notifications active' : 'Enable push notifications'}
    >
      {isSubscribed ? (
        <div className="relative">
          <BellRing size={12} className="text-skin-pink" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </div>
      ) : (
        <Bell size={12} className="text-skin-pink" />
      )}
      <span className="text-[9px] font-mono text-skin-pink uppercase tracking-widest font-bold">
        Alerts
      </span>
    </button>
  );
}

function Tooltip({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-64 p-3 rounded-xl bg-skin-panel border border-white/[0.08] shadow-xl">
      <button
        onClick={onClose}
        className="absolute top-1.5 right-1.5 p-0.5 text-skin-dim/60 hover:text-skin-base"
        aria-label="Close"
      >
        <X size={12} />
      </button>
      <p className="text-xs text-skin-dim leading-relaxed pr-4">{children}</p>
    </div>
  );
}
