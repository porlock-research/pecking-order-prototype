import { createContext, useContext } from 'react';
import type { CartridgeTheme } from '@pecking-order/ui-kit/cartridge-theme';
import { DEFAULT_CARTRIDGE_THEME } from '@pecking-order/ui-kit/cartridge-theme';

const CartridgeThemeCtx = createContext<CartridgeTheme>(DEFAULT_CARTRIDGE_THEME);

export function CartridgeThemeProvider({
  theme = DEFAULT_CARTRIDGE_THEME,
  children,
}: {
  theme?: CartridgeTheme;
  children: React.ReactNode;
}) {
  return (
    <CartridgeThemeCtx.Provider value={theme}>
      {children}
    </CartridgeThemeCtx.Provider>
  );
}

export function useCartridgeTheme(): CartridgeTheme {
  return useContext(CartridgeThemeCtx);
}
