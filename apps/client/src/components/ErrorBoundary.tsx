import React from 'react';
import * as Sentry from '@sentry/react';

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

function isChunkLoadError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('Importing a module script failed')
  );
}

async function clearCachesAndReload() {
  try {
    // Unregister all service workers
    const regs = await navigator.serviceWorker?.getRegistrations();
    if (regs) {
      for (const r of regs) await r.unregister();
    }
    // Clear all caches
    const cacheNames = await caches.keys();
    for (const name of cacheNames) await caches.delete(name);
    console.log('[ErrorBoundary] Cleared SW + caches, reloading...');
  } catch (err) {
    console.warn('[ErrorBoundary] Cache cleanup failed:', err);
  }
  // Force a clean reload from the network
  window.location.reload();
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });

    // Auto-recover from chunk loading errors (stale SW cache)
    // Only auto-reload once per session to avoid infinite loops
    if (isChunkLoadError(error) && !sessionStorage.getItem('po_chunk_reload')) {
      sessionStorage.setItem('po_chunk_reload', '1');
      clearCachesAndReload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-velvet flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-xl font-bold text-skin-base">
            {this.state.isChunkError ? 'Updating...' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-skin-dim">
            {this.state.isChunkError
              ? 'A new version is available. Reloading now...'
              : 'Try refreshing the page.'}
          </p>
          <button
            onClick={() => clearCachesAndReload()}
            className="px-5 py-2 rounded-xl border border-skin-gold/30 bg-glass text-xs font-mono font-bold text-skin-gold uppercase tracking-widest hover:border-skin-gold/60 transition-all"
          >
            {this.state.isChunkError ? 'Reload Now' : 'Retry'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
