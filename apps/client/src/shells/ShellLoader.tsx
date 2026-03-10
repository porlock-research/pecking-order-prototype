import React, { lazy, Suspense, useMemo } from 'react';
import { useGameEngine } from '../hooks/useGameEngine';
import { getActiveShellId, SHELL_REGISTRY } from './registry';
import { ShellPicker } from './ShellPicker';
import { CartridgeThemeProvider } from '../cartridges/CartridgeThemeContext';
import type { ShellProps } from './types';

interface ShellLoaderProps {
  gameId: string;
  playerId: string;
  token: string | null;
  party?: string;
}

export function ShellLoader({ gameId, playerId, token, party }: ShellLoaderProps) {
  const engine = useGameEngine(gameId, playerId, token, party);

  const { ShellComponent, cartridgeTheme } = useMemo(() => {
    const shellId = getActiveShellId();
    const manifest = SHELL_REGISTRY.find(s => s.id === shellId) || SHELL_REGISTRY[0];
    return {
      ShellComponent: lazy(manifest.load),
      cartridgeTheme: manifest.cartridgeTheme,
    };
  }, []);

  const shellProps: ShellProps = { playerId, engine, token };

  return (
    <CartridgeThemeProvider theme={cartridgeTheme}>
      <Suspense
        fallback={
          <div className="min-h-screen bg-gradient-velvet flex flex-col items-center justify-center gap-3">
            <span className="w-6 h-6 border-2 border-skin-gold border-t-transparent rounded-full spin-slow" />
            <span className="text-skin-gold font-mono animate-shimmer uppercase tracking-widest text-sm">
              ESTABLISHING_UPLINK...
            </span>
          </div>
        }
      >
        <ShellComponent {...shellProps} />
        <ShellPicker />
      </Suspense>
    </CartridgeThemeProvider>
  );
}
