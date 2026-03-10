import { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { CartridgeTheme } from '@pecking-order/ui-kit/cartridge-theme';
import {
  resolveCartridgeTheme,
  DEFAULT_CARTRIDGE_THEME,
} from '@pecking-order/ui-kit/cartridge-theme';

const CartridgeThemeCtx = createContext<CartridgeTheme>(DEFAULT_CARTRIDGE_THEME);

export function CartridgeThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<CartridgeTheme>(DEFAULT_CARTRIDGE_THEME);

  useEffect(() => {
    setTheme(resolveCartridgeTheme(ref.current || undefined));
  }, []);

  return (
    <div ref={ref}>
      <CartridgeThemeCtx.Provider value={theme}>
        {children}
      </CartridgeThemeCtx.Provider>
    </div>
  );
}

export function useCartridgeTheme(): CartridgeTheme {
  return useContext(CartridgeThemeCtx);
}
