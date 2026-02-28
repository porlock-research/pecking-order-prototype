import React from 'react';
import * as Sentry from '@sentry/react';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-velvet flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-xl font-bold text-skin-base">
            Something went wrong
          </h1>
          <p className="text-sm text-skin-dim">
            Try refreshing the page.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-5 py-2 rounded-xl border border-skin-gold/30 bg-glass text-xs font-mono font-bold text-skin-gold uppercase tracking-widest hover:border-skin-gold/60 transition-all"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
