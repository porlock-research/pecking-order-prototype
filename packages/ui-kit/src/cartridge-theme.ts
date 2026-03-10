/**
 * CartridgeTheme — typed token contract for skinnable game cartridges.
 *
 * Shells provide a CartridgeTheme object as a prop to CartridgeThemeProvider.
 * Cartridges consume it via useCartridgeTheme() — fully isolated from
 * which shell they're rendered in.
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

/** Dark theme — used by Classic and Immersive shells. */
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

/** Light theme — used by Vivid shell. */
export const VIVID_CARTRIDGE_THEME: CartridgeTheme = {
  colors: {
    gold: '#D4960A',
    pink: '#D94073',
    danger: '#E8614D',
    green: '#6B9E6E',
    orange: '#E89B3A',
    info: '#8B6CC1',
    bg: '#FDF8F0',
    bgSubtle: '#FAF3E8',
    panel: '#F5EDE0',
    border: 'rgba(61, 46, 31, 0.12)',
    text: '#3D2E1F',
    textDim: '#9B8E7E',
  },
  radius: { sm: 8, md: 12, lg: 16 },
  opacity: { subtle: 0.06, medium: 0.12, strong: 0.3 },
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
