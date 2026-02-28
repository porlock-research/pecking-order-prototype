import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Sentry from '@sentry/react';

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Find any cached game JWT from localStorage (po_token_* keys). */
function findCachedToken(): string | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('po_token_')) {
      const val = localStorage.getItem(key);
      if (val) return val;
    }
  }
  return null;
}

/**
 * HTTP-based push subscription hook. No WebSocket dependency.
 * Subscribes via POST /api/push/subscribe on the game server.
 * Pass the active game token to ensure the subscription is keyed
 * to the correct user identity. Falls back to any cached JWT.
 */
export function usePushNotifications(activeToken?: string | null) {
  const isStandalone = useMemo(
    () => matchMedia('(display-mode: standalone)').matches || !!(navigator as any).standalone,
    [],
  );
  const hasPushManager = useMemo(() => typeof window !== 'undefined' && 'PushManager' in window, []);

  const [permission, setPermission] = useState<PushPermission>(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return 'unsupported';
    }
    return Notification.permission as PushPermission;
  });
  const [isSubscribed, setIsSubscribed] = useState(false);

  const serverHost = import.meta.env.VITE_GAME_SERVER_HOST || 'http://localhost:8787';

  // Sync existing browser subscription to D1 on mount
  useEffect(() => {
    Sentry.addBreadcrumb({ category: 'push', message: 'init', data: { permission, isStandalone, hasPushManager } });
    if (permission === 'unsupported') return;

    // No SW registered yet — button should show (isSubscribed stays false)
    if (!navigator.serviceWorker.controller && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        if (regs.length === 0) {
          setIsSubscribed(false);
          return;
        }
        checkExistingSubscription();
      });
    } else {
      checkExistingSubscription();
    }

    async function checkExistingSubscription() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          setIsSubscribed(false);
          return;
        }
        setIsSubscribed(true);

        // Re-register with server (idempotent upsert)
        const token = activeToken || findCachedToken();
        if (!token) return;

        const subJSON = sub.toJSON();
        await fetch(`${serverHost}/api/push/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            endpoint: subJSON.endpoint,
            keys: { p256dh: subJSON.keys?.p256dh, auth: subJSON.keys?.auth },
          }),
        });
      } catch (err) {
        console.error('[Push] Re-sync failed:', err);
        setIsSubscribed(false);
      }
    }
  }, [permission, serverHost, activeToken]);

  const subscribe = useCallback(async () => {
    if (permission === 'unsupported') return;

    const result = await Notification.requestPermission();
    setPermission(result as PushPermission);
    if (result !== 'granted') {
      Sentry.addBreadcrumb({ category: 'push', message: 'subscribe.denied', data: { result } });
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;

      // Clear any stale subscription (e.g. from a different VAPID key)
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      // Fetch VAPID public key from server (always fresh — key differs per environment)
      const resp = await fetch(`${serverHost}/parties/game-server/vapid-key`);
      const data = await resp.json();
      const vapidKey = data.publicKey;

      if (!vapidKey) {
        console.error('[Push] No VAPID key available');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });

      // Send subscription to server via HTTP
      const token = activeToken || findCachedToken();
      if (!token) {
        console.error('[Push] No cached JWT — cannot register subscription');
        return;
      }

      const subJSON = sub.toJSON();
      await fetch(`${serverHost}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          keys: { p256dh: subJSON.keys?.p256dh, auth: subJSON.keys?.auth },
        }),
      });

      setIsSubscribed(true);
      Sentry.addBreadcrumb({ category: 'push', message: 'subscribe.success' });
    } catch (err) {
      console.error('[Push] Subscribe failed:', err);
      Sentry.addBreadcrumb({ category: 'push', message: 'subscribe.failed', data: { error: String(err) } });
    }
  }, [permission, serverHost, activeToken]);

  const unsubscribe = useCallback(async () => {
    if (permission === 'unsupported') return;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }

      const token = activeToken || findCachedToken();
      if (token) {
        await fetch(`${serverHost}/api/push/subscribe`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
    }
  }, [permission, serverHost, activeToken]);

  return { permission, isSubscribed, isStandalone, hasPushManager, subscribe, unsubscribe };
}
