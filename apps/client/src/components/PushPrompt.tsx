import { Bell, BellRing } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

/**
 * Simplified push prompt — only used on LauncherScreen (no active game shell).
 * In-shell push gating is handled by PwaGate.
 */
export function PushPrompt({ token }: { token?: string | null }) {
  const { permission, isSubscribed, subscribe } = usePushNotifications(token);

  // Nothing to show if push is unsupported or denied — PwaGate handles those in-shell
  if (permission === 'unsupported' || permission === 'denied') return null;

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
