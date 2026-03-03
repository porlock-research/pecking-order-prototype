import * as Sentry from '@sentry/react';

export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

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
    ],
    tracesSampleRate: 1.0,
    tracePropagationTargets: ['localhost', /^\//],

    // Session Replay: record all error sessions, 10% of normal sessions
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,

    enableLogs: true,
  });
}

export function setSentryUser(playerId: string, gameId: string) {
  Sentry.setUser({ id: playerId });
  Sentry.setTag('gameId', gameId);
}

export function setSentryContext(key: string, data: Record<string, unknown>) {
  Sentry.setContext(key, data);
}
