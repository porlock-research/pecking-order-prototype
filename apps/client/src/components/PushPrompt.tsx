import { Bell } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

export function PushPrompt() {
  const { permission, isSubscribed, subscribe } = usePushNotifications();

  // Hide when unsupported, denied, or already subscribed
  if (permission === 'unsupported' || permission === 'denied' || isSubscribed) return null;

  return (
    <button
      onClick={subscribe}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-skin-pink/10 border border-skin-pink/20 hover:bg-skin-pink/20 transition-colors"
      title="Enable push notifications"
    >
      <Bell size={12} className="text-skin-pink" />
      <span className="text-[9px] font-mono text-skin-pink uppercase tracking-widest font-bold">
        Alerts
      </span>
    </button>
  );
}
