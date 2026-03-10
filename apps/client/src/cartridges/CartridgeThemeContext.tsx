import { useLayoutEffect, useState } from 'react';
import type { CartridgeTheme } from '@pecking-order/ui-kit/cartridge-theme';
import { DEFAULT_CARTRIDGE_THEME } from '@pecking-order/ui-kit/cartridge-theme';

/**
 * Resolve a CartridgeTheme from --po-* CSS custom properties on a DOM element.
 * Each shell sets --po-* vars in its CSS scope; this reads them into a typed object
 * for canvas renderers that need programmatic color access.
 */
export function resolveCartridgeTheme(el: HTMLElement): CartridgeTheme {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  const d = DEFAULT_CARTRIDGE_THEME;
  return {
    colors: {
      gold: v('--po-gold', d.colors.gold),
      pink: v('--po-pink', d.colors.pink),
      danger: v('--po-danger', d.colors.danger),
      green: v('--po-green', d.colors.green),
      orange: v('--po-orange', d.colors.orange),
      info: v('--po-info', d.colors.info),
      bg: v('--po-bg-deep', d.colors.bg),
      bgSubtle: v('--po-bg-input', d.colors.bgSubtle),
      panel: v('--po-bg-panel', d.colors.panel),
      border: v('--po-border', d.colors.border),
      text: v('--po-text', d.colors.text),
      textDim: v('--po-text-dim', d.colors.textDim),
    },
    radius: d.radius,
    opacity: d.opacity,
  };
}

/**
 * Resolve CartridgeTheme from --po-* CSS vars on a DOM element ref.
 * Used by canvas-based cartridge renderers that need typed color values.
 * Resolves in useLayoutEffect (before paint) so the first frame draws correctly.
 */
export function useCartridgeTheme(ref: React.RefObject<HTMLElement | null>): CartridgeTheme {
  const [theme, setTheme] = useState<CartridgeTheme>(DEFAULT_CARTRIDGE_THEME);
  useLayoutEffect(() => {
    if (ref.current) setTheme(resolveCartridgeTheme(ref.current));
  }, [ref]);
  return theme;
}
