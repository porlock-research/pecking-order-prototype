import { useEffect } from 'react';
import type { DeepLinkIntent } from '@pecking-order/shared-types';
import { useGameStore } from '../store/useGameStore';

const MAX_ATTEMPTS = 3;
const MAX_AGE_MS = 10_000;

/**
 * Reads deep-link intents from two sources:
 *   1. `?intent=<base64>` query param on mount (cold-start from SW openWindow)
 *   2. `DEEP_LINK_INTENT` postMessage from the service worker (focus path)
 *
 * `resolve(intent, origin)` returns true if the target was ready and the
 * intent was handled. Returning false retains the intent for retry as the
 * store hydrates (SYNC may not have arrived when the intent lands).
 *
 * Bounded by MAX_ATTEMPTS (3) and MAX_AGE_MS (10s) to avoid infinite loops.
 */
export function useDeepLinkIntent(resolve: (intent: DeepLinkIntent, origin: 'push') => boolean): void {
  const pendingIntent = useGameStore(s => s.pendingIntent);
  const attempts = useGameStore(s => s.pendingIntentAttempts);
  const firstReceivedAt = useGameStore(s => s.pendingIntentFirstReceivedAt);
  const setPendingIntent = useGameStore(s => s.setPendingIntent);
  const incrementIntentAttempts = useGameStore(s => s.incrementIntentAttempts);

  // Mount: read ?intent= from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const b64 = params.get('intent');
    if (b64) {
      try {
        const intent = JSON.parse(atob(b64)) as DeepLinkIntent;
        params.delete('intent');
        const newSearch = params.toString();
        const newUrl =
          window.location.pathname +
          (newSearch ? `?${newSearch}` : '') +
          window.location.hash;
        window.history.replaceState(null, '', newUrl);
        const handled = resolve(intent, 'push');
        if (!handled) setPendingIntent(intent);
      } catch {
        // Malformed ?intent= — ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to postMessage from SW
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'DEEP_LINK_INTENT' && event.data.intent) {
        const intent = event.data.intent as DeepLinkIntent;
        const handled = resolve(intent, 'push');
        if (!handled) setPendingIntent(intent);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [resolve, setPendingIntent]);

  // Retry loop: re-evaluate pendingIntent on store updates, bounded by
  // MAX_ATTEMPTS / MAX_AGE_MS
  useEffect(() => {
    if (!pendingIntent || !firstReceivedAt) return;
    if (Date.now() - firstReceivedAt > MAX_AGE_MS) {
      setPendingIntent(null);
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      setPendingIntent(null);
      return;
    }
    incrementIntentAttempts();
    const handled = resolve(pendingIntent, 'push');
    if (handled) setPendingIntent(null);
  }, [pendingIntent, attempts, firstReceivedAt, resolve, setPendingIntent, incrementIntentAttempts]);
}
