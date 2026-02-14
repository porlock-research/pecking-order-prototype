import { useState, useEffect, useCallback } from 'react';

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

const VAPID_KEY_CACHE_KEY = 'po_vapid_key';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** Find any cached game JWT from sessionStorage (po_token_* keys). */
function findCachedToken(): string | null {
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith('po_token_')) {
      const val = sessionStorage.getItem(key);
      if (val) return val;
    }
  }
  return null;
}

/**
 * HTTP-based push subscription hook. No WebSocket dependency.
 * Subscribes via POST /api/push/subscribe on the game server.
 * Can run on the launcher screen (/) using any cached JWT.
 */
export function usePushNotifications() {
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
    if (permission === 'unsupported' || permission !== 'granted') return;

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setIsSubscribed(false);
        return;
      }
      setIsSubscribed(true);

      // Re-register with server (idempotent upsert)
      const token = findCachedToken();
      if (!token) return;

      const subJSON = sub.toJSON();
      try {
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
      }
    });
  }, [permission, serverHost]);

  const subscribe = useCallback(async () => {
    if (permission === 'unsupported') return;

    const result = await Notification.requestPermission();
    setPermission(result as PushPermission);
    if (result !== 'granted') return;

    try {
      const reg = await navigator.serviceWorker.ready;

      // Fetch VAPID public key from server
      let vapidKey = sessionStorage.getItem(VAPID_KEY_CACHE_KEY);
      if (!vapidKey) {
        const resp = await fetch(`${serverHost}/parties/game-server/vapid-key`);
        const data = await resp.json();
        vapidKey = data.publicKey;
        if (vapidKey) sessionStorage.setItem(VAPID_KEY_CACHE_KEY, vapidKey);
      }

      if (!vapidKey) {
        console.error('[Push] No VAPID key available');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });

      // Send subscription to server via HTTP
      const token = findCachedToken();
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
    } catch (err) {
      console.error('[Push] Subscribe failed:', err);
    }
  }, [permission, serverHost]);

  const unsubscribe = useCallback(async () => {
    if (permission === 'unsupported') return;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
      }

      const token = findCachedToken();
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
  }, [permission, serverHost]);

  return { permission, isSubscribed, subscribe, unsubscribe };
}
