export const PULSE_SPRING = {
  bouncy: { stiffness: 400, damping: 25 },
  snappy: { stiffness: 500, damping: 30 },
  gentle: { stiffness: 150, damping: 20 },
  page: { stiffness: 300, damping: 28, mass: 0.8 },
  pop: { stiffness: 600, damping: 15 },
  /** Overlay exit — softer than snappy so dismissals feel calm, not aggressive. */
  exit: { stiffness: 260, damping: 30, mass: 0.9 },
} as const;

export const PULSE_TAP = {
  button: { scale: 0.95 },
  card: { scale: 0.97 },
  pill: { scale: 0.98 },
} as const;
