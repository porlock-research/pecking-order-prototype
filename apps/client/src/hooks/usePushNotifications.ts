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

export function usePushNotifications(socket: WebSocket | { send: (data: string) => void } | null) {
  const [permission, setPermission] = useState<PushPermission>(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return 'unsupported';
    }
    return Notification.permission as PushPermission;
  });
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Check existing subscription on mount AND re-register with new game servers.
  // Push subscriptions live in the browser, but the server stores them per Durable Object
  // (per game). When the player joins a new game, the new DO has no record of the
  // subscription, so we re-send PUSH.SUBSCRIBE over the new WebSocket.
  useEffect(() => {
    if (permission === 'unsupported') return;
    if (!socket) return;

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
        if (sub && socket) {
          const subJSON = sub.toJSON();
          socket.send(JSON.stringify({
            type: 'PUSH.SUBSCRIBE',
            subscription: {
              endpoint: subJSON.endpoint,
              keys: { p256dh: subJSON.keys?.p256dh, auth: subJSON.keys?.auth },
            },
            returnUrl: window.location.href,
          }));
        }
      });
    });
  }, [permission, socket]);

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
        const serverHost = import.meta.env.VITE_GAME_SERVER_HOST || 'http://localhost:8787';
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

      // Send subscription to server over WebSocket
      const subJSON = sub.toJSON();
      socket?.send(JSON.stringify({
        type: 'PUSH.SUBSCRIBE',
        subscription: {
          endpoint: subJSON.endpoint,
          keys: { p256dh: subJSON.keys?.p256dh, auth: subJSON.keys?.auth },
        },
        returnUrl: window.location.href,
      }));

      setIsSubscribed(true);
    } catch (err) {
      console.error('[Push] Subscribe failed:', err);
    }
  }, [permission, socket]);

  const unsubscribe = useCallback(async () => {
    if (permission === 'unsupported') return;

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        socket?.send(JSON.stringify({ type: 'PUSH.UNSUBSCRIBE' }));
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
    }
  }, [permission, socket]);

  return { permission, isSubscribed, subscribe, unsubscribe };
}
