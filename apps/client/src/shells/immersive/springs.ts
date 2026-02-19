export const SPRING = {
  button: { type: 'spring' as const, stiffness: 400, damping: 17 },
  snappy: { type: 'spring' as const, stiffness: 500, damping: 25 },
  bouncy: { type: 'spring' as const, stiffness: 300, damping: 12 },
  gentle: { type: 'spring' as const, stiffness: 200, damping: 20 },
  swipe: { type: 'spring' as const, stiffness: 300, damping: 30, mass: 0.8 },
} as const;

export const TAP = {
  button: { scale: 0.95 },
  card: { scale: 0.98 },
  bubble: { scale: 0.97 },
  fab: { scale: 0.90 },
} as const;
