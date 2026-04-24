import * as Sentry from '@sentry/react';

export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.log('[Sentry] No VITE_SENTRY_DSN set, Sentry disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      tunnel: import.meta.env.VITE_SENTRY_TUNNEL,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
      sendDefaultPii: true,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          blockAllMedia: false,
        }),
        Sentry.httpClientIntegration({
          failedRequestStatusCodes: [[400, 599]],
        }),
        Sentry.consoleLoggingIntegration({ levels: ['log', 'warn', 'error'] }),
      ],
      tracesSampleRate: 1.0,
      tracePropagationTargets: ['localhost', /^\//],

      // Session Replay: record all sessions during playtesting, lower in production
      replaysOnErrorSampleRate: 1.0,
      replaysSessionSampleRate: 1.0,

      enableLogs: true,
    });
  } catch (err) {
    console.error('[Sentry] Failed to initialize:', err);
  }
}

export function setSentryUser(playerId: string, gameId: string) {
  Sentry.setUser({ id: playerId });
  Sentry.setTag('gameId', gameId);
  Sentry.setTag('playerId', playerId);
}

/** Set both tags (filterable) and context (rich detail) for PWA diagnostics. */
export function setSentryPwaContext(data: {
  isStandalone: boolean;
  hasPushManager: boolean;
  platform: string;
}) {
  // Tags: filterable in sidebar — short values only
  Sentry.setTag('standalone', String(data.isStandalone));
  Sentry.setTag('hasPushManager', String(data.hasPushManager));
  Sentry.setTag('platform', /iPhone|iPad/.test(data.platform) ? 'ios' : /Android/.test(data.platform) ? 'android' : 'desktop');

  // Context: rich detail card on event pages
  Sentry.setContext('pwa', data);
}

/** Set a tag for how the player's token was resolved. */
export function setSentryAuthMethod(method: 'transient' | 'cached' | 'cookie' | 'cache-api' | 'lobby-refresh' | 'lobby-recover' | 'lobby-recover-error' | 'raw-token' | 'debug') {
  Sentry.setTag('authMethod', method);
}

export function setSentryContext(key: string, data: Record<string, unknown>) {
  Sentry.setContext(key, data);
}
