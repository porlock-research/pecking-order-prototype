import * as Sentry from '@sentry/react';

export function initSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: true,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
    tracePropagationTargets: ['localhost', /^\//],
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
