/**
 * CartridgeTheme — typed token contract for skinnable game cartridges.
 *
 * Shells provide these tokens via CSS custom properties (--po-*).
 * Canvas renderers and inline-styled components resolve them once
 * at mount time via `resolveCartridgeTheme()`.
 *
 * The contract is deliberately platform-agnostic: only hex strings,
 * numbers, and simple objects — portable to native iOS/Android.
 */

export interface CartridgeTheme {
  colors: {
    gold: string;
    pink: string;
    danger: string;
    green: string;
    orange: string;
    info: string;
    bg: string;
    bgSubtle: string;
    panel: string;
    border: string;
    text: string;
    textDim: string;
  };
  radius: {
    sm: number;
    md: number;
    lg: number;
  };
  opacity: {
    subtle: number;
    medium: number;
    strong: number;
  };
}

export const DEFAULT_CARTRIDGE_THEME: CartridgeTheme = {
  colors: {
    gold: '#fbbf24',
    pink: '#ec4899',
    danger: '#ef4444',
    green: '#10b981',
    orange: '#f97316',
    info: '#818cf8',
    bg: '#2c003e',
    bgSubtle: '#4c1d95',
    panel: '#4c1d95',
    border: 'rgba(255, 255, 255, 0.1)',
    text: '#ffffff',
    textDim: '#d8b4fe',
  },
  radius: { sm: 4, md: 8, lg: 12 },
  opacity: { subtle: 0.06, medium: 0.15, strong: 0.4 },
};

/**
 * Read current theme from CSS custom properties.
 * Call once at component mount, not per frame.
 */
export function resolveCartridgeTheme(element?: HTMLElement): CartridgeTheme {
  const el = element || document.documentElement;
  const style = getComputedStyle(el);
  const get = (prop: string) => style.getPropertyValue(prop).trim();

  return {
    colors: {
      gold: get('--po-gold') || DEFAULT_CARTRIDGE_THEME.colors.gold,
      pink: get('--po-pink') || DEFAULT_CARTRIDGE_THEME.colors.pink,
      danger: get('--po-danger') || DEFAULT_CARTRIDGE_THEME.colors.danger,
      green: get('--po-green') || DEFAULT_CARTRIDGE_THEME.colors.green,
      orange: get('--po-orange') || DEFAULT_CARTRIDGE_THEME.colors.orange,
      info: get('--po-info') || DEFAULT_CARTRIDGE_THEME.colors.info,
      bg: get('--po-bg-deep') || DEFAULT_CARTRIDGE_THEME.colors.bg,
      bgSubtle: get('--po-bg-panel') || DEFAULT_CARTRIDGE_THEME.colors.bgSubtle,
      panel: get('--po-bg-panel') || DEFAULT_CARTRIDGE_THEME.colors.panel,
      border: get('--po-border') || DEFAULT_CARTRIDGE_THEME.colors.border,
      text: get('--po-text') || DEFAULT_CARTRIDGE_THEME.colors.text,
      textDim: get('--po-text-dim') || DEFAULT_CARTRIDGE_THEME.colors.textDim,
    },
    radius: { sm: 4, md: 8, lg: 12 },
    opacity: { subtle: 0.06, medium: 0.15, strong: 0.4 },
  };
}

/**
 * Append alpha channel to a hex color string.
 * Passes through rgba() strings unchanged.
 */
export function withAlpha(hex: string, alpha: number): string {
  if (hex.startsWith('rgba')) return hex;
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return hex.length === 7 ? hex + a : hex;
}
