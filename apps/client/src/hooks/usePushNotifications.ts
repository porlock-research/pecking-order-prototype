import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Sentry from '@sentry/react';

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export type SubscribeError = 'aborted' | 'denied' | 'unsupported' | 'unknown';

function classifySubscribeError(err: unknown): Exclude<SubscribeError, 'denied' | 'unsupported'> {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name: string }).name;
    if (name === 'AbortError') return 'aborted';
  }
  return 'unknown';
}

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

/** Get the current game code from the URL path. */
function getGameCodeFromPath(): string | null {
  const match = window.location.pathname.match(/\/game\/([A-Za-z0-9]+)/);
  return match?.[1] ?? null;
}

const LOBBY_HOST = import.meta.env.VITE_LOBBY_HOST || 'http://localhost:3000';

/** Try to refresh a stale token via the lobby's refresh-token API. */
async function refreshToken(gameCode: string): Promise<string | null> {
  try {
    const res = await fetch(`${LOBBY_HOST}/api/refresh-token/${gameCode}`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const { token } = await res.json();
    if (token) {
      localStorage.setItem(`po_token_${gameCode}`, token);
      return token;
    }
  } catch {}
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
  const [ready, setReady] = useState(false);
  const [subscribeError, setSubscribeError] = useState<SubscribeError | null>(null);

  const serverHost = import.meta.env.VITE_GAME_SERVER_HOST || 'http://localhost:8787';
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

  // Sync existing browser subscription to D1 on mount
  useEffect(() => {
    Sentry.addBreadcrumb({ category: 'push', message: 'init', data: { permission, isStandalone, hasPushManager } });
    if (permission === 'unsupported') {
      console.log('[Push] Push unsupported (no SW or no PushManager)');
      setReady(true);
      return;
    }

    // No SW registered yet — button should show (isSubscribed stays false)
    if (!navigator.serviceWorker.controller && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        if (regs.length === 0) {
          console.log('[Push] No SW controller, no registrations — showing subscribe button');
          setIsSubscribed(false);
          setReady(true);
          return;
        }
        console.log('[Push] No SW controller but', regs.length, 'registration(s) found — checking subscription');
        checkExistingSubscription();
      }).catch(err => {
        console.error('[Push] getRegistrations failed:', err);
        setReady(true);
      });
    } else {
      console.log('[Push] SW controller active — checking subscription');
      checkExistingSubscription();
    }

    async function checkExistingSubscription() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) {
          // Permission granted but no subscription on this origin (e.g. after
          // domain migration from pages.dev → custom domain). Auto-resubscribe
          // since the user already granted permission — no browser prompt needed.
          if (Notification.permission === 'granted') {
            console.log('[Push] Permission granted but no subscription — auto-resubscribing');
            await autoResubscribe(reg);
          } else {
            console.log('[Push] No subscription, permission is:', Notification.permission);
            setIsSubscribed(false);
          }
          return;
        }
        setIsSubscribed(true);

        // Re-register with server (idempotent upsert)
        const token = activeToken || findCachedToken();
        if (!token) {
          console.warn('[Push] Existing subscription found but no JWT — skipping server re-sync');
          return;
        }

        const subJSON = sub.toJSON();
        const pushBody = JSON.stringify({
          endpoint: subJSON.endpoint,
          keys: { p256dh: subJSON.keys?.p256dh, auth: subJSON.keys?.auth },
        });
        let res = await fetch(`${serverHost}/api/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: pushBody,
        });
        // Token rejected (e.g., secret rotation) — try refreshing via lobby
        if (res.status === 401) {
          const gameCode = getGameCodeFromPath();
          const freshToken = gameCode ? await refreshToken(gameCode) : null;
          if (freshToken) {
            console.log('[Push] Token refreshed via lobby, retrying subscribe');
            res = await fetch(`${serverHost}/api/push/subscribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${freshToken}` },
              body: pushBody,
            });
          }
        }
        if (!res.ok) {
          console.warn('[Push] Server re-sync returned', res.status);
        } else {
          console.log('[Push] Server re-sync successful');
        }
      } catch (err) {
        console.error('[Push] Re-sync failed:', err);
        setIsSubscribed(false);
      } finally {
        setReady(true);
      }
    }

    async function autoResubscribe(reg: ServiceWorkerRegistration) {
      try {
        if (!vapidPublicKey) {
          console.error('[Push] Auto-resubscribe: no VAPID key configured');
          setIsSubscribed(false);
          setSubscribeError('unknown');
          return;
        }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
        });

        const token = activeToken || findCachedToken();
        if (!token) {
          console.error('[Push] Auto-resubscribe: no cached JWT');
          setIsSubscribed(false);
          return;
        }

        const subJSON = sub.toJSON();
        const pushBody = JSON.stringify({
          endpoint: subJSON.endpoint,
          keys: { p256dh: subJSON.keys?.p256dh, auth: subJSON.keys?.auth },
        });
        let res = await fetch(`${serverHost}/api/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: pushBody,
        });
        if (res.status === 401) {
          const gameCode = getGameCodeFromPath();
          const freshToken = gameCode ? await refreshToken(gameCode) : null;
          if (freshToken) {
            console.log('[Push] Auto-resubscribe: token refreshed via lobby, retrying');
            res = await fetch(`${serverHost}/api/push/subscribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${freshToken}` },
              body: pushBody,
            });
          }
        }
        if (!res.ok) {
          console.error('[Push] Auto-resubscribe server registration failed:', res.status);
          setIsSubscribed(false);
          setSubscribeError('unknown');
          return;
        }

        setIsSubscribed(true);
        setPermission('granted');
        setSubscribeError(null);
        console.log('[Push] Auto-resubscribe successful');
        Sentry.addBreadcrumb({ category: 'push', message: 'auto-resubscribe.success' });
      } catch (err) {
        console.error('[Push] Auto-resubscribe failed:', err);
        setIsSubscribed(false);
        setSubscribeError(classifySubscribeError(err));
        Sentry.addBreadcrumb({ category: 'push', message: 'auto-resubscribe.failed', data: { error: String(err) } });
      }
    }
  }, [permission, serverHost, vapidPublicKey, activeToken]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setSubscribeError(null);

    if (permission === 'unsupported') {
      console.warn('[Push] Subscribe called but push is unsupported');
      setSubscribeError('unsupported');
      return false;
    }

    const result = await Notification.requestPermission();
    setPermission(result as PushPermission);
    if (result !== 'granted') {
      Sentry.addBreadcrumb({ category: 'push', message: 'subscribe.denied', data: { result } });
      if (result === 'denied') setSubscribeError('denied');
      return false;
    }

    try {
      const reg = await navigator.serviceWorker.ready;

      // Clear any stale subscription (e.g. from a different VAPID key)
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        console.log('[Push] Clearing stale subscription before re-subscribing');
        await existing.unsubscribe();
      }

      if (!vapidPublicKey) {
        console.error('[Push] No VAPID key configured');
        setSubscribeError('unknown');
        return false;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });

      // Send subscription to server via HTTP
      const token = activeToken || findCachedToken();
      if (!token) {
        console.error('[Push] No cached JWT — cannot register subscription');
        setSubscribeError('unknown');
        return false;
      }

      const subJSON = sub.toJSON();
      const res = await fetch(`${serverHost}/api/push/subscribe`, {
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
      if (!res.ok) {
        console.error('[Push] Subscribe server registration failed:', res.status);
        setSubscribeError('unknown');
        return false;
      }

      setIsSubscribed(true);
      setSubscribeError(null);
      console.log('[Push] Subscribe successful');
      Sentry.addBreadcrumb({ category: 'push', message: 'subscribe.success' });
      return true;
    } catch (err) {
      console.error('[Push] Subscribe failed:', err);
      setSubscribeError(classifySubscribeError(err));
      Sentry.addBreadcrumb({ category: 'push', message: 'subscribe.failed', data: { error: String(err) } });
      return false;
    }
  }, [permission, serverHost, vapidPublicKey, activeToken]);

  const unsubscribe = useCallback(async () => {
    if (permission === 'unsupported') {
      console.warn('[Push] Unsubscribe called but push is unsupported');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        console.log('[Push] Browser subscription removed');
      } else {
        console.warn('[Push] No browser subscription to unsubscribe');
      }

      const token = activeToken || findCachedToken();
      if (token) {
        const res = await fetch(`${serverHost}/api/push/subscribe`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!res.ok) console.warn('[Push] Server unsubscribe returned', res.status);
      } else {
        console.warn('[Push] No JWT — server subscription record not cleaned up');
      }

      setIsSubscribed(false);
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
    }
  }, [permission, serverHost, activeToken]);

  return { permission, isSubscribed, isStandalone, hasPushManager, ready, subscribe, unsubscribe, subscribeError };
}
