/**
 * CartridgeTheme — typed token contract for game cartridge renderers.
 *
 * The --po-* CSS custom properties are the shared theming contract.
 * Each shell sets them in its CSS scope. Tailwind skin-* classes resolve
 * to --po-* vars, so DOM-based cartridges just work.
 *
 * Canvas-based renderers use useCartridgeTheme(ref) which reads --po-*
 * vars from the DOM and returns this typed object.
 *
 * The DEFAULT_CARTRIDGE_THEME matches the :root --po-* values (dark theme)
 * and serves as the fallback when CSS resolution isn't available.
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

/** Dark theme fallback — matches :root --po-* values in theme.css. */
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
