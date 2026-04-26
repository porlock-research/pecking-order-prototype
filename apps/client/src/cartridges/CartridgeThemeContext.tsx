import { useLayoutEffect, useState } from 'react';
import type { CartridgeTheme } from '@pecking-order/ui-kit/cartridge-theme';
import { DEFAULT_CARTRIDGE_THEME } from '@pecking-order/ui-kit/cartridge-theme';

// Browsers normalize the `color` computed style to `rgb(r g b)` or `rgb(r g b / a)`
// (modern syntax) or the older comma-separated forms. Match all of them.
const RGB_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/;

function rgbStringToHexOrRgba(computed: string): string | null {
  const m = computed.match(RGB_RE);
  if (!m) return null;
  const r = Math.round(parseFloat(m[1]));
  const g = Math.round(parseFloat(m[2]));
  const b = Math.round(parseFloat(m[3]));
  let a = 1;
  if (m[4] != null) {
    a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  }
  if (a < 1) return `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`;
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Resolve a CartridgeTheme from --po-* CSS custom properties on a DOM element.
 * Each shell sets --po-* vars in its CSS scope; this reads them into a typed object
 * for canvas renderers that need programmatic color access.
 *
 * Colors are normalized to hex (`#rrggbb`) or `rgba(...)` via an in-scope probe
 * element. This handles shells that declare tokens in oklch()/color-mix() form
 * (Pulse), which would otherwise pass through `withAlpha` unchanged and silently
 * drop alpha on every faded canvas layer.
 */
export function resolveCartridgeTheme(el: HTMLElement): CartridgeTheme {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;contain:strict;';
  el.appendChild(probe);
  const probeStyle = getComputedStyle(probe);

  const v = (name: string, fallback: string) => {
    probe.style.color = `var(${name}, ${fallback})`;
    return rgbStringToHexOrRgba(probeStyle.color) ?? fallback;
  };

  const d = DEFAULT_CARTRIDGE_THEME;
  const theme: CartridgeTheme = {
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

  el.removeChild(probe);
  return theme;
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
