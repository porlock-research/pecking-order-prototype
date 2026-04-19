/**
 * Pulse spacing scale — 4pt base with strategic breaks.
 *
 * Use the CSS custom properties `--pulse-space-*` in inline styles wherever
 * possible:
 *   padding: 'var(--pulse-space-sm) var(--pulse-space-md)'
 *
 * This numeric export exists for places that need raw numbers — framer-motion
 * `animate` distances, computed layouts, tests. Values MUST match the CSS
 * custom properties in pulse-theme.css.
 *
 * Do not invent spacing values at call sites. If none of these fit, add a
 * new tier here first.
 */
export const PULSE_SPACE = {
  '2xs': 2,   // hairline — grouped siblings
  xs: 4,      // intra-element — icon + label
  sm: 8,      // tight grouping
  md: 12,     // related elements
  lg: 16,     // section padding
  xl: 24,     // section separation
  '2xl': 32,  // major section break
  '3xl': 48,  // page-level division
} as const;

export type PulseSpace = keyof typeof PULSE_SPACE;
