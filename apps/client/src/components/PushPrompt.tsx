import { Bell } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

export function PushPrompt({ token }: { token?: string | null }) {
  const { permission, isSubscribed, subscribe } = usePushNotifications(token);

  // Hide only when unsupported or denied
  if (permission === 'unsupported' || permission === 'denied') return null;

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
