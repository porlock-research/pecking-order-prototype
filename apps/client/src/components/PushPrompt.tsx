import { Bell, BellOff, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { usePushNotifications } from '../hooks/usePushNotifications';

function getDeniedResetInstructions(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'Go to Settings \u2192 Safari \u2192 Notifications to re-enable';
  }
  return 'Go to browser Settings \u2192 Site settings \u2192 Notifications to re-enable';
}

export function PushPrompt({ token }: { token?: string | null }) {
  const { permission, isSubscribed, subscribe } = usePushNotifications(token);

  if (permission === 'unsupported') {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-skin-dim/5 border border-white/[0.06] opacity-50 cursor-default"
        title="Install the app first to enable push notifications"
      >
        <BellOff size={12} className="text-skin-dim" />
        <span className="text-[9px] font-mono text-skin-dim uppercase tracking-widest font-bold">
          Install app
        </span>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <button
        onClick={() => toast.info(getDeniedResetInstructions(), { duration: 6000 })}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
        title="Notifications blocked — tap for instructions"
      >
        <BellOff size={12} className="text-amber-400" />
        <span className="text-[9px] font-mono text-amber-400 uppercase tracking-widest font-bold">
          Blocked
        </span>
      </button>
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
