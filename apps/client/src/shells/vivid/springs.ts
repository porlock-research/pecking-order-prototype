export const VIVID_SPRING = {
  bouncy: { type: 'spring' as const, stiffness: 400, damping: 25 },
  dramatic: { type: 'spring' as const, stiffness: 200, damping: 20 },
  gentle: { type: 'spring' as const, stiffness: 120, damping: 20 },
  snappy: { type: 'spring' as const, stiffness: 500, damping: 30 },
  page: { type: 'spring' as const, stiffness: 300, damping: 28, mass: 0.8 },
} as const;

export const VIVID_TAP = {
  button: { scale: 0.95 },
  card: { scale: 0.97 },
  fab: { scale: 0.88 },
} as const;
